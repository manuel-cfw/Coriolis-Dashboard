# ── Build ────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "server/index.mjs"]
