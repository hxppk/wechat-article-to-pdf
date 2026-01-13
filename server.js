const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 确保下载目录存在
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// API endpoint to convert WeChat article to PDF
app.post('/api/convert', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: '请提供微信公众号文章 URL' });
  }

  try {
    console.log('开始处理文章:', url);

    // Step 1: 调用第三方 API 获取 HTML
    console.log('正在从第三方 API 获取文章 HTML...');
    // 正确的 API: https://down.mptext.top/api/public/v1/download
    // 参数: url (需要 URL 编码), format (可选，默认 html)
    // 此接口不需要 API 密钥
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `https://down.mptext.top/api/public/v1/download?url=${encodedUrl}&format=html`;

    const response = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.data) {
      throw new Error('无法获取文章内容');
    }

    // API 直接返回 HTML 内容
    const htmlContent = response.data;

    console.log('成功获取 HTML 内容，长度:', htmlContent.length);

    // Step 2: 使用 Puppeteer 将 HTML 转换为 PDF
    console.log('正在生成 PDF...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // 设置 HTML 内容
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // 生成唯一的文件名
    const timestamp = Date.now();
    const filename = `wechat_article_${timestamp}.pdf`;
    const filepath = path.join(downloadsDir, filename);

    // 生成 PDF
    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    console.log('PDF 生成成功:', filename);

    // Step 3: 返回下载链接
    res.json({
      success: true,
      message: 'PDF 生成成功',
      downloadUrl: `/download/${filename}`,
      filename: filename
    });

  } catch (error) {
    console.error('转换失败:', error);
    res.status(500).json({
      error: '转换失败',
      message: error.message
    });
  }
});

// 下载 PDF 文件
app.get('/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(downloadsDir, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.download(filepath, filename, (err) => {
    if (err) {
      console.error('下载失败:', err);
      res.status(500).json({ error: '下载失败' });
    }

    // 下载完成后删除文件（可选）
    // fs.unlinkSync(filepath);
  });
});

// 清理旧文件的定时任务（可选）
setInterval(() => {
  const files = fs.readdirSync(downloadsDir);
  const now = Date.now();

  files.forEach(file => {
    const filepath = path.join(downloadsDir, file);
    const stats = fs.statSync(filepath);
    const fileAge = now - stats.mtimeMs;

    // 删除超过1小时的文件
    if (fileAge > 60 * 60 * 1000) {
      fs.unlinkSync(filepath);
      console.log('已删除旧文件:', file);
    }
  });
}, 30 * 60 * 1000); // 每30分钟检查一次

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
