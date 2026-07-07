import { createClient } from '@libsql/client'
  import dotenv from 'dotenv'

  dotenv.config()

  const DB_MODE = process.env.DB_MODE || 'remote'
  const TURSO_URL = process.env.TURSO_DATABASE_URL
  const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

  const isLocal = DB_MODE === 'local'
  let dbConnected = false

  // Build config - don't crash if remote vars are missing, just fall back to local
  let dbConfig: { url: string; authToken?: string }
  if (isLocal) {
    dbConfig = { url: 'file:local.db' }
  } else if (TURSO_URL && TURSO_TOKEN) {
    dbConfig = { url: TURSO_URL, authToken: TURSO_TOKEN }
  } else {
    console.warn('⚠️ Turso 配置不完整，回退到本地 SQLite（生产环境请检查环境变量）')
    dbConfig = { url: 'file:local.db' }
  }

  export const db = createClient(dbConfig)

  export function isDBConnected(): boolean {
    return dbConnected
  }

  export async function initDB(): Promise<boolean> {
    const label = isLocal ? '本地 SQLite' : 'Turso 云数据库'
    console.log(`🔌 正在连接 ${label}...`)

    try {
      await db.execute('SELECT 1')
      dbConnected = true
      console.log(`✅ ${label} 连接成功`)
    } catch (err) {
      console.error(`❌ ${label} 连接失败:`, err)
      console.error('服务将以降级模式运行（API可访问，数据库操作会失败）')
      return false
    }

    // Create tables
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          summary TEXT,
          translated_title TEXT,
          translated_summary TEXT,
          difficulty INTEGER CHECK(difficulty BETWEEN 1 AND 3),
          source TEXT NOT NULL,
          source_url TEXT,
          published_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)

      await db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_base (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          stage INTEGER CHECK(stage BETWEEN 1 AND 3),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          category TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)

      await db.execute(`
        CREATE TABLE IF NOT EXISTS daily_briefs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL UNIQUE,
          intro TEXT,
          highlights TEXT,
          articles_json TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `)

      console.log('✅ 数据库表初始化完成')
      return true
    } catch (err) {
      console.error('❌ 数据库表创建失败:', err)
      return false
    }
  }
