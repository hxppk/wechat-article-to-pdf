# 微信公众号文章转 PDF

一个简单的 Web 应用，可以将微信公众号文章转换为高质量的 PDF 文件。

## 功能特点

- 输入微信公众号文章 URL
- 自动获取文章内容（通过第三方 API）
- 使用 Puppeteer 生成高质量 PDF
- 现代化的用户界面
- 自动清理过期文件

## 技术栈

- **后端**: Node.js + Express
- **PDF 生成**: Puppeteer
- **前端**: HTML + CSS + JavaScript
- **HTTP 请求**: Axios

## 安装步骤

1. 克隆或下载项目

2. 安装依赖：
```bash
npm install
```

3. 启动服务器：
```bash
npm start
```

4. 访问应用：
打开浏览器访问 `http://localhost:3000`

## 使用方法

1. 在输入框中粘贴微信公众号文章链接
2. 点击"转换为 PDF"按钮
3. 等待转换完成
4. 点击"下载 PDF"按钮下载文件

## 环境变量

可以通过环境变量配置端口：

```bash
PORT=3000 npm start
```

## 云部署指南

### Render.com 部署

1. 注册 [Render](https://render.com) 账号

2. 创建新的 Web Service

3. 连接你的 Git 仓库

4. 配置构建设置：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

5. 环境变量设置：
   - `NODE_ENV`: `production`

6. 部署完成后，Render 会提供一个访问 URL

### Heroku 部署

1. 安装 Heroku CLI

2. 登录 Heroku：
```bash
heroku login
```

3. 创建新应用：
```bash
heroku create your-app-name
```

4. 添加 Puppeteer buildpack：
```bash
heroku buildpacks:add jontewks/puppeteer
heroku buildpacks:add heroku/nodejs
```

5. 部署：
```bash
git push heroku main
```

### Railway 部署

1. 注册 [Railway](https://railway.app) 账号

2. 创建新项目，选择从 GitHub 导入

3. Railway 会自动检测 Node.js 项目并部署

4. 部署完成后，点击 "Generate Domain" 获取访问链接

### Vercel 部署（需要调整）

Vercel 主要用于 Serverless 函数，不太适合运行 Puppeteer。建议使用上述其他平台。

## 注意事项

1. **API 限制**: 使用的第三方 API (https://down.mptext.top/dashboard/api) 可能有请求限制，请适度使用

2. **内存使用**: Puppeteer 需要较多内存，确保服务器有足够的资源

3. **文件清理**: 服务器会自动清理超过 1 小时的 PDF 文件

4. **云部署考虑**:
   - 确保服务器支持 Chromium（Puppeteer 需要）
   - 配置足够的内存（至少 512MB，推荐 1GB）
   - 某些平台可能需要额外的 buildpack 或配置

## API 端点

### POST /api/convert

转换微信文章为 PDF

**请求体：**
```json
{
  "url": "https://mp.weixin.qq.com/s/..."
}
```

**响应：**
```json
{
  "success": true,
  "message": "PDF 生成成功",
  "downloadUrl": "/download/wechat_article_1234567890.pdf",
  "filename": "wechat_article_1234567890.pdf"
}
```

### GET /download/:filename

下载生成的 PDF 文件

## 常见问题

### Puppeteer 安装失败

如果 Puppeteer 安装失败，可以尝试：

```bash
npm install --verbose
```

或者设置环境变量跳过 Chromium 下载，然后手动安装：

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
```

### 云部署时 Puppeteer 无法运行

确保添加了正确的 buildpack 或系统依赖。对于 Render 和 Railway，通常需要添加以下依赖包。

创建 `render.yaml` (Render) 或确保平台支持 Puppeteer 运行环境。

## 项目结构

```
wechat-article-to-pdf/
├── server.js           # 主服务器文件
├── package.json        # 项目依赖配置
├── public/             # 前端静态文件
│   ├── index.html      # 主页面
│   ├── style.css       # 样式文件
│   └── script.js       # 前端逻辑
├── downloads/          # PDF 文件存储目录（自动创建）
└── README.md          # 项目说明
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
