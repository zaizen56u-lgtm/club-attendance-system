document.addEventListener('DOMContentLoaded', async () => {
    const statusMessage = document.getElementById('status-message');
    
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        statusMessage.textContent = `サーバー接続成功: ${data.status}`;
        statusMessage.style.color = 'green';
    } catch (error) {
        statusMessage.textContent = 'サーバー接続エラー: サーバーが起動しているか確認してください。';
        statusMessage.style.color = 'red';
        console.error('API Error:', error);
    }
});
