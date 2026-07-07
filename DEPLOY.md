# AI 小白每日资讯 - 部署指南

## 准备工作

部署前需要准备以下账号和服务：

### 1. Turso 数据库（免费）
1. 访问 [https://turso.tech](https://turso.tech) 注册账号
2. 安装 Turso CLI：`brew install tursodatabase/tap/turso` (Mac) 或 `curl -sSfL https://get.tur.so/install.sh | bash` (Linux)
3. 登录并创建数据库：
   ```bash
   turso auth login
   turso db create ai-news
   turso db show ai-news
   ```
4. 获取连接信息：
   ```bash
   turso db tokens create ai-news
   ```
   记录下 `TURSO_DATABASE_URL`（格式：`libsql://ai-news-xxx.turso.io`）和 `TURSO_AUTH_TOKEN`

### 2. DeepSeek API Key（用于 AI 摘要和翻译）
1. 访问 [https://platform.deepseek.com](https://platform.deepseek.com) 注册
2. 在 API Keys 页面创建一个 Key
3. 充值少量金额（几块钱即可使用很久）

---

## 方式一：Railway 一键部署（推荐）

Railway 提供免费额度，适合个人项目。

### 步骤：

1. **Fork 本项目到 GitHub**
   - 在 GitHub 创建新仓库
   - 将项目代码推送上去

2. **连接 Railway**
   - 访问 [https://railway.app](https://railway.app) 用 GitHub 登录
   - 点击 "New Project" → "Deploy from GitHub repo"
   - 选择你的仓库

3. **配置环境变量**
   - 在 Railway 项目设置中，进入 "Variables" 标签
   - 添加以下环境变量：

   | 变量名 | 值 | 说明 |
   |--------|-----|------|
   | `PORT` | `3000` | 服务端口 |
   | `TURSO_DATABASE_URL` | `libsql://xxx.turso.io` | Turso 数据库地址 |
   | `TURSO_AUTH_TOKEN` | `your_token` | Turso 认证令牌 |
   | `OPENAI_API_KEY` | `sk-xxx` | DeepSeek API Key |
   | `OPENAI_BASE_URL` | `https://api.deepseek.com/v1` | API 地址 |
   | `OPENAI_MODEL` | `deepseek-chat` | 模型名称 |
   | `CRON_SCHEDULE` | `0 8 * * *` | 简报生成时间 |
   | `NEWS_FETCH_COUNT` | `10` | 每次抓取条数 |

4. **运行种子脚本（首次部署）**
   - Railway 会自动构建和部署
   - 部署成功后，在 Railway 的 "Shell" 中运行：
     ```bash
     npm run seed
     ```
   - 这将通过 AI 生成知识库内容

5. **访问你的应用**
   - Railway 会分配一个 `xxx.railway.app` 域名
   - 在手机浏览器中打开即可访问
   - 可以绑定自己的域名（在 Railway Settings 中配置）

---

## 方式二：Render 部署

### 步骤：

1. **Push 代码到 GitHub**
2. **在 Render 创建 Web Service**
   - 访问 [https://render.com](https://render.com)
   - "New" → "Web Service" → 连接 GitHub 仓库
   - Render 会自动识别 `render.yaml` 配置

3. **配置环境变量**
   - 在 Environment 标签中添加（同 Railway 的环境变量列表）

4. **首次部署后运行 seed**
   - Render 提供 Shell 访问，运行 `npm run seed`

---

## 方式三：Docker 本地/服务器部署

### 本地 Docker：
```bash
# 1. 复制环境变量文件
cp .env.example .env
# 编辑 .env，填入真实配置

# 2. 构建并运行
docker build -t ai-news .
docker run -p 3000:3000 --env-file .env ai-news

# 3. 运行种子脚本
docker exec -it <container_id> npm run seed
```

### Docker Compose：
```bash
docker-compose up -d
docker exec -it <container_id> npm run seed
```

---

## 方式四：本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入真实配置

# 3. 初始化数据库 + 生成知识库内容
npm run seed

# 4. 启动开发服务器
npm run dev
# 后端: http://localhost:3000
# 前端: http://localhost:5173（带热更新）

# 5. 访问
# 浏览器打开 http://localhost:5173
# API 地址 http://localhost:3000/api
```

---

## 验证部署是否成功

1. 访问首页，能看到"今日简报"页面
2. 点击"新闻" Tab，能看到 RSS 抓取的内容
3. 点击"知识库" Tab，能看到 Stage 1~3 的内容
4. 调用 `POST /api/refresh` 能手动触发新闻抓取
5. 每天早上 8:00 自动更新简报

---

## 常见问题

**Q: Turso 连接失败？**
A: 检查 `TURSO_DATABASE_URL` 是否以 `libsql://` 开头，Token 是否正确。

**Q: News 页面没有内容？**
A: 调用 `POST /api/refresh` 手动触发一次抓取，等待 30 秒后刷新页面。RSS 源可能被墙，可能需要配置代理。

**Q: Seed 脚本运行很慢？**
A: Seed 脚本会调用 AI API 生成 15 篇文章，需要 2-3 分钟。请耐心等待。

**Q: 如何更换 RSS 源？**
A: 编辑 `server/services/rss.ts` 文件中的 `RSS_SOURCES` 数组，添加或修改 RSS 地址。
