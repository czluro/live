const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/bongda.m3u', async (req, res) => {
    try {
        // 1. HÚT FILE TĨNH TỪ GITHUB (Thay link của ông vào đây nếu cần)
        const githubStaticUrl = 'https://raw.githubusercontent.com/czluro/live/main/bongda.m3u'; 
        let m3u = "";
        try {
            const gitRes = await fetch(githubStaticUrl);
            if(gitRes.ok) {
                m3u = await gitRes.text();
            } else {
                m3u = "#EXTM3U\n"; 
            }
        } catch (e) {
            m3u = "#EXTM3U\n";
        }

        if (!m3u.endsWith('\n')) m3u += '\n';

        // 2. CÀO DỮ LIỆU ĐỘNG TỪ HỘI QUÁN
        const response = await fetch('https://sv.hoiquantv.xyz/api/v1/external/fixtures/unfinished');
        const result = await response.json();

        // 3. XỬ LÝ VÀ NHỒI KÊNH
        if (result.success && result.data) {
            result.data.forEach(match => {
                const title = match.title;
                const status = match.isLive ? "[ĐANG LIVE]" : "[SẮP ĐÁ]";
                const logo = match.homeTeam ? match.homeTeam.logoUrl : "";
                
                // --- XỬ LÝ NGÀY GIỜ SANG MÚI GIỜ VIỆT NAM ---
                let timeDisplay = "";
                if (match.startTime) {
                    const dateObj = new Date(match.startTime);
                    // Ép sang múi giờ VN (GMT+7) vì server Render chạy giờ Mỹ
                    const vnTime = new Date(dateObj.getTime() + (7 * 60 * 60 * 1000));
                    
                    const hours = String(vnTime.getUTCHours()).padStart(2, '0');
                    const minutes = String(vnTime.getUTCMinutes()).padStart(2, '0');
                    const day = String(vnTime.getUTCDate()).padStart(2, '0');
                    const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
                    
                    // Định dạng hiển thị: [10:00 03/07]
                    timeDisplay = `[${hours}:${minutes} ${day}/${month}] `;
                }

                if (match.fixtureCommentators && match.fixtureCommentators.length > 0) {
                    match.fixtureCommentators.forEach(room => {
                        if (room.commentator && room.commentator.streams && room.commentator.streams.length > 0) {
                            const blvName = room.commentator.nickname || room.commentator.name;
                            const streamUrl = room.commentator.streams[0].sourceUrl;

                            // Nối chuỗi thêm timeDisplay vào tên kênh
                            m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Hội Quán", ${status} ${timeDisplay}${title} - ${blvName}\n`;
                            m3u += `${streamUrl}\n`;
                        }
                    });
                }
            });
        }

        // 4. TRẢ VỀ TIVI
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="tong_hop.m3u"');
        res.send(m3u);

    } catch (error) {
        console.error("Lỗi Server:", error);
        res.status(500).send("Lỗi tạo playlist IPTV");
    }
});

app.listen(PORT, () => {
    console.log(`Server chạy tại port: ${PORT}`);
});
