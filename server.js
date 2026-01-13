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

    let htmlContent = response.data;
    console.log('成功获取 HTML 内容，长度:', htmlContent.length);

    // 注入中文网络字体，解决服务器无中文字体的问题
    // 使用 cdnjs 上的思源黑体，访问更稳定
    const fontStyle = `
      <style>
        @font-face {
          font-family: 'Noto Sans SC';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url('https://cdn.jsdelivr.net/npm/@aspect-build/aspect-dev-fonts@5.0.2/fonts/NotoSansSC-Regular.otf') format('opentype');
        }
        @font-face {
          font-family: 'Noto Sans SC';
          font-style: normal;
          font-weight: 700;
          font-display: swap;
          src: url('https://cdn.jsdelivr.net/npm/@aspect-build/aspect-dev-fonts@5.0.2/fonts/NotoSansSC-Bold.otf') format('opentype');
        }
        * {
          font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Heiti SC', sans-serif !important;
        }
      </style>
    `;

    // 在 <head> 中注入字体样式
    if (htmlContent.includes('<head>')) {
      htmlContent = htmlContent.replace('<head>', '<head>' + fontStyle);
    } else if (htmlContent.includes('<html>')) {
      htmlContent = htmlContent.replace('<html>', '<html><head>' + fontStyle + '</head>');
    } else {
      htmlContent = fontStyle + htmlContent;
    }

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
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // 额外等待确保渲染完成
    await new Promise(resolve => setTimeout(resolve, 3000));

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
