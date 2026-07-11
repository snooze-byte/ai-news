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

  app.use(cors({ origin: '*' }))
  app.use(express.json())

  // Health check (no DB needed)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  // ===== API Routes =====

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
      const countResult = await db.execute('SELECT COUNT(*) as total FROM articles')
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

  app.get('/api/knowledge', async (req, res) => {
    try {
      const stage = req.query.stage ? parseInt(req.query.stage as string) : undefined
      let sql = 'SELECT id, stage, title, category, created_at FROM knowledge_base'
      const args: any[] = []
      if (stage) { sql += ' WHERE stage = ?'; args.push(stage) }
      sql += ' ORDER BY stage ASC, id ASC'
      const result = await db.execute({ sql, args })
      res.json({ items: result.rows })
    } catch (err) {
      console.error('获取知识库失败:', err)
      res.status(500).json({ error: '获取知识库失败' })
    }
  })

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

  app.get('/api/daily-brief', async (_req, res) => {
    try {
      const result = await db.execute('SELECT * FROM daily_briefs ORDER BY date DESC LIMIT 1')
      if (result.rows.length === 0) {
        const brief = await generateAndSaveDailyBrief()
        res.json(brief)
        return
      }
      const row = result.rows[0]
      res.json({
        id: row.id, date: row.date, intro: row.intro,
        highlights: JSON.parse(row.highlights as string),
        articles: JSON.parse(row.articles_json as string),
      })
    } catch (err) {
      res.status(500).json({ error: '获取每日简报失败' })
    }
  })

  app.post('/api/refresh', async (_req, res) => {
    try {
      const count = await fetchAndProcessArticles()
      const brief = await generateAndSaveDailyBrief()
      res.json({ message: `成功抓取 ${count} 篇新文章`, brief })
    } catch (err) {
      res.status(500).json({ error: '刷新新闻失败' })
    }
  })
// 手动触发知识库种子（手机点一下即可）
  app.post('/api/seed', async (_req, res) => {
    res.json({ message: '知识库种子已在后台开始生成，约2分钟完成' })
    try {
      const existing = await db.execute('SELECT COUNT(*) as count FROM knowledge_base')
      if ((existing.rows[0]?.count as number || 0) > 10) {
        console.log('知识库已有足够内容，跳过')
        return
      }
      const { generateKnowledgeContent } = await import('./services/ai.js')
      const topics: Record<number, { desc: string; topics: string[] }> = {
        1: { desc: 'AI基础概念入门', topics:
  ['什么是大语言模型','Token是怎么收费的','怎么写好Prompt','AI能力边界在哪','ChatGPT和Claude和DeepSeek区别'] },
        2: { desc: '常用工具和框架', topics: ['LangChain入门','向量数据库和RAG原理','AI文档问答怎么做','Function
  Calling怎么用','AI编程助手对比'] },
        3: { desc: '进阶应用与架构', topics: ['RAG架构实战','AI
  Agent开发入门','模型微调是什么','多模态AI融合应用','AI应用成本优化'] }
      }
      for (const stage of [1,2,3]) {
        for (const topic of topics[stage].topics) {
          try {
            const { title, content } = await generateKnowledgeContent(stage, topics[stage].desc, topic)
            await db.execute({ sql: 'INSERT INTO knowledge_base (stage, title, content, category) VALUES (?,?,?,?)',
  args: [stage, title, content, topics[stage].desc] })
            console.log('  ✅ ' + title)
          } catch (e) {}
        }
      }
      console.log('📚 知识库生成完成！')
    } catch (e) { console.error('种子失败:', e) }
  })
  app.post('/api/generate-brief', async (_req, res) => {
    try {
      const brief = await generateAndSaveDailyBrief()
      res.json(brief)
    } catch (err) {
      res.status(500).json({ error: '生成简报失败' })
    }
  })

  // Serve static frontend
  const clientDistPath = path.resolve(__dirname, '..', 'dist', 'client')
  app.use(express.static(clientDistPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })

  // ===== Start =====
  async function main() {
    await initDB()
    startCronJob()

    app.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 AI小白每日资讯 服务已启动 端口:' + PORT)
    })
  }

  main().catch((err) => {
    console.error('启动失败:', err)
    process.exit(1)
  })

  export default app
