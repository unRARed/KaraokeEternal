# Karaoke Eternal Server with YouTube search (yt-dlp + ffmpeg)

FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm pack && mv karaoke-eternal-*.tgz /karaoke-eternal.tgz

FROM node:24-alpine
ARG YTDLP_VERSION=2026.08.19

ENV NPM_CONFIG_PREFIX=/opt/.npm-global \
    PATH=/opt/.npm-global/bin:$PATH \
    NODE_ENV=production \
    KES_CONSOLE_COLORS=false \
    XDG_CACHE_HOME=/tmp/.cache

# yt-dlp runs as a Python zipapp and uses node (already present) as its JS runtime
RUN apk add --no-cache ffmpeg python3 \
  && wget -qO /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
  && chmod 755 /usr/local/bin/yt-dlp

COPY --from=build /karaoke-eternal.tgz /tmp/
RUN npm install -g --omit=dev --no-audit --no-fund /tmp/karaoke-eternal.tgz \
  && rm /tmp/karaoke-eternal.tgz \
  && npm cache clean --force

COPY docker-entrypoint.sh /usr/local/bin/

EXPOSE 8080
VOLUME /config
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["-p", "8080", "--data", "/config", "--serverLogLevel", "0", "--scannerLogLevel", "0"]
