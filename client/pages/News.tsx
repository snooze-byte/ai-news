import { useState, useEffect } from 'react'
import { fetchArticles, Article } from '../api'

export default function News() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchArticles(page, difficulty)
      .then((data) => {
        setArticles(data.articles)
        setTotalPages(data.pagination.totalPages)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, difficulty])

  const difficultyLabel = (d: number) =>
    d === 1 ? '🟢 入门' : d === 2 ? '🟡 进阶' : '🔴 前沿'

  const badgeClass = (d: number) =>
    d === 1 ? 'badge-easy' : d === 2 ? 'badge-medium' : 'badge-hard'

  return (
    <div>
      {/* Filter */}
      <div className="filter-bar">
        <button
          className={`filter-chip${!difficulty ? ' active' : ''}`}
          onClick={() => { setDifficulty(undefined); setPage(1) }}
        >
          全部
        </button>
        <button
          className={`filter-chip${difficulty === 1 ? ' active' : ''}`}
          onClick={() => { setDifficulty(1); setPage(1) }}
        >
          🟢 入门
        </button>
        <button
          className={`filter-chip${difficulty === 2 ? ' active' : ''}`}
          onClick={() => { setDifficulty(2); setPage(1) }}
        >
          🟡 进阶
        </button>
        <button
          className={`filter-chip${difficulty === 3 ? ' active' : ''}`}
          onClick={() => { setDifficulty(3); setPage(1) }}
        >
          🔴 前沿
        </button>
      </div>

      {/* Article List */}
      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <span>加载新闻...</span>
        </div>
      ) : articles.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📡</div>
          <p>暂无新闻</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>请稍后刷新页面或点击下方按钮获取最新资讯</p>
        </div>
      ) : (
        <>
          {articles.map((article) => (
            <div
              key={article.id}
              className="card"
              onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
            >
              <div className="card-title">{article.title}</div>
              <div className="card-summary">
                {expandedId === article.id
                  ? article.summary
                  : (article.summary || '').slice(0, 100) + '...'}
              </div>
              <div className="card-meta">
                <span className={`badge ${badgeClass(article.difficulty)}`}>
                  {difficultyLabel(article.difficulty)}
                </span>
                <span className="source-tag">{article.source}</span>
                <span>{new Date(article.published_at).toLocaleDateString('zh-CN')}</span>
              </div>
              {article.source_url && (
                <a
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 12,
                    color: 'var(--primary)',
                    marginTop: 8,
                    display: 'inline-block',
                    textDecoration: 'none',
                  }}
                >
                  查看原文 →
                </a>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button
                className="filter-chip"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, padding: '6px 8px', color: 'var(--gray-500)' }}>
                {page} / {totalPages}
              </span>
              <button
                className="filter-chip"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
