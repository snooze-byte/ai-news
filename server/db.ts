import { createClient } from '@libsql/client'
import dotenv from 'dotenv'

dotenv.config()

const TURSO_URL = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ 缺少 Turso 数据库配置，请检查 .env 文件中的 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN')
  process.exit(1)
}

export const db = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
})

export async function initDB() {
  console.log('🔌 正在连接 Turso 数据库...')

  try {
    // Test connection
    await db.execute('SELECT 1')
    console.log('✅ Turso 数据库连接成功')
  } catch (err) {
    console.error('❌ Turso 数据库连接失败:', err)
    console.error('请检查 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN 是否正确')
    process.exit(1)
  }

  // Create tables
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
}
