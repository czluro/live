// Ép Node.js bỏ qua lỗi bảo mật SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/bongda.m3u', async (req, res) => {
    try {
        let m3u = "";

        // ==========================================
        // 1. CỨU LẠI DANH SÁCH TV BÌNH THƯỜNG
        // ==========================================
        const githubStaticUrl = 'https://raw.githubusercontent.com/czluro/live/main/bongda.m3u'; 
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


        // ==========================================
        // 2. CÀO HỘI QUÁN
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
        // 3. CÀO TIÊU LÂM TV
        // ==========================================
        try {
            const tlBody = {
                limit: 50, 
                page: 1,
                order_asc: "start_date",
                queries: [
                    { field: "blv", type: "not_equal", value: null }
                ]
            };

            const resTL = await fetch('https://api.tlap17062026.com/matches/graph', { 
                method: 'POST',
                headers: { 
                    'accept': '*/*',
                    'content-type': 'application/json',
                    'Referer': 'https://sv2.tieulam1.xyz/trang-chu' 
                },
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

                    // LUỒNG GỐC NHÀ ĐÀI
                    if (match.source_live && typeof match.source_live === 'string' && match.source_live.startsWith('http')) {
                        m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Tiêu Lâm TV", ${timeDisplay}${title} - Gốc Nhà Đài\n`;
                        m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0\n`;
                        m3u += `#EXTVLCOPT:http-referrer=https://sv2.tieulam1.xyz/\n`;
                        m3u += `${match.source_live}\n`;
                    }

                    // TỰ ĐỘNG LẮP LUỒNG BLV TỪ STREAM_KEY (Nhanh và chống block)
                    let hdUrl = "";
                    if (match.stream_key) {
                        hdUrl = `https://pull.asynccdn.com/live/${match.stream_key}/index.m3u8`;
                    } else if (match.id) {
                        // Phòng hờ xui xẻo mất stream_key thì mới thèm gọi API
                        try {
                            const detailRes = await fetch(`https://api.tlap17062026.com/match/${match.id}/live`, {
                                method: 'GET',
                                headers: {
                                    'accept': '*/*',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                                    'Referer': 'https://sv2.tieulam1.xyz/'
                                }
                            });
                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                hdUrl = detailData.hd_1 || detailData.hd_2 || detailData.hd_3;
                            }
                        } catch (err) {}
                    }

                    // Lọc link HD sạch sẽ trước khi ghi
                    if (hdUrl && typeof hdUrl === 'string' && hdUrl.startsWith('http') && hdUrl !== match.source_live) {
                        m3u += `#EXTINF:-1 tvg-logo="${logo}" group-title="Tiêu Lâm TV", ${timeDisplay}${title} - ${safeBlv}\n`;
                        m3u += `#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0\n`;
                        m3u += `#EXTVLCOPT:http-referrer=https://sv2.tieulam1.xyz/\n`;
                        m3u += `${hdUrl}\n`;
                    }
                }
            }
        } catch (e) {
            console.error("Lỗi cào Tiêu Lâm:", e);
        }

        // ==========================================
        // 4. XUẤT FILE
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
