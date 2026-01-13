const express = require('express');
const cors = require('cors');
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

    // 使用 Puppeteer 直接访问微信文章并生成 PDF
    console.log('正在启动浏览器...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    const page = await browser.newPage();

    // 设置视口大小
    await page.setViewport({ width: 1200, height: 800 });

    // 设置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('正在访问微信文章...');

    // 直接访问微信文章 URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // 等待文章内容加载
    await page.waitForSelector('#js_content', { timeout: 30000 }).catch(() => {
      console.log('未找到 #js_content，尝试继续...');
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
            // 设置超时
            setTimeout(resolve, 5000);
          });
        })
      );
    });

    // 注入 CSS 优化打印效果
    await page.addStyleTag({
      content: `
        /* 隐藏不需要的元素 */
        #js_pc_qr_code, #js_share_source, .qr_code_pc_outer,
        .rich_media_tool, .wx_follow_nickname, #js_tags_preview_toast,
        .reward_area, .reward_qrcode_area, .rich_media_area_extra,
        .function_mod, #js_toobar3, #js_pc_qr_code_img,
        .wx_qrcode_iframe_wrap, .wx_profile_card_inner, #js_article_comment {
          display: none !important;
        }

        /* 优化正文样式 */
        .rich_media_content {
          max-width: 100% !important;
          padding: 0 !important;
        }

        /* 确保图片显示 */
        img {
          max-width: 100% !important;
          height: auto !important;
        }

        /* 优化打印边距 */
        body {
          padding: 20px !important;
        }
      `
    });

    // 额外等待确保样式应用
    await new Promise(resolve => setTimeout(resolve, 1000));

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
