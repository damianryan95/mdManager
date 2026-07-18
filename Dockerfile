FROM node:20-alpine

# Install smbclient for SMB/Windows share access
RUN apk add --no-cache \
    samba-client \
    ca-certificates \
    tzdata

WORKDIR /app

# Install dependencies first (layer cache)
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy application code
COPY server/ ./server/
COPY client/ ./client/

# Data directory for config + search index
RUN mkdir -p /app/data

EXPOSE 3502

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3502

CMD ["node", "server/index.js"]
