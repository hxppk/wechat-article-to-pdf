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
    // 使用多个CDN源确保稳定性
    const fontStyle = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap');
        * {
          font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
        }
        body, p, span, div, h1, h2, h3, h4, h5, h6, a, li, td, th {
          font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
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

    // 提取文章标题和公众号名称
    const articleInfo = await page.evaluate(() => {
      // 尝试多种方式获取标题
      let title = '';
      // 方式1: 从 title 标签获取
      const titleEl = document.querySelector('title');
      if (titleEl) {
        title = titleEl.textContent.trim();
      }
      // 方式2: 从 h1 获取
      if (!title) {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent.trim();
      }
      // 方式3: 从 meta og:title 获取
      if (!title) {
        const metaTitle = document.querySelector('meta[property="og:title"]');
        if (metaTitle) title = metaTitle.getAttribute('content') || '';
      }

      // 尝试多种方式获取公众号名称
      let author = '';
      // 方式1: 从特定class获取 (mptext API返回的HTML结构)
      const authorEl = document.querySelector('.account_nickname_inner, .wx_account_name, .rich_media_meta_nickname, .author_name, #js_name');
      if (authorEl) {
        author = authorEl.textContent.trim();
      }
      // 方式2: 从 meta 获取
      if (!author) {
        const metaAuthor = document.querySelector('meta[name="author"], meta[property="og:article:author"]');
        if (metaAuthor) author = metaAuthor.getAttribute('content') || '';
      }
      // 方式3: 从页面文本中查找 "来自" 或 "作者" 后面的内容
      if (!author) {
        const allText = document.body.innerText;
        const match = allText.match(/来自[：:]\s*([^\n]+)/);
        if (match) author = match[1].trim();
      }

      return { title, author };
    });

    console.log('文章信息:', articleInfo);

    // 清理文件名中的非法字符
    const sanitizeFilename = (str) => {
      if (!str) return '';
      return str
        .replace(/[<>:"/\\|?*]/g, '') // 移除非法字符
        .replace(/\s+/g, '_')          // 空格替换为下划线
        .substring(0, 50);             // 限制长度
    };

    // 生成文件名
    const timestamp = Date.now();
    const titlePart = sanitizeFilename(articleInfo.title) || 'wechat_article';
    const authorPart = sanitizeFilename(articleInfo.author);

    let filename;
    if (authorPart) {
      filename = `${titlePart}_${authorPart}.pdf`;
    } else {
      filename = `${titlePart}_${timestamp}.pdf`;
    }

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
