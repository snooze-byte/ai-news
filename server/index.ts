import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDB, db } from './db.js'
import { fetchAndProcessArticles } from './services/rss.js'
import { startCronJob, generateAndSaveDailyBrief } from './services/cron.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)

// Middleware
app.use(cors({ origin: '*' }))
app.use(express.json())

// API routes

/** 获取新闻列表 */
app.get('/api/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string) : undefined
    const offset = (page - 1) * pageSize

    let sql = `SELECT id, COALESCE(translated_title, title) as title,
                      COALESCE(translated_summary, summary) as summary,
                      difficulty, source, source_url, published_at, created_at
               FROM articles`
    const args: any[] = []

    if (difficulty) {
      sql += ' WHERE difficulty = ?'
      args.push(difficulty)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    args.push(pageSize, offset)

    const result = await db.execute({ sql, args })

    // Count total
    let countSql = 'SELECT COUNT(*) as total FROM articles'
    const countArgs: any[] = []
    if (difficulty) {
      countSql += ' WHERE difficulty = ?'
      countArgs.push(difficulty)
    }
    const countResult = await db.execute({ sql: countSql, args: countArgs })
    const total = countResult.rows[0]?.total as number

    res.json({
      articles: result.rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (err) {
    console.error('获取文章列表失败:', err)
    res.status(500).json({ error: '获取文章列表失败' })
  }
})

/** 获取文章详情 */
app.get('/api/articles/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT id, title, summary, translated_title, translated_summary,
                   difficulty, source, source_url, published_at, created_at
            FROM articles WHERE id = ?`,
      args: [req.params.id],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('获取文章详情失败:', err)
    res.status(500).json({ error: '获取文章详情失败' })
  }
})

/** 获取知识库列表 */
app.get('/api/knowledge', async (req, res) => {
  try {
    const stage = req.query.stage ? parseInt(req.query.stage as string) : undefined

    let sql = 'SELECT id, stage, title, category, created_at FROM knowledge_base'
    const args: any[] = []

    if (stage) {
      sql += ' WHERE stage = ?'
      args.push(stage)
    }

    sql += ' ORDER BY stage ASC, id ASC'

    const result = await db.execute({ sql, args })
    res.json({ items: result.rows })
  } catch (err) {
    console.error('获取知识库失败:', err)
    res.status(500).json({ error: '获取知识库失败' })
  }
})

/** 获取知识库详情 */
app.get('/api/knowledge/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM knowledge_base WHERE id = ?',
      args: [req.params.id],
    })

    if (result.rows.length === 0) {
      res.status(404).json({ error: '文章不存在' })
      return
    }

    res.json(result.rows[0])
  } catch (err) {
    console.error('获取知识库详情失败:', err)
    res.status(500).json({ error: '获取知识库详情失败' })
  }
})

/** 获取每日简报 */
app.get('/api/daily-brief', async (_req, res) => {
  try {
    const result = await db.execute(
      'SELECT * FROM daily_briefs ORDER BY date DESC LIMIT 1'
    )

    if (result.rows.length === 0) {
      // If no brief exists, generate one
      const brief = await generateAndSaveDailyBrief()
      res.json(brief)
      return
    }

    const row = result.rows[0]
    res.json({
      id: row.id,
      date: row.date,
      intro: row.intro,
      highlights: JSON.parse(row.highlights as string),
      articles: JSON.parse(row.articles_json as string),
    })
  } catch (err) {
    console.error('获取每日简报失败:', err)
    res.status(500).json({ error: '获取每日简报失败' })
  }
})

/** 手动刷新新闻 */
app.post('/api/refresh', async (_req, res) => {
  try {
    const count = await fetchAndProcessArticles()
    // Also generate a fresh brief
    const brief = await generateAndSaveDailyBrief()
    res.json({ message: `成功抓取 ${count} 篇新文章`, brief })
  } catch (err) {
    console.error('刷新新闻失败:', err)
    res.status(500).json({ error: '刷新新闻失败' })
  }
})

/** 手动生成简报 */
app.post('/api/generate-brief', async (_req, res) => {
  try {
    const brief = await generateAndSaveDailyBrief()
    res.json(brief)
  } catch (err) {
    console.error('生成简报失败:', err)
    res.status(500).json({ error: '生成简报失败' })
  }
})

// Serve static files in production
const clientDistPath = path.resolve(__dirname, '..', 'client')
app.use(express.static(clientDistPath))

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'))
})

// Start server
async function main() {
  // Initialize database
  await initDB()

  // Start cron job for daily brief
  startCronJob()

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 AI 小白每日资讯 服务已启动`)
    console.log(`   API:  http://0.0.0.0:${PORT}/api`)
    console.log(`   前端: http://0.0.0.0:${PORT}\n`)
  })
}

main().catch((err) => {
  console.error('启动失败:', err)
  process.exit(1)
})

export default app
