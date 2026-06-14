const express = require('express');
const { exec } = require('child_process');
const app = express();
// Lấy Port của Cloud cấp, nếu không có thì dùng 3000
const PORT = process.env.PORT || 3000; 

app.get('/live/:username', (req, res) => {
    const username = req.params.username;
    const tiktokUrl = `https://www.tiktok.com/@${username}/live`;

    // Nhập cái IP:PORT Việt Nam ông vừa tìm được vào đây (chú ý định dạng http hoặc socks5)
    const proxyVN = "http://115.74.159.232:1080"; 

    // Thêm cờ --proxy vào lệnh yt-dlp
    const command = `yt-dlp --proxy "${proxyVN}" -g "${tiktokUrl}"`;

    exec(command, (error, stdout, stderr) => {
        // ... (phần code bên dưới giữ nguyên) ...

    exec(command, (error, stdout, stderr) => {
        if (error || !stdout) {
            console.error(`Lỗi bắt link cho ${username}:`, stderr);
            return res.status(404).send("Idol đang không live hoặc lỗi bóc link.");
        }

        const streamUrl = stdout.trim(); 
        res.redirect(302, streamUrl); 
    });
});

app.listen(PORT, () => {
    console.log(`Server chạy tại port: ${PORT}`);
});
