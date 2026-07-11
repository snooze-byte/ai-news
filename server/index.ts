import dotenv from 'dotenv'
  dotenv.config()

  import express from 'express'
  import cors from 'cors'
  import path from 'path'
  import { fileURLToPath } from 'url'

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const app = express()
  const PORT = parseInt(process.env.PORT || '3000', 10)

  app.use(cors({ origin: '*' }))
  app.use(express.json())

  // Health check - 秒回，不依赖任何东西
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // ===== 先启动服务器 =====
  app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 服务已启动 端口:' + PORT)
  })

  // ===== 后台初始化（不阻塞） =====
  setTimeout(async () => {
    try {
      const { initDB, db } = await import('./db.js')
      await initDB()

      const { startCronJob, generateAndSaveDailyBrief } = await import('./services/cron.js')
      startCronJob()

      const { fetchAndProcessArticles } = await import('./services/rss.js')

      // ---- API Routes ----

      app.get('/api/articles', async (req, res) => {
        try {
          const page = parseInt(req.query.page as string) || 1
          const pageSize = parseInt(req.query.pageSize as string) || 20
          const difficulty = req.query.difficulty ? parseInt(req.query.difficulty as string) : undefined
          const offset = (page - 1) * pageSize
          let sql = 'SELECT id, COALESCE(translated_title, title) as title, COALESCE(translated_summary, summary) as
  summary, difficulty, source, source_url, published_at, created_at FROM articles'
          const args: any[] = []
          if (difficulty) { sql += ' WHERE difficulty = ?'; args.push(difficulty) }
          sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
          args.push(pageSize, offset)
          const result = await db.execute({ sql, args })
          const countResult = await db.execute('SELECT COUNT(*) as total FROM articles')
          const total = countResult.rows[0]?.total as number
          res.json({ articles: result.rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize)
  } })
        } catch (err) {
          res.status(500).json({ error: '获取文章列表失败' })
        }
      })

      app.get('/api/articles/:id', async (req, res) => {
        try {
          const result = await db.execute({ sql: 'SELECT * FROM articles WHERE id = ?', args: [req.params.id] })
          if (result.rows.length === 0) { res.status(404).json({ error: '文章不存在' }); return }
          res.json(result.rows[0])
        } catch (err) { res.status(500).json({ error: '获取详情失败' }) }
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
        } catch (err) { res.status(500).json({ error: '获取知识库失败' }) }
      })

      app.get('/api/knowledge/:id', async (req, res) => {
        try {
          const result = await db.execute({ sql: 'SELECT * FROM knowledge_base WHERE id = ?', args: [req.params.id] })
          if (result.rows.length === 0) { res.status(404).json({ error: '文章不存在' }); return }
          res.json(result.rows[0])
        } catch (err) { res.status(500).json({ error: '获取详情失败' }) }
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
          res.json({ id: row.id, date: row.date, intro: row.intro, highlights: JSON.parse(row.highlights as string),
  articles: JSON.parse(row.articles_json as string) })
        } catch (err) { res.status(500).json({ error: '获取简报失败' }) }
      })

      app.post('/api/refresh', async (_req, res) => {
        try {
          const count = await fetchAndProcessArticles()
          res.json({ message: '成功抓取 ' + count + ' 篇新文章' })
        } catch (err) { res.status(500).json({ error: '刷新失败' }) }
      })

      // 手动种子
      app.post('/api/seed', async (_req, res) => {
        res.json({ message: '后台开始生成知识库，约2分钟' })
        try {
          const existing = await db.execute('SELECT COUNT(*) as c FROM knowledge_base')
          if ((existing.rows[0]?.c as number || 0) > 10) return
          const { generateKnowledgeContent } = await import('./services/ai.js')
          const topics: Record<number,{d:string;t:string[]}> = {
            1:{d:'AI基础概念入门',t:['什么是大语言模型','Token是怎么收费的','怎么写好Prompt','AI能力边界在哪','ChatGPT和
  Claude和DeepSeek区别']},
            2:{d:'常用工具和框架',t:['LangChain入门','向量数据库和RAG原理','AI文档问答怎么做','Function
  Calling怎么用','AI编程助手对比']},
            3:{d:'进阶应用与架构',t:['RAG架构实战','AI
  Agent开发入门','模型微调是什么','多模态AI融合应用','AI应用成本优化']}
          }
          for(const s of [1,2,3]){for(const t of topics[s].t){try{const r=await
  generateKnowledgeContent(s,topics[s].d,t);await db.execute({sql:'INSERT INTO
  knowledge_base(stage,title,content,category)VALUES(?,?,?,?)',args:[s,r.title,r.content,topics[s].d]})}catch(e){}}}
          console.log('📚 知识库生成完成')
        } catch(e){}
      })

      console.log('✅ 后端API初始化完成')

      // Serve static frontend
      const clientDistPath = path.resolve(__dirname, '..', 'dist', 'client')
      app.use(express.static(clientDistPath))
      app.get('*', (_req, res) => { res.sendFile(path.join(clientDistPath, 'index.html')) })

    } catch (err) {
      console.error('后台初始化失败（服务器仍在运行）:', err)
    }
  }, 500)

  export default app
