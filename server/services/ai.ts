import OpenAI from 'openai'
import dotenv from 'dotenv'

dotenv.config()

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1',
})

const MODEL = process.env.OPENAI_MODEL || 'deepseek-chat'

/** 调用 AI 进行文本生成 */
export async function chat(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.7
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  return response.choices[0]?.message?.content || ''
}

/** 翻译 + 摘要 + 难度分级（英文文章一步完成） */
export async function translateAndSummarize(
  title: string,
  content: string
): Promise<{
  translatedTitle: string
  summary: string
  difficulty: number
}> {
  const systemPrompt = `你是一个AI资讯编辑助手。用户会给你一篇英文AI新闻的标题和内容，请完成以下任务：
1. 将标题翻译成简洁的中文
2. 用中文写一段100-150字的摘要，让AI小白也能看懂
3. 判断内容难度：1=入门（任何人都能看懂），2=进阶（需要一定AI知识），3=前沿（涉及深度技术）

请严格按以下JSON格式回复（不要加markdown代码块）：
{"translatedTitle": "...", "summary": "...", "difficulty": 1}`

  const userPrompt = `标题：${title}\n\n内容：${content.slice(0, 3000)}`

  const result = await chat(systemPrompt, userPrompt, 0.3)
  // Try to parse JSON from response (handle possible markdown wrapping)
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // fall through
    }
  }
  // Fallback
  return {
    translatedTitle: title,
    summary: result.slice(0, 300),
    difficulty: 2,
  }
}

/** 中文文章只做摘要和分级 */
export async function summarizeChinese(
  title: string,
  content: string
): Promise<{
  summary: string
  difficulty: number
}> {
  const systemPrompt = `你是一个AI资讯编辑助手。用户会给你一篇中文AI新闻的标题和内容，请完成以下任务：
1. 用中文写一段100-150字的摘要，让AI小白也能看懂
2. 判断内容难度：1=入门，2=进阶，3=前沿

请严格按以下JSON格式回复（不要加markdown代码块）：
{"summary": "...", "difficulty": 1}`

  const userPrompt = `标题：${title}\n\n内容：${content.slice(0, 3000)}`

  const result = await chat(systemPrompt, userPrompt, 0.3)
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // fall through
    }
  }
  return {
    summary: result.slice(0, 300),
    difficulty: 2,
  }
}

/** 生成每日简报 */
export async function generateDailyBrief(
  articles: Array<{ title: string; summary: string; source: string; difficulty: number }>
): Promise<{
  intro: string
  highlights: string[]
}> {
  const systemPrompt = `你是一个AI资讯主编。用户会给你今天收集到的AI新闻列表，请你写一份"今日AI速览"简报。
要求：
1. 写一段50字以内的开头语，概括今天的AI新闻主题
2. 选出3-5条最重要的新闻，每条用一句话概括重点（30字以内）

请严格按以下JSON格式回复（不要加markdown代码块）：
{"intro": "...", "highlights": ["...", "...", "..."]}`

  const articlesText = articles
    .map((a, i) => `${i + 1}. [难度${a.difficulty}] ${a.title}（来源：${a.source}）\n  摘要：${a.summary}`)
    .join('\n\n')

  const result = await chat(systemPrompt, articlesText, 0.7)
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // fall through
    }
  }
  return {
    intro: '今日AI资讯速览，带你快速了解AI行业最新动态。',
    highlights: articles.slice(0, 5).map((a) => a.title),
  }
}

/** 生成知识库种子内容 */
export async function generateKnowledgeContent(
  stage: number,
  stageDesc: string,
  topic: string
): Promise<{
  title: string
  content: string
}> {
  const systemPrompt = `你是一个AI科普作者，正在为AI初学者编写知识库内容。

当前是 Stage ${stage}（${stageDesc}）。
主题：${topic}

要求：
1. 标题要吸引人，让人想点进去看
2. 正文 500-800 字，用通俗易懂的语言
3. Stage 1 要用比喻和生活化的例子解释概念
4. Stage 2 要介绍实际工具和简单上手步骤
5. Stage 3 要讲解架构思路和实战案例
6. 使用 Markdown 格式，适当使用小标题和列表

请严格按以下JSON格式回复（不要加markdown代码块）：
{"title": "...", "content": "..."}`

  const result = await chat(systemPrompt, topic, 0.8)
  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {
      // fall through
    }
  }
  return {
    title: topic,
    content: result,
  }
}
