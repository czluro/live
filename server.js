const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/bongda.m3u', async (req, res) => {
    try {
        let m3u = "#EXTM3U\n";

        // CẤU HÌNH HEADERS GIẢ DANH TRÌNH DUYỆT
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            'Referer': 'https://sv2.tieulam1.xyz/'
        };

        // 1. CÀO DỮ LIỆU TỪ HỘI QUÁN
        try {
            const resHQ = await fetch('https://sv.hoiquantv.xyz/api/v1/external/fixtures/unfinished');
            const dataHQ = await resHQ.json();
            if (dataHQ.success && dataHQ.data) {
                dataHQ.data.forEach(match => {
                    if (match.fixtureCommentators) {
                        match.fixtureCommentators.forEach(room => {
                            if (room.commentator && room.commentator.streams && room.commentator.streams.length > 0) {
                                let url = room.commentator.streams.find(s => s.name === "HD")?.sourceUrl || room.commentator.streams[0].sourceUrl;
                                m3u += `#EXTINF:-1 group-title="Hội Quán", ${match.title} - ${room.commentator.nickname}\n`;
                                m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0...\n#EXTVLCOPT:http-referrer=https://sv.hoiquantv.xyz/\n${url}\n`;
                            }
                        });
                    }
                });
            }
        } catch (e) { console.error("Lỗi Hội Quán"); }

        // 2. CÀO DỮ LIỆU TỪ TIÊU LÂM TV
        try {
            const resTL = await fetch('https://api.tlap17062026.com/matches/graph', { headers });
            const dataTL = await resTL.json();
            if (dataTL.data) {
                dataTL.data.forEach(match => {
                    // Tiêu Lâm TV trả về json trực tiếp theo cấu trúc thấy trong image_c226f6.png
                    const title = `${match.team_1} vs ${match.team_2}`;
                    const url = match.source_live;
                    m3u += `#EXTINF:-1 group-title="Tiêu Lâm TV", ${title} - ${match.blv}\n`;
                    m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0...\n#EXTVLCOPT:http-referrer=https://sv2.tieulam1.xyz/\n${url}\n`;
                });
            }
        } catch (e) { console.error("Lỗi Tiêu Lâm"); }

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.send(m3u);
    } catch (error) {
        res.status(500).send("Lỗi Server");
    }
});

app.listen(PORT, () => console.log(`Server Mixer chạy tại port: ${PORT}`));
