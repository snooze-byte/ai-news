const BASE = '/api'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export interface Article {
  id: number
  title: string
  summary: string
  translated_title?: string
  translated_summary?: string
  difficulty: number
  source: string
  source_url: string
  published_at: string
  created_at: string
}

export interface ArticleListResponse {
  articles: Article[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface KnowledgeItem {
  id: number
  stage: number
  title: string
  content: string
  category: string
  created_at: string
}

export interface KnowledgeListResponse {
  items: KnowledgeItem[]
}

export interface DailyBrief {
  id: number
  date: string
  intro: string
  highlights: string[]
  articles: Article[]
  articlesCount?: number
}

export function fetchArticles(
  page = 1,
  difficulty?: number
): Promise<ArticleListResponse> {
  const params = new URLSearchParams({ page: String(page) })
  if (difficulty) params.set('difficulty', String(difficulty))
  return fetchJSON(`${BASE}/articles?${params}`)
}

export function fetchArticle(id: number): Promise<Article> {
  return fetchJSON(`${BASE}/articles/${id}`)
}

export function fetchKnowledge(stage?: number): Promise<KnowledgeListResponse> {
  const params = stage ? `?stage=${stage}` : ''
  return fetchJSON(`${BASE}/knowledge${params}`)
}

export function fetchKnowledgeItem(id: number): Promise<KnowledgeItem> {
  return fetchJSON(`${BASE}/knowledge/${id}`)
}

export function fetchDailyBrief(): Promise<DailyBrief> {
  return fetchJSON(`${BASE}/daily-brief`)
}

export function refreshNews(): Promise<{ message: string }> {
  return fetch(`${BASE}/refresh`, { method: 'POST' }).then((r) => r.json())
}
