const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// API tạo file M3U tự động cho Hội Quán
app.get('/bongda.m3u', async (req, res) => {
    try {
        // Gọi API gốc của web để lấy dữ liệu
        const response = await fetch('https://sv.hoiquantv.xyz/api/v1/external/fixtures/unfinished');
        const result = await response.json();

        // Bắt đầu viết nội dung file M3U
        let m3u = "#EXTM3U\n";

        if (result.success && result.data) {
            result.data.forEach(match => {
                const title = match.title;
                const status = match.isLive ? "[ĐANG LIVE]" : "[SẮP ĐÁ]";
                const logo = match.homeTeam ? match.homeTeam.logoUrl : "";

                // Kiểm tra xem trận đấu có gán BLV không
                if (match.fixtureCommentators && match.fixtureCommentators.length > 0) {
                    // Lặp qua từng phòng của các BLV trong trận đó
                    match.fixtureCommentators.forEach(room => {
                        if (room.commentator && room.commentator.streams && room.commentator.streams.length > 0) {
                            const blvName = room.commentator.nickname || room.commentator.name;
                            // Thường ưu tiên lấy luồng đầu tiên (FHD)
                            const streamUrl = room.commentator.streams[0].sourceUrl;

                            // Ép chuẩn M3U
                            m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Trực Tiếp Bóng Đá", ${status} ${title} - ${blvName}\n`;
                            m3u += `${streamUrl}\n`;
                        }
                    });
                }
            });
        }

        // Định dạng Header để Tivi hiểu đây là file Playlist chứ không phải chữ web
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="hoiquan.m3u"');
        
        // Trả file về cho người xem
        res.send(m3u);

    } catch (error) {
        console.error("Lỗi khi cào API:", error);
        res.status(500).send("Lỗi tạo playlist IPTV");
    }
});

app.listen(PORT, () => {
    console.log(`Dynamic IPTV Server chạy tại port: ${PORT}`);
});
