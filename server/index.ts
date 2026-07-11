import dotenv from 'dotenv'
  dotenv.config()
  import express from 'express'
  import cors from 'cors'
  import path from 'path'
  import { fileURLToPath } from 'url'

  const app = express()
  const PORT = +(process.env.PORT || 3000)

  app.use(cors({ origin: '*' }))
  app.use(express.json())

  app.get('/api/health', (_r, res) => res.json({ ok: true }))

  app.listen(PORT, '0.0.0.0', () => console.log('OK:' + PORT))

  const __d = path.dirname(fileURLToPath(import.meta.url))

  setTimeout(() => {
    import('./db.js').then(async ({ initDB, db }) => {
      await initDB()
      const { startCronJob, generateAndSaveDailyBrief } = await import('./services/cron.js')
      const { fetchAndProcessArticles } = await import('./services/rss.js')
      startCronJob()

      const ok = (r: any) => r.json({ ok: 1 })
      const err = (_: any, r: any) => r.status(500).json({ e: 'fail' })

      app.get('/api/articles', async (q: any, r: any) => {
        try { const
  p=+q.query.page||1,ps=+q.query.pageSize||20,d=q.query.difficulty?+q.query.difficulty:0,off=(p-1)*ps;let s='SELECT
  id,COALESCE(translated_title,title)as t,COALESCE(translated_summary,summary)as
  s,difficulty,source,source_url,published_at,created_at FROM articles';const a:any[]=[];if(d){s+=' WHERE
  difficulty=?';a.push(d)}s+=' ORDER BY created_at DESC LIMIT ? OFFSET ?';a.push(ps,off);const rs=await
  db.execute({sql:s,args:a}),ct=await db.execute('SELECT COUNT(*)as n FROM
  articles');res.json({articles:rs.rows,pagination:{page:p,pageSize:ps,total:ct.rows[0]?.n as
  number,totalPages:Math.ceil((ct.rows[0]?.n as number)/ps)}})}catch(e){res.status(500).json({error:'fail'})}
      })

      app.get('/api/articles/:id', async (q: any, r: any) => {
        try { const rs=await db.execute({sql:'SELECT * FROM articles WHERE id=?',args:[q.params.id]});if(!rs.rows.length
  ){r.status(404).json({});return}r.json(rs.rows[0])}catch(e){r.status(500).json({})}
      })

      app.get('/api/knowledge', async (q: any, r: any) => {
        try { const st=q.query.stage?+q.query.stage:0;let s='SELECT id,stage,title,category,created_at FROM
  knowledge_base';const a:any[]=[];if(st){s+=' WHERE stage=?';a.push(st)}s+=' ORDER BY stage,id';const rs=await
  db.execute({sql:s,args:a});r.json({items:rs.rows})}catch(e){r.status(500).json({})}
      })

      app.get('/api/knowledge/:id', async (q: any, r: any) => {
        try { const rs=await db.execute({sql:'SELECT * FROM knowledge_base WHERE id=?',args:[q.params.id]});if(!rs.rows.
  length){r.status(404).json({});return}r.json(rs.rows[0])}catch(e){r.status(500).json({})}
      })

      app.get('/api/daily-brief', async (_: any, r: any) => {
        try { const rs=await db.execute('SELECT * FROM daily_briefs ORDER BY date DESC LIMIT
  1');if(!rs.rows.length){const b=await generateAndSaveDailyBrief();r.json(b);return}const
  w=rs.rows[0];r.json({id:w.id,date:w.date,intro:w.intro,highlights:JSON.parse(w.highlights as
  string),articles:JSON.parse(w.articles_json as string)})}catch(e){r.status(500).json({})}
      })

      app.post('/api/refresh', async (_: any, r: any) => {
        try { const n=await fetchAndProcessArticles();r.json({msg:'ok:'+n})}catch(e){r.status(500).json({})}
      })

      app.post('/api/seed', async (_: any, r: any) => {
        r.json({msg:'started'})
        try {const ex=await db.execute('SELECT COUNT(*)as c FROM knowledge_base');if((ex.rows[0]?.c as
  number||0)>10)return;const{g}=await import('./services/ai.js');const
  t:any={1:{d:'基础',t:['大语言模型是什么','Token收费原理','Prompt怎么写','AI能力边界','主流AI对比']},2:{d:'工具',t:['La
  ngChain入门','向量数据库RAG','AI文档问答','Function Calling','AI编程助手']},3:{d:'进阶',t:['RAG实战','AI
  Agent','模型微调','多模态AI','成本优化']}};for(const s of[1,2,3])for(const x of t[s].t){try{const o=await
  g(s,t[s].d,x);await db.execute({sql:'INSERT INTO knowledge_base(stage,title,content,category)VALUES(?,?,?,?)',args:[s,
  o.title,o.content,t[s].d]})}catch(e){}}console.log('done')}catch(e){}
      })

      app.use(express.static(path.resolve(__d,'..','dist','client')))
      app.get('*',(_:any,r:any)=>r.sendFile(path.resolve(__d,'..','dist','client','index.html')))
      console.log('ready')
    }).catch(e => console.error('bg fail:', e))
  }, 100)
