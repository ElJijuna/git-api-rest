# ---- Stage 1: install all dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- Stage 2: build UI + compile TypeScript ----
FROM deps AS builder
COPY tsconfig.json ./
COPY src ./src
COPY ui ./ui
COPY vite.config.ts ./
RUN npm run ui:build
RUN npm run build

# ---- Stage 3: production runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache git openssh-client ca-certificates openssl

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui/dist ./ui/dist
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /data/repos
VOLUME ["/data/repos"]

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
