process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/bongda.m3u', async (req, res) => {
    try {
        let m3u = "";

        // ==========================================
        // 1. ĐỌC FILE TV TĨNH TỪ Ổ CỨNG (Nhanh & Không sợ block)
        // ==========================================
        try {
            const filePath = path.join(__dirname, 'bongda.m3u'); 
            if (fs.existsSync(filePath)) {
                m3u = fs.readFileSync(filePath, 'utf8');
            } else {
                m3u = "#EXTM3U\n";
            }
        } catch (e) {
            console.error("Lỗi đọc file local:", e);
            m3u = "#EXTM3U\n";
        }
        
        if (!m3u.endsWith('\n')) m3u += '\n';

        // ==========================================
        // 2. CÀO DỮ LIỆU TỪ HỘI QUÁN
        // ==========================================
        try {
            const resHQ = await fetch('https://sv.hoiquantv.xyz/api/v1/external/fixtures/unfinished', {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' }
            });
            const dataHQ = await resHQ.json();

            if (dataHQ.success && dataHQ.data) {
                dataHQ.data.forEach(match => {
                    const title = match.title;
                    const logo = match.homeTeam ? match.homeTeam.logoUrl : "";
                    
                    let timeDisplay = "";
                    if (match.startTime) {
                        const dateObj = new Date(match.startTime);
                        const vnTime = new Date(dateObj.getTime() + (7 * 60 * 60 * 1000));
                        const hours = String(vnTime.getUTCHours()).padStart(2, '0');
                        const minutes = String(vnTime.getUTCMinutes()).padStart(2, '0');
                        const day = String(vnTime.getUTCDate()).padStart(2, '0');
                        const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
                        timeDisplay = `[${hours}:${minutes} ${day}/${month}] `;
                    }

                    if (match.fixtureCommentators && match.fixtureCommentators.length > 0) {
                        match.fixtureCommentators.forEach(room => {
                            if (room.commentator && room.commentator.streams && room.commentator.streams.length > 0) {
                                const blvRaw = room.commentator.nickname || room.commentator.name;
                                const blvName = (blvRaw && blvRaw !== "null") ? blvRaw : "BLV Hội Quán";
                                
                                let streamUrl = "";
                                const hdStream = room.commentator.streams.find(s => s.name === "HD");
                                if (hdStream) streamUrl = hdStream.sourceUrl;
                                else if (room.commentator.streams.length > 1) streamUrl = room.commentator.streams[1].sourceUrl;
                                else streamUrl = room.commentator.streams[0].sourceUrl;

                                if (streamUrl && typeof streamUrl === 'string' && streamUrl.startsWith('http')) {
                                    m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Hội Quán", ${timeDisplay}${title} - ${blvName}\n`;
                                    m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0\n`;
                                    m3u += `#EXTVLCOPT:http-referrer=https://sv.hoiquantv.xyz/\n`;
                                    m3u += `${streamUrl}\n`;
                                }
                            }
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Lỗi cào Hội Quán:", e);
        }

        // ==========================================
        // 3. XUẤT FILE CHO TIVI
        // ==========================================
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="tong_hop.m3u"');
        res.send(m3u);

    } catch (error) {
        console.error("Lỗi Server Tổng:", error);
        res.status(500).send("Lỗi tạo playlist IPTV");
    }
});

app.listen(PORT, () => {
    console.log(`Server chạy tại port: ${PORT}`);
});
