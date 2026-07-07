import RssParser from 'rss-parser'
import { translateAndSummarize, summarizeChinese } from './ai.js'
import { db } from '../db.js'

const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AI-Daily-News/1.0',
  },
})

// 中英文混合 RSS 源
const RSS_SOURCES = [
  // 中文源
  { url: 'https://www.jiqizhixin.com/rss', name: '机器之心', lang: 'zh' },
  { url: 'https://36kr.com/feed', name: '36氪', lang: 'zh' },
  // 英文源
  { url: 'https://hnrss.org/frontpage?count=10', name: 'Hacker News', lang: 'en' },
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: 'TechCrunch AI', lang: 'en' },
]

interface ParsedArticle {
  title: string
  content: string
  source: string
  sourceUrl: string
  publishedAt: string
}

async function fetchSingleSource(
  source: (typeof RSS_SOURCES)[0]
): Promise<ParsedArticle[]> {
  try {
    const feed = await parser.parseURL(source.url)
    const maxItems = Math.min(
      feed.items?.length || 0,
      parseInt(process.env.NEWS_FETCH_COUNT || '5', 10)
    )

    return feed.items!.slice(0, maxItems).map((item) => ({
      title: item.title || '无标题',
      content: item.contentSnippet || item.content || '',
      source: source.name,
      sourceUrl: item.link || '',
      publishedAt: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
    }))
  } catch (err) {
    console.warn(`⚠️ 抓取 ${source.name} (${source.url}) 失败:`, (err as Error).message)
    return []
  }
}

/** 抓取所有 RSS 源并处理 */
export async function fetchAndProcessArticles(): Promise<number> {
  console.log('📡 开始抓取 RSS 新闻...')

  // Fetch all sources in parallel
  const sourceResults = await Promise.all(
    RSS_SOURCES.map((s) => fetchSingleSource(s))
  )
  const allArticles = sourceResults.flat()

  console.log(`📡 抓取到 ${allArticles.length} 篇文章`)

  let processed = 0
  for (const article of allArticles) {
    try {
      // Check if already exists
      const existing = await db
        .execute({
          sql: 'SELECT id FROM articles WHERE source_url = ?',
          args: [article.sourceUrl],
        })

      if (existing.rows.length > 0) {
        continue // Skip duplicates
      }

      // Find the source language
      const sourceInfo = RSS_SOURCES.find((s) => s.name === article.source)
      const isEnglish = sourceInfo?.lang === 'en'

      if (isEnglish) {
        const result = await translateAndSummarize(article.title, article.content)
        await db.execute({
          sql: `INSERT INTO articles (title, summary, translated_title, translated_summary, difficulty, source, source_url, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            article.title,
            article.content.slice(0, 500),
            result.translatedTitle,
            result.summary,
            result.difficulty,
            article.source,
            article.sourceUrl,
            article.publishedAt,
          ],
        })
      } else {
        const result = await summarizeChinese(article.title, article.content)
        await db.execute({
          sql: `INSERT INTO articles (title, summary, difficulty, source, source_url, published_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            article.title,
            result.summary,
            result.difficulty,
            article.source,
            article.sourceUrl,
            article.publishedAt,
          ],
        })
      }

      processed++
      console.log(`  ✅ [${article.source}] ${article.title.slice(0, 40)}...`)
    } catch (err) {
      console.warn(`  ⚠️ 处理文章失败: ${article.title.slice(0, 40)}...`, (err as Error).message)
    }
  }

  console.log(`✅ 成功处理 ${processed} 篇新文章`)
  return processed
}
