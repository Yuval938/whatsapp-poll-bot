FROM node:20-slim

# Install Chromium for whatsapp-web.js
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-khmeros \
    fonts-kacst \
    fonts-freefont-ttf \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY tsconfig.json config.yaml ./
COPY src/ ./src/

RUN npx tsc

EXPOSE 3000

# Health check endpoint (optional, add later)
# HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]