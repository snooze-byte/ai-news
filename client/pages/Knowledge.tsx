import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchKnowledge, KnowledgeItem } from '../api'

export default function Knowledge() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<number>(1)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    fetchKnowledge(stage)
      .then((data) => setItems(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [stage])

  return (
    <div>
      {/* Stage Tabs */}
      <div className="stage-tabs">
        <button
          className={`stage-tab${stage === 1 ? ' active' : ''}`}
          onClick={() => setStage(1)}
        >
          🌱 Stage 1
          <br />
          <span style={{ fontSize: 10, opacity: 0.8 }}>基础概念</span>
        </button>
        <button
          className={`stage-tab${stage === 2 ? ' active' : ''}`}
          onClick={() => setStage(2)}
        >
          🛠️ Stage 2
          <br />
          <span style={{ fontSize: 10, opacity: 0.8 }}>工具框架</span>
        </button>
        <button
          className={`stage-tab${stage === 3 ? ' active' : ''}`}
          onClick={() => setStage(3)}
        >
          🚀 Stage 3
          <br />
          <span style={{ fontSize: 10, opacity: 0.8 }}>进阶应用</span>
        </button>
      </div>

      {/* Knowledge List */}
      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <span>加载知识库...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📚</div>
          <p>知识库内容尚未生成</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>请运行 npm run seed 初始化内容</p>
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="card"
            onClick={() => navigate(`/knowledge/${item.id}`)}
          >
            <div className="card-title">{item.title}</div>
            <div className="card-meta">
              <span
                className={`badge ${
                  item.stage === 1 ? 'badge-easy' : item.stage === 2 ? 'badge-medium' : 'badge-hard'
                }`}
              >
                Stage {item.stage}
              </span>
              <span>{item.category}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
