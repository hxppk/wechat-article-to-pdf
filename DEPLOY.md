# 云部署详细指南

本文档提供了将应用部署到各个云平台的详细步骤。

## 推荐平台对比

| 平台 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Render** | 免费套餐、支持 Puppeteer、配置简单 | 冷启动较慢 | 推荐用于个人项目 |
| **Railway** | 部署极快、体验好 | 免费额度有限 | 小规模使用 |
| **Heroku** | 稳定可靠、生态丰富 | 需要信用卡 | 生产环境 |
| **Fly.io** | 性能好、全球分布 | 配置稍复杂 | 需要全球访问 |

---

## 1. Render.com 部署（推荐）

### 为什么选择 Render
- 免费套餐支持 Puppeteer
- 自动构建和部署
- 支持自定义域名
- 配置简单

### 部署步骤

1. **准备代码仓库**
   - 将代码推送到 GitHub/GitLab

2. **登录 Render**
   - 访问 https://render.com
   - 使用 GitHub 账号登录

3. **创建新服务**
   - 点击 "New +" → "Web Service"
   - 选择你的代码仓库
   - 授予 Render 访问权限

4. **配置服务**
   ```
   Name: wechat-article-to-pdf
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

5. **选择套餐**
   - 免费套餐即可（包含 512MB RAM）
   - 对于频繁使用，建议升级到 Starter ($7/月)

6. **环境变量**（可选）
   ```
   NODE_ENV=production
   ```

7. **部署**
   - 点击 "Create Web Service"
   - 等待构建和部署完成（首次约需 5-10 分钟）

8. **访问应用**
   - 部署完成后，Render 会提供一个 URL
   - 格式：`https://your-app-name.onrender.com`

### 注意事项
- 免费套餐会在 15 分钟无活动后休眠
- 首次访问需要等待唤醒（约 30 秒）
- 可以配置自定义域名

---

## 2. Railway 部署

### 部署步骤

1. **登录 Railway**
   - 访问 https://railway.app
   - 使用 GitHub 登录

2. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的代码仓库

3. **配置**
   - Railway 会自动检测 Node.js 项目
   - 自动设置构建命令

4. **生成域名**
   - 在项目设置中点击 "Generate Domain"
   - Railway 会提供一个公开访问的 URL

5. **环境变量**（Settings → Variables）
   ```
   NODE_ENV=production
   ```

### 注意事项
- 免费套餐有 $5 的月度额度
- 超出额度后需要升级
- 适合小规模使用

---

## 3. Heroku 部署

### 前置条件
- Heroku 账号（需要绑定信用卡，但免费套餐不收费）
- 安装 Heroku CLI

### 部署步骤

1. **安装 Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku

   # Windows
   # 下载安装器：https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **登录 Heroku**
   ```bash
   heroku login
   ```

3. **创建应用**
   ```bash
   cd wechat-article-to-pdf
   heroku create your-app-name
   ```

4. **添加 Buildpacks**（重要！支持 Puppeteer）
   ```bash
   heroku buildpacks:add jontewks/puppeteer
   heroku buildpacks:add heroku/nodejs
   ```

5. **配置环境变量**
   ```bash
   heroku config:set NODE_ENV=production
   ```

6. **初始化 Git（如果还没有）**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

7. **部署**
   ```bash
   git push heroku main
   # 如果你的分支是 master：
   # git push heroku master
   ```

8. **打开应用**
   ```bash
   heroku open
   ```

### 管理命令
```bash
# 查看日志
heroku logs --tail

# 重启应用
heroku restart

# 查看应用信息
heroku info
```

---

## 4. Fly.io 部署

### 部署步骤

1. **安装 Fly CLI**
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   # 使用 PowerShell：
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **登录**
   ```bash
   fly auth login
   ```

3. **初始化配置**
   ```bash
   cd wechat-article-to-pdf
   fly launch
   ```

4. **按提示配置**
   - 选择应用名称
   - 选择区域（建议选择离用户最近的）
   - 不创建 Postgres 数据库
   - 不创建 Redis

5. **修改 fly.toml**（如果需要）
   ```toml
   [env]
     NODE_ENV = "production"
   ```

6. **部署**
   ```bash
   fly deploy
   ```

---

## 5. DigitalOcean App Platform

### 部署步骤

1. **登录 DigitalOcean**
   - 访问 https://cloud.digitalocean.com

2. **创建 App**
   - Apps → Create App
   - 连接 GitHub 仓库

3. **配置**
   ```
   Build Command: npm install
   Run Command: npm start
   HTTP Port: 3000
   ```

4. **选择套餐**
   - 基础套餐 $5/月

5. **环境变量**
   ```
   NODE_ENV=production
   ```

6. **部署**
   - 点击 "Create Resources"

---

## 验证部署

部署完成后，测试以下功能：

1. **访问主页**
   - 确保页面正常加载

2. **测试转换**
   - 输入一个微信文章链接
   - 例如：`https://mp.weixin.qq.com/s/xxxxxxxxxxx`
   - 点击转换

3. **检查日志**
   - 查看服务器日志是否有错误

4. **下载 PDF**
   - 确保 PDF 可以正常下载
   - 检查 PDF 内容是否正确

---

## 常见问题

### 1. Puppeteer 启动失败

**错误信息**：`Error: Failed to launch the browser process`

**解决方案**：
- 确保添加了 Puppeteer buildpack（Heroku）
- 检查内存是否足够（至少 512MB）
- 添加启动参数（已在代码中配置）

### 2. 内存不足

**错误信息**：`Error: Process out of memory`

**解决方案**：
- 升级到更高的套餐
- 优化 Puppeteer 配置
- 限制并发转换数量

### 3. 请求超时

**错误信息**：`ECONNREFUSED` 或 `timeout`

**解决方案**：
- 检查第三方 API 是否可用
- 增加超时时间
- 检查网络连接

### 4. PDF 样式不正确

**解决方案**：
- 调整 PDF 生成参数
- 等待页面完全加载后再生成
- 检查 HTML 内容是否完整

---

## 性能优化建议

1. **添加缓存**
   - 缓存已转换的文章
   - 使用 Redis 存储缓存

2. **限流**
   - 防止滥用
   - 限制每 IP 的请求频率

3. **异步处理**
   - 使用消息队列
   - 后台处理转换任务

4. **CDN**
   - 使用 CDN 加速静态文件
   - 加快页面加载速度

---

## 监控和维护

1. **日志监控**
   - 定期查看应用日志
   - 使用日志聚合服务

2. **性能监控**
   - 监控内存使用
   - 监控响应时间

3. **定期更新**
   - 更新依赖包
   - 修复安全漏洞

---

## 成本估算

| 平台 | 免费套餐 | 付费套餐 | 说明 |
|------|---------|---------|------|
| Render | ✅ 512MB RAM | $7/月起 | 免费套餐会休眠 |
| Railway | $5 额度/月 | $10/月起 | 按使用量计费 |
| Heroku | ✅（需信用卡） | $7/月起 | 需要绑卡验证 |
| Fly.io | 3 台 256MB 机器 | $0.0000022/秒 | 小规模免费 |

## 推荐选择

- **个人使用/演示**：Render（免费）
- **小规模生产**：Railway 或 Render Starter
- **正式生产环境**：Heroku 或 DigitalOcean
- **需要全球访问**：Fly.io

---

需要帮助？请查看各平台的官方文档或提交 Issue。
