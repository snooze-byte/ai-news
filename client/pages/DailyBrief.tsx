import { useState, useEffect } from 'react'
import { fetchDailyBrief, DailyBrief as DailyBriefType } from '../api'
import { useNavigate } from 'react-router-dom'

export default function DailyBrief() {
  const [brief, setBrief] = useState<DailyBriefType | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchDailyBrief()
      .then(setBrief)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>加载今日简报...</span>
      </div>
    )
  }

  if (!brief || (!brief.intro && (!brief.highlights || brief.highlights.length === 0))) {
    return (
      <div className="empty">
        <div className="empty-icon">📭</div>
        <p>今日简报尚未生成</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>每天早上 8:00 自动生成，请稍后再来</p>
      </div>
    )
  }

  return (
    <div>
      {/* Brief Intro */}
      <div className="brief-intro">
        <div className="brief-date">📅 {brief.date}</div>
        <h2>☀️ 今日AI速览</h2>
        <p>{brief.intro}</p>
      </div>

      {/* Highlights */}
      {brief.highlights && brief.highlights.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>🔥 今日要点</h3>
          {brief.highlights.map((h, i) => (
            <div key={i} className="highlight-item">
              <span className="highlight-num">{i + 1}</span>
              <span className="highlight-text">{h}</span>
            </div>
          ))}
        </div>
      )}

      {/* Today's Articles */}
      {brief.articles && brief.articles.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 12, marginTop: 20 }}>
            📰 今日文章 ({brief.articles.length} 篇)
          </h3>
          {brief.articles.map((article) => {
            const difficultyLabel =
              article.difficulty === 1 ? '入门' : article.difficulty === 2 ? '进阶' : '前沿'
            const badgeClass =
              article.difficulty === 1
                ? 'badge-easy'
                : article.difficulty === 2
                ? 'badge-medium'
                : 'badge-hard'

            return (
              <div
                key={article.id}
                className="card"
                onClick={() => navigate(`/news`)}
              >
                <div className="card-title">{article.title}</div>
                <div className="card-summary">{article.summary}</div>
                <div className="card-meta">
                  <span className={`badge ${badgeClass}`}>{difficultyLabel}</span>
                  <span className="source-tag">{article.source}</span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
