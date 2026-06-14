FROM node:18-alpine
# Cài đặt Python3 và thư viện cần thiết cho yt-dlp
RUN apk add --no-cache python3 ffmpeg curl
# Tải yt-dlp bản mới nhất
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
