import cron from 'node-cron'
import { generateDailyBrief } from './ai.js'
import { db } from '../db.js'

/** 启动每日简报定时任务 */
export function startCronJob() {
  const schedule = process.env.CRON_SCHEDULE || '0 8 * * *'

  console.log(`⏰ 每日简报定时任务已注册: ${schedule} (UTC+8)`)

  cron.schedule(schedule, async () => {
    console.log('📰 [Cron] 开始生成每日简报...')
    await generateAndSaveDailyBrief()
  }, {
    timezone: 'Asia/Shanghai',
  })
}

/** 手动生成每日简报（同时供 Cron 调用） */
export async function generateAndSaveDailyBrief(): Promise<{
  id: number
  date: string
  intro: string
  highlights: string[]
  articlesCount: number
}> {
  // Get today's articles
  const today = new Date().toISOString().split('T')[0]

  const articlesResult = await db.execute({
    sql: `SELECT id, title, COALESCE(translated_title, title) as display_title,
                 COALESCE(translated_summary, summary) as display_summary,
                 difficulty, source
          FROM articles
          WHERE date(created_at) = date(?)
          ORDER BY difficulty ASC, created_at DESC
          LIMIT 20`,
    args: [today],
  })

  if (articlesResult.rows.length === 0) {
    console.log('📰 今天没有新文章，跳过简报生成')
    // Return latest brief as fallback
    const latest = await db.execute(
      'SELECT * FROM daily_briefs ORDER BY date DESC LIMIT 1'
    )
    if (latest.rows.length > 0) {
      const row = latest.rows[0]
      return {
        id: row.id as number,
        date: row.date as string,
        intro: row.intro as string,
        highlights: JSON.parse(row.highlights as string),
        articlesCount: (JSON.parse(row.articles_json as string) as unknown[]).length,
      }
    }
    return {
      id: 0,
      date: today,
      intro: '暂无今日资讯，请稍后再来。',
      highlights: [],
      articlesCount: 0,
    }
  }

  const articles = articlesResult.rows.map((r) => ({
    title: r.display_title as string,
    summary: r.display_summary as string,
    source: r.source as string,
    difficulty: r.difficulty as number,
  }))

  // Generate brief with AI
  const { intro, highlights } = await generateDailyBrief(articles)

  // Save to database
  const articlesJson = JSON.stringify(
    articlesResult.rows.map((r) => ({
      id: r.id,
      title: r.display_title,
      summary: r.display_summary,
      difficulty: r.difficulty,
      source: r.source,
    }))
  )

  await db.execute({
    sql: `INSERT OR REPLACE INTO daily_briefs (date, intro, highlights, articles_json)
          VALUES (?, ?, ?, ?)`,
    args: [today, intro, JSON.stringify(highlights), articlesJson],
  })

  console.log(`📰 每日简报已生成: ${today}, ${articles.length} 篇文章`)

  return {
    id: 0,
    date: today,
    intro,
    highlights,
    articlesCount: articles.length,
  }
}
