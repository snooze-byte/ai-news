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

  // ===== 健康检查：秒回，不依赖任何东西 =====
  app.get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok' })
  })

  // ===== 立即启动！不等人！ =====
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 服务已启动 :' + PORT)
  })

  // ===== 后台慢慢加载数据库和路由 =====
  import('./db.js').then(async ({ initDB, db }) => {
    await initDB()

    const { startCronJob, generateAndSaveDailyBrief } = await import('./services/cron.js')
    const { fetchAndProcessArticles } = await import('./services/rss.js')

    startCronJob()

    // --- 挂载路由 ---
    app.get('/api/articles', async (req: any, res: any) => {
      try {
        const p = parseInt(req.query.page) || 1, ps = parseInt(req.query.pageSize) || 20
        const d = req.query.difficulty ? parseInt(req.query.difficulty) : undefined
        const off = (p - 1) * ps
        let s = 'SELECT id,COALESCE(translated_title,title)as t,COALESCE(translated_summary,summary)as
  s,difficulty,source,source_url,published_at,created_at FROM articles'
        const a: any[] = []
        if (d) { s += ' WHERE difficulty=?'; a.push(d) }
        s += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'; a.push(ps, off)
        const r = await db.execute({ sql: s, args: a })
        const c = await db.execute('SELECT COUNT(*)as n FROM articles')
        const t = c.rows[0]?.n as number
        res.json({ articles: r.rows, pagination: { page: p, pageSize: ps, total: t, totalPages: Math.ceil(t / ps) } })
      } catch (e) { res.status(500).json({ error: '获取失败' }) }
    })

    app.get('/api/articles/:id', async (req: any, res: any) => {
      try {
        const r = await db.execute({ sql: 'SELECT * FROM articles WHERE id=?', args: [req.params.id] })
        if (!r.rows.length) { res.status(404).json({ error: '不存在' }); return }
        res.json(r.rows[0])
      } catch (e) { res.status(500).json({ error: '获取失败' }) }
    })

    app.get('/api/knowledge', async (req: any, res: any) => {
      try {
        const st = req.query.stage ? parseInt(req.query.stage) : undefined
        let s = 'SELECT id,stage,title,category,created_at FROM knowledge_base'
        const a: any[] = []
        if (st) { s += ' WHERE stage=?'; a.push(st) }
        s += ' ORDER BY stage,id'
        const r = await db.execute({ sql: s, args: a })
        res.json({ items: r.rows })
      } catch (e) { res.status(500).json({ error: '获取失败' }) }
    })

    app.get('/api/knowledge/:id', async (req: any, res: any) => {
      try {
        const r = await db.execute({ sql: 'SELECT * FROM knowledge_base WHERE id=?', args: [req.params.id] })
        if (!r.rows.length) { res.status(404).json({ error: '不存在' }); return }
        res.json(r.rows[0])
      } catch (e) { res.status(500).json({ error: '获取失败' }) }
    })

    app.get('/api/daily-brief', async (_req: any, res: any) => {
      try {
        const r = await db.execute('SELECT * FROM daily_briefs ORDER BY date DESC LIMIT 1')
        if (!r.rows.length) { const b = await generateAndSaveDailyBrief(); res.json(b); return }
        const row = r.rows[0]
        res.json({ id: row.id, date: row.date, intro: row.intro, highlights: JSON.parse(row.highlights as string),
  articles: JSON.parse(row.articles_json as string) })
      } catch (e) { res.status(500).json({ error: '获取失败' }) }
    })

    app.post('/api/refresh', async (_req: any, res: any) => {
      try { const n = await fetchAndProcessArticles(); res.json({ message: '抓取' + n + '篇' }) } catch (e) {
  res.status(500).json({ error: '失败' }) }
    })

    app.post('/api/seed', async (_req: any, res: any) => {
      res.json({ message: '后台开始' })
      try {
        const ex = await db.execute('SELECT COUNT(*)as c FROM knowledge_base')
        if ((ex.rows[0]?.c as number || 0) > 10) return
        const { generateKnowledgeContent } = await import('./services/ai.js')
        const tp: Record<number, { d: string; t: string[] }> = {
          1: { d: 'AI基础概念', t: ['什么是大语言模型', 'Token怎么收费', '怎么写好Prompt', 'AI能力边界',
  'ChatGPT和Claude和DeepSeek区别'] },
          2: { d: '工具和框架', t: ['LangChain入门', '向量数据库和RAG', 'AI文档问答', 'Function Calling',
  'AI编程助手对比'] },
          3: { d: '进阶应用', t: ['RAG架构实战', 'AI Agent开发', '模型微调', '多模态AI', 'AI应用成本优化'] }
        }
        for (const s of [1, 2, 3]) for (const t of tp[s].t) {
          try { const x = await generateKnowledgeContent(s, tp[s].d, t); await db.execute({ sql: 'INSERT INTO
  knowledge_base(stage,title,content,category)VALUES(?,?,?,?)', args: [s, x.title, x.content, tp[s].d] }) } catch (e) {
  }
        }
        console.log('📚 知识库完成')
      } catch (e) { }
    })

    // 静态前端
    const cdp = path.resolve(__dirname, '..', 'dist', 'client')
    app.use(express.static(cdp))
    app.get('*', (_req: any, res: any) => { res.sendFile(path.join(cdp, 'index.html')) })

    console.log('✅ 路由挂载完成')
  }).catch(err => {
    console.error('后台加载失败，但服务器仍在运行:', err)
  })

  export default app
