let currentDownloadUrl = '';

async function convertToPDF() {
    const urlInput = document.getElementById('articleUrl');
    const convertBtn = document.getElementById('convertBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const statusMessage = document.getElementById('statusMessage');
    const resultSection = document.getElementById('resultSection');

    const url = urlInput.value.trim();

    if (!url) {
        showStatus('请输入微信公众号文章链接', 'error');
        return;
    }

    // 简单验证是否为微信链接
    if (!url.includes('mp.weixin.qq.com')) {
        showStatus('请输入有效的微信公众号文章链接', 'error');
        return;
    }

    // 禁用按钮并显示加载状态
    convertBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    statusMessage.style.display = 'none';
    resultSection.style.display = 'none';

    try {
        showStatus('正在获取文章内容...', 'info');

        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || data.error || '转换失败');
        }

        // 转换成功
        statusMessage.style.display = 'none';
        resultSection.style.display = 'block';
        currentDownloadUrl = data.downloadUrl;

        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.onclick = () => {
            window.location.href = currentDownloadUrl;
        };

    } catch (error) {
        console.error('转换失败:', error);
        showStatus('转换失败: ' + error.message, 'error');
        resultSection.style.display = 'none';
    } finally {
        // 恢复按钮状态
        convertBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
    statusMessage.style.display = 'block';
}

// 允许按回车键提交
document.getElementById('articleUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        convertToPDF();
    }
});
