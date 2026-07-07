import dotenv from 'dotenv'
dotenv.config()

import { initDB, db } from './db.js'
import { generateKnowledgeContent } from './services/ai.js'

const STAGE_TOPICS: Record<number, { desc: string; topics: string[] }> = {
  1: {
    desc: 'AI基础概念入门',
    topics: [
      '什么是大语言模型（LLM）？用人话解释',
      '什么是Token？为什么AI按Token收费？',
      'Prompt（提示词）是什么？怎么写好Prompt？',
      'AI能做什么不能做什么？2025年AI能力边界',
      'ChatGPT、Claude、DeepSeek有什么区别？',
    ],
  },
  2: {
    desc: '常用工具和框架',
    topics: [
      'LangChain入门：把多个AI调用串成工作流',
      '什么是向量数据库？RAG检索增强生成原理',
      '如何用AI做文档问答：从PDF到知识库',
      'Function Calling：让AI调用你的API',
      'AI编程助手对比：GitHub Copilot vs Cursor vs Claude Code',
    ],
  },
  3: {
    desc: '进阶应用与架构',
    topics: [
      'RAG架构实战：从数据清洗到线上部署',
      'AI Agent开发：让AI自己规划并执行任务',
      '模型微调（Fine-tuning）是什么？什么时候需要？',
      '多模态AI：文字+图片+语音的融合应用',
      'AI应用的成本优化：Token、缓存和模型选择',
    ],
  },
}

async function seed() {
  console.log('🌱 开始生成知识库种子数据...\n')

  // Initialize database connection and tables
  await initDB()

  // Check if knowledge_base already has content
  const existing = await db.execute('SELECT COUNT(*) as count FROM knowledge_base')
  const count = existing.rows[0]?.count as number

  if (count > 0) {
    console.log(`⚠️ 知识库已有 ${count} 条内容，跳过种子生成`)
    console.log('   如需重新生成，请先清空 knowledge_base 表')
    return
  }

  for (const stage of [1, 2, 3]) {
    const { desc, topics } = STAGE_TOPICS[stage]
    console.log(`📝 正在生成 Stage ${stage}（${desc}）内容...`)

    for (const topic of topics) {
      try {
        console.log(`  ⏳ 生成: ${topic}`)
        const { title, content } = await generateKnowledgeContent(stage, desc, topic)

        await db.execute({
          sql: 'INSERT INTO knowledge_base (stage, title, content, category) VALUES (?, ?, ?, ?)',
          args: [stage, title, content, desc],
        })

        console.log(`  ✅ ${title}`)
      } catch (err) {
        console.error(`  ❌ 生成失败: ${topic}`, (err as Error).message)
      }
    }
    console.log('')
  }

  console.log('🎉 知识库种子数据生成完成！')
  console.log(`   共生成 Stage 1~3 各 5 篇，共 15 篇文章`)
}

seed().catch((err) => {
  console.error('❌ Seed 失败:', err)
  process.exit(1)
})
