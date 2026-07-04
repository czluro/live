// Ép Node.js bỏ qua lỗi bảo mật SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Chuỗi giả danh
const fakeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// =========================================================================
// ROUTE PROXY: "CẦU NỐI" BÓC VỎ LINK M3U8 ĐỂ VƯỢT TƯỜNG LỬA CHO TIVI & VLC
// =========================================================================
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const referer = req.query.ref;
    
    if (!targetUrl) return res.status(400).send("Thiếu URL");

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': fakeUserAgent,
                'Referer': referer,
                'Origin': referer
            }
        });
        
        if (!response.ok) return res.status(response.status).send("Lỗi tải luồng");

        let m3u8Text = await response.text();
        
        // Phân tích link gốc để tạo địa chỉ tuyệt đối cho các file video (.ts)
        const finalUrl = new URL(response.url);
        const basePath = finalUrl.pathname.substring(0, finalUrl.pathname.lastIndexOf('/') + 1);
        const baseUrl = `${finalUrl.protocol}//${finalUrl.host}${basePath}`;

        const lines = m3u8Text.split('\n');
        const newLines = lines.map(line => {
            let trimmed = line.trim();
            // Nếu là dòng chứa link (không bắt đầu bằng #)
            if (trimmed && !trimmed.startsWith('#')) {
                // Biến link tương đối thành tuyệt đối
                let absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
                
                // Nếu bên trong m3u8 này lại chứa m3u8 con, thì đút tiếp vào Proxy
                if (absoluteUrl.includes('.m3u8')) {
                    return `https://${req.get('host')}/proxy?url=${encodeURIComponent(absoluteUrl)}&ref=${encodeURIComponent(referer)}`;
                } else {
                    // Nếu là file video .ts, nhả thẳng cho Tivi xem (vì CDN không chặn đuôi .ts)
                    return absoluteUrl;
                }
            }
            return line;
        });

        // Trả file m3u8 đã được "làm phép" về cho Tivi
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.send(newLines.join('\n'));
    } catch (e) {
        res.status(500).send("Lỗi Proxy");
    }
});


// =========================================================================
// ROUTE CHÍNH: TẠO DANH SÁCH KÊNH (Đã nhúng qua Proxy)
// =========================================================================
app.get('/bongda.m3u', async (req, res) => {
    try {
        let m3u = "";

        // 1. CỨU LẠI DANH SÁCH TV BÌNH THƯỜNG
        const githubStaticUrl = 'https://raw.githubusercontent.com/czluro/live/main/bongda.m3u'; 
        try {
            const gitRes = await fetch(githubStaticUrl);
            if(gitRes.ok) m3u = await gitRes.text();
            else m3u = "#EXTM3U\n"; 
        } catch (e) { m3u = "#EXTM3U\n"; }
        if (!m3u.endsWith('\n')) m3u += '\n';

        const renderHost = req.get('host'); // Tự động lấy tên miền Render của ông

        // 2. CÀO HỘI QUÁN
        try {
            const resHQ = await fetch('https://sv.hoiquantv.xyz/api/v1/external/fixtures/unfinished', { 
                headers: { 'User-Agent': fakeUserAgent } 
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
                                    // Bọc link Hội Quán qua Proxy
                                    const safeLink = `https://${renderHost}/proxy?url=${encodeURIComponent(streamUrl)}&ref=${encodeURIComponent('https://sv.hoiquantv.xyz/')}`;
                                    m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Hội Quán", ${timeDisplay}${title} - ${blvName}\n`;
                                    m3u += `${safeLink}\n`;
                                }
                            }
                        });
                    }
                });
            }
        } catch (e) { console.error("Lỗi cào Hội Quán"); }


        // 3. CÀO TIÊU LÂM TV
        try {
            const tlBody = {
                limit: 50, page: 1, order_asc: "start_date",
                queries: [{ field: "blv", type: "not_equal", value: null }]
            };

            const resTL = await fetch('https://api.tlap17062026.com/matches/graph', { 
                method: 'POST',
                headers: { 'accept': '*/*', 'content-type': 'application/json', 'Referer': 'https://sv2.tieulam1.xyz/trang-chu' },
                body: JSON.stringify(tlBody) 
            });
            
            const dataTL = await resTL.json();

            if (dataTL.data) {
                for (const match of dataTL.data) {
                    const title = `${match.team_1} vs ${match.team_2}`;
                    const logo = match.team_1_logo || "";
                    const safeBlv = (match.blv && match.blv !== "null") ? match.blv : "Tiêu Lâm TV";
                    
                    let timeDisplay = "";
                    if (match.start_date) {
                        const dateParts = match.start_date.split(' '); 
                        if(dateParts.length === 2) {
                            const d = dateParts[0].split('-');
                            const t = dateParts[1].split(':');
                            const dateObj = new Date(Date.UTC(d[0], d[1]-1, d[2], t[0], t[1], t[2]));
                            const vnTime = new Date(dateObj.getTime() + (7 * 60 * 60 * 1000));
                            const hours = String(vnTime.getUTCHours()).padStart(2, '0');
                            const minutes = String(vnTime.getUTCMinutes()).padStart(2, '0');
                            const day = String(vnTime.getUTCDate()).padStart(2, '0');
                            const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
                            timeDisplay = `[${hours}:${minutes} ${day}/${month}] `;
                        }
                    }

                    // KÊNH NHÀ ĐÀI
                    if (match.source_live && typeof match.source_live === 'string' && match.source_live.startsWith('http')) {
                        const safeSourceLink = `https://${renderHost}/proxy?url=${encodeURIComponent(match.source_live)}&ref=${encodeURIComponent('https://sv2.tieulam1.xyz/')}`;
                        m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Tiêu Lâm TV", ${timeDisplay}${title} - Gốc Nhà Đài\n`;
                        m3u += `${safeSourceLink}\n`;
                    }

                    // KÊNH BLV (Gép từ stream_key)
                    let hdUrl = "";
                    if (match.stream_key) {
                        hdUrl = `https://pull.asynccdn.com/live/${match.stream_key}/index.m3u8`;
                    } else if (match.id) {
                        try {
                            const detailRes = await fetch(`https://api.tlap17062026.com/match/${match.id}/live`, {
                                headers: { 'User-Agent': fakeUserAgent, 'Referer': 'https://sv2.tieulam1.xyz/' }
                            });
                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                hdUrl = detailData.hd_1 || detailData.hd_2 || detailData.hd_3;
                            }
                        } catch (err) {}
                    }

                    if (hdUrl && typeof hdUrl === 'string' && hdUrl.startsWith('http') && hdUrl !== match.source_live) {
                        // Bọc link BLV qua Proxy
                        const safeHdLink = `https://${renderHost}/proxy?url=${encodeURIComponent(hdUrl)}&ref=${encodeURIComponent('https://sv2.tieulam1.xyz/')}`;
                        m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Tiêu Lâm TV", ${timeDisplay}${title} - ${safeBlv}\n`;
                        m3u += `${safeHdLink}\n`;
                    }
                }
            }
        } catch (e) { console.error("Lỗi cào Tiêu Lâm"); }

        // 4. XUẤT FILE
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="tong_hop.m3u"');
        res.send(m3u);

    } catch (error) {
        res.status(500).send("Lỗi Server Tổng");
    }
});

app.listen(PORT, () => {
    console.log(`Server chạy tại port: ${PORT}`);
});
