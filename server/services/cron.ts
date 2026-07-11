import cron from 'node-cron'
  import { generateDailyBrief } from './ai.js'
  import { generateKnowledgeContent } from './ai.js'
  import { fetchAndProcessArticles } from './rss.js'
  import { db } from '../db.js'

  /** 启动所有定时任务 */
  export function startCronJob() {
    // 每天 6:00 更新知识库（新增一篇）
    cron.schedule('0 6 * * *', async () => {
      console.log('📚 [Cron] 每日知识库更新...')
      await dailyKnowledgeUpdate()
    }, { timezone: 'Asia/Shanghai' })

    // 每天 7:30 自动抓取新闻
    cron.schedule('30 7 * * *', async () => {
      console.log('📡 [Cron] 每日新闻抓取...')
      try {
        const count = await fetchAndProcessArticles()
        console.log(`📡 [Cron] 抓取完成，新增 ${count} 篇`)
      } catch (err) {
        console.error('📡 [Cron] 新闻抓取失败:', err)
      }
    }, { timezone: 'Asia/Shanghai' })

    // 每天 8:00 生成每日简报
    cron.schedule('0 8 * * *', async () => {
      console.log('📰 [Cron] 开始生成每日简报...')
      await generateAndSaveDailyBrief()
    }, { timezone: 'Asia/Shanghai' })

    console.log('⏰ 定时任务已注册:')
    console.log('   06:00 - 每日知识库更新')
    console.log('   07:30 - 每日新闻抓取')
    console.log('   08:00 - 每日简报生成')
  }

  /** 每日知识库更新：每天新增一篇，轮流切换Stage */
  async function dailyKnowledgeUpdate() {
    try {
      const stageTopics: Record<number, { desc: string; topics: string[] }> = {
        1: {
          desc: 'AI基础概念入门',
          topics: [
            '什么是大语言模型（LLM）？用人话解释',
            '什么是Token？为什么AI按Token收费？',
            'Prompt（提示词）是什么？怎么写好Prompt？',
            'AI能做什么不能做什么？AI能力边界',
            'ChatGPT、Claude、DeepSeek有什么区别？',
            'AI的工作原理：从输入到输出',
            '什么是上下文窗口？为什么越长越贵？',
            'AI幻觉是什么？为什么AI会胡说八道？',
            '温度参数（Temperature）是什么？怎么调？',
            '开源模型 vs 闭源模型：选哪个？',
          ]
        },
        2: {
          desc: '常用工具和框架',
          topics: [
            'LangChain入门：把多个AI调用串成工作流',
            '什么是向量数据库？RAG检索增强生成原理',
            '如何用AI做文档问答：从PDF到知识库',
            'Function Calling：让AI调用你的API',
            'AI编程助手对比：GitHub Copilot vs Cursor vs Claude Code',
            'Dify快速搭建AI应用：零代码也能玩',
            'Ollama本地运行开源模型指南',
            'Embedding模型对比：选哪个做语义搜索？',
            'LangSmith调试AI工作流',
            'AI API选型：各大模型价格性能对比',
          ]
        },
        3: {
          desc: '进阶应用与架构',
          topics: [
            'RAG架构实战：从数据清洗到线上部署',
            'AI Agent开发：让AI自己规划并执行任务',
            '模型微调（Fine-tuning）是什么？什么时候需要？',
            '多模态AI：文字+图片+语音的融合应用',
            'AI应用的成本优化：Token、缓存和模型选择',
            'GraphRAG：用知识图谱增强AI搜索',
            'AI安全攻防：提示词注入与防护',
            '多Agent协作：让多个AI配合干活',
            'AI应用监控与评测体系搭建',
            '从零到一：AI创业项目的技术选型',
          ]
        }
      }

      // 轮换 Stage（根据当天日期）
      const today = new Date()
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
      const stage = (dayOfYear % 3) + 1 as 1 | 2 | 3
      const { desc, topics } = stageTopics[stage]
      const topicIndex = dayOfYear % topics.length
      const topic = topics[topicIndex]

      // 检查今天是否已生成
      const dateStr = today.toISOString().split('T')[0]
      const existing = await db.execute({
        sql: 'SELECT id FROM knowledge_base WHERE date(created_at) = date(?)',
        args: [dateStr]
      })
      if (existing.rows.length > 0) {
        console.log(`📚 今天已有 ${existing.rows.length} 篇知识库更新，跳过`)
        return
      }

      console.log(`📚 今日主题: Stage ${stage} - ${topic}`)
      const { title, content } = await generateKnowledgeContent(stage, desc, topic)
      await db.execute({
        sql: 'INSERT INTO knowledge_base (stage, title, content, category) VALUES (?, ?, ?, ?)',
        args: [stage, title, content, desc]
      })
      console.log(`📚 知识库更新完成: ${title}`)
    } catch (err) {
      console.error('📚 知识库更新失败:', err)
    }
  }

  /** 手动/定时生成每日简报 */
  export async function generateAndSaveDailyBrief(): Promise<{
    id: number
    date: string
    intro: string
    highlights: string[]
    articlesCount: number
  }> {
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
      console.log('📰 今天没有新文章')
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
          articlesCount: (JSON.parse(row.articles_json as string) as any[]).length,
        }
      }
      return { id: 0, date: today, intro: '暂无今日资讯，请稍后再来。', highlights: [], articlesCount: 0 }
    }

    const articles = articlesResult.rows.map((r) => ({
      title: r.display_title as string,
      summary: r.display_summary as string,
      source: r.source as string,
      difficulty: r.difficulty as number,
    }))

    const { intro, highlights } = await generateDailyBrief(articles)

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
      sql: `INSERT OR REPLACE INTO daily_briefs (date, intro, highlights, articles_json) VALUES (?, ?, ?, ?)`,
      args: [today, intro, JSON.stringify(highlights), articlesJson],
    })

    console.log(`📰 每日简报已生成: ${today}, ${articles.length} 篇文章`)
    return { id: 0, date: today, intro, highlights, articlesCount: articles.length }
  }

  /** 手动触发知识库更新 */
  export { dailyKnowledgeUpdate }
