import cron from 'node-cron'
  import { generateDailyBrief, generateKnowledgeContent } from './ai.js'
  import { fetchAndProcessArticles } from './rss.js'
  import { db } from '../db.js'

  export function startCronJob() {
    cron.schedule('0 6 * * *', dailyKnowledgeUpdate, { timezone: 'Asia/Shanghai' })
    cron.schedule('30 7 * * *', async () => {
      try { const c = await fetchAndProcessArticles(); console.log('📡 新闻抓取完成:' + c) } catch (e) {
  console.error(e) }
    }, { timezone: 'Asia/Shanghai' })
    cron.schedule('0 8 * * *', generateAndSaveDailyBrief, { timezone: 'Asia/Shanghai' })
    console.log('⏰ 定时任务: 06:00知识库 07:30新闻 08:00简报')
  }

  async function dailyKnowledgeUpdate() {
    try {
      const today = new Date().toISOString().split('T')[0]
      const existing = await db.execute({ sql: 'SELECT id FROM knowledge_base WHERE date(created_at)=date(?)', args:
  [today] })
      if (existing.rows.length > 0) { console.log('📚 今日已有更新'); return }

      const pools: Record<number,{d:string;t:string[]}> = {
        1:{d:'AI基础概念入门',t:['什么是大语言模型','Token是怎么收费的','怎么写好Prompt','AI能力边界在哪','ChatGPT和Clau
  de和DeepSeek区别','AI的工作原理','什么是上下文窗口','AI幻觉是什么','温度参数怎么调','开源vs闭源模型']},
        2:{d:'常用工具和框架',t:['LangChain入门','向量数据库和RAG原理','AI文档问答怎么做','Function Calling怎么用','AI编
  程助手对比','Dify快速搭建AI应用','Ollama本地运行开源模型','Embedding模型对比','LangSmith调试AI工作流','AI
  API价格性能对比']},
        3:{d:'进阶应用与架构',t:['RAG架构实战','AI Agent开发入门','模型微调是什么','多模态AI融合应用','AI应用成本优化','
  GraphRAG知识图谱增强搜索','AI安全提示词注入防护','多Agent协作','AI应用监控评测','AI创业技术选型']}
      }
      const doy = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(),0,0).getTime())/86400000)
      const stage = ((doy % 3) + 1) as 1|2|3
      const topic = pools[stage].t[doy % pools[stage].t.length]
      const { title, content } = await generateKnowledgeContent(stage, pools[stage].d, topic)
      await db.execute({ sql: 'INSERT INTO knowledge_base(stage,title,content,category)VALUES(?,?,?,?)', args: [stage,
  title, content, pools[stage].d] })
      console.log('📚 知识库更新: ' + title)
    } catch (e) { console.error('知识库更新失败:', e) }
  }

  export async function generateAndSaveDailyBrief() {
    const today = new Date().toISOString().split('T')[0]
    try {
      const r = await db.execute({ sql: "SELECT id,title,COALESCE(translated_title,title)as
  dt,COALESCE(translated_summary,summary)as ds,difficulty,source FROM articles WHERE date(created_at)=date(?)ORDER BY
  difficulty,created_at DESC LIMIT 20", args: [today] })
      if (r.rows.length === 0) {
        const l = await db.execute('SELECT * FROM daily_briefs ORDER BY date DESC LIMIT 1')
        if (l.rows.length > 0) {
          const row = l.rows[0]
          return { id: row.id as number, date: row.date as string, intro: row.intro as string, highlights:
  JSON.parse(row.highlights as string), articlesCount: (JSON.parse(row.articles_json as string) as any[]).length }
        }
        return { id: 0, date: today, intro: '暂无今日资讯', highlights: [], articlesCount: 0 }
      }
      const arts = r.rows.map(x=>({title:x.dt as string,summary:x.ds as string,source:x.source as
  string,difficulty:x.difficulty as number}))
      const { intro, highlights } = await generateDailyBrief(arts)
      const aj =
  JSON.stringify(r.rows.map(x=>({id:x.id,title:x.dt,summary:x.ds,difficulty:x.difficulty,source:x.source})))
      await db.execute({ sql: 'INSERT OR REPLACE INTO daily_briefs(date,intro,highlights,articles_json)VALUES(?,?,?,?)',
  args: [today, intro, JSON.stringify(highlights), aj] })
      console.log('📰 简报已生成:' + today)
      return { id: 0, date: today, intro, highlights, articlesCount: arts.length }
    } catch (e) { console.error('简报生成失败:', e); return { id: 0, date: today, intro: '生成失败', highlights: [],
  articlesCount: 0 } }
  }
