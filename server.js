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
app.use(express.static('public', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

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

  let browser = null;

  try {
    console.log('开始处理文章:', url);

    // Step 1: 调用第三方 API 获取 HTML
    console.log('正在从第三方 API 获取文章 HTML...');
    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `https://down.mptext.top/api/public/v1/download?url=${encodedUrl}&format=html`;

    const response = await axios.get(apiUrl, {
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });

    if (!response.data) {
      throw new Error('无法获取文章内容');
    }

    const htmlContent = response.data;
    console.log('成功获取 HTML 内容，长度:', htmlContent.length);

    // Step 2: 使用 Puppeteer 将 HTML 转换为 PDF
    console.log('正在启动浏览器...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // 设置视口大小
    await page.setViewport({ width: 1200, height: 800 });

    console.log('正在渲染 HTML...');

    // 设置 HTML 内容
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    // 使用 page.addStyleTag() 注入中文字体样式
    // 字体文件使用本地服务器 URL，避免依赖外部 CDN
    const fontUrl = `http://localhost:${PORT}/fonts/NotoSansCJKsc-Regular.otf`;
    console.log('正在注入字体样式，字体 URL:', fontUrl);

    await page.addStyleTag({
      content: `
        @font-face {
          font-family: 'Noto Sans CJK SC';
          font-style: normal;
          font-weight: 400;
          font-display: block;
          src: url('${fontUrl}') format('opentype');
        }
        * {
          font-family: 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', 'Heiti SC', sans-serif !important;
        }
      `
    });

    // 等待图片加载完成
    await page.evaluate(async () => {
      const images = document.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
            setTimeout(resolve, 5000);
          });
        })
      );
    });

    // 等待字体加载完成
    console.log('正在等待字体加载...');
    await page.evaluate(async () => {
      await document.fonts.ready;
      // 检查字体是否加载成功
      const fonts = document.fonts;
      for (const font of fonts) {
        console.log('已加载字体:', font.family, font.status);
      }
    });

    // 额外等待确保字体渲染完成（字体文件 16MB，需要更多时间）
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 生成唯一的文件名
    const timestamp = Date.now();
    const filename = `wechat_article_${timestamp}.pdf`;
    const filepath = path.join(downloadsDir, filename);

    console.log('正在生成 PDF...');

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
    browser = null;

    console.log('PDF 生成成功:', filename);

    // 返回下载链接
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
  } finally {
    if (browser) {
      await browser.close();
    }
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
  });
});

// 清理旧文件的定时任务
setInterval(() => {
  const files = fs.readdirSync(downloadsDir);
  const now = Date.now();

  files.forEach(file => {
    const filepath = path.join(downloadsDir, file);
    const stats = fs.statSync(filepath);
    const fileAge = now - stats.mtimeMs;

    if (fileAge > 60 * 60 * 1000) {
      fs.unlinkSync(filepath);
      console.log('已删除旧文件:', file);
    }
  });
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
