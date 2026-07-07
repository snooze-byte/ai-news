import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchKnowledgeItem, KnowledgeItem } from '../api'

export default function KnowledgeDetail() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<KnowledgeItem | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchKnowledgeItem(parseInt(id))
      .then(setItem)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="empty">
        <p>文章未找到</p>
      </div>
    )
  }

  return (
    <div>
      <button className="back-btn" onClick={() => navigate('/knowledge')}>
        ← 返回知识库
      </button>

      <article>
        <h1 style={{ fontSize: 20, marginBottom: 12, lineHeight: 1.4 }}>{item.title}</h1>

        <div className="card-meta" style={{ marginBottom: 20 }}>
          <span
            className={`badge ${
              item.stage === 1 ? 'badge-easy' : item.stage === 2 ? 'badge-medium' : 'badge-hard'
            }`}
          >
            Stage {item.stage}
          </span>
          <span>{item.category}</span>
        </div>

        <div
          className="knowledge-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(item.content) }}
        />
      </article>
    </div>
  )
}

/** Simple markdown renderer (handles basic formatting) */
function renderMarkdown(text: string): string {
  let html = text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')

  // Wrap in paragraphs
  html = '<p>' + html + '</p>'

  // Fix nested <p> inside <pre>/<h>
  html = html.replace(/<(pre|h[1-3]|ul|ol)>[\s\S]*?<\/\1>/g, (match) =>
    match.replace(/<\/?p>/g, '')
  )

  return html
}
