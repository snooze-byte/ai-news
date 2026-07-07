import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import DailyBrief from './pages/DailyBrief'
import News from './pages/News'
import Knowledge from './pages/Knowledge'
import KnowledgeDetail from './pages/KnowledgeDetail'

function App() {
  const location = useLocation()
  const isRoot = location.pathname === '/'

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <h1>📰 AI 小白每日资讯</h1>
        <p>看懂AI，从这里开始</p>
      </header>

      {/* Routes */}
      <div className="page-content">
        <Routes>
          <Route path="/" element={<DailyBrief />} />
          <Route path="/news" element={<News />} />
          <Route path="/knowledge" element={<Knowledge />} />
          <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
        </Routes>
      </div>

      {/* Tab Bar */}
      <nav className="tab-bar">
        <NavLink to="/" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <span className="tab-icon">📋</span>
          <span>今日简报</span>
        </NavLink>
        <NavLink to="/news" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <span className="tab-icon">📡</span>
          <span>新闻</span>
        </NavLink>
        <NavLink to="/knowledge" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
          <span className="tab-icon">📚</span>
          <span>知识库</span>
        </NavLink>
      </nav>
    </>
  )
}

export default App
