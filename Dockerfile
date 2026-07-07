FROM node:20-alpine AS builder

  WORKDIR /app

  COPY package.json package-lock.json* ./
  RUN npm ci

  COPY . .
  RUN npm run build

  FROM node:20-alpine AS runner

  WORKDIR /app

  COPY --from=builder /app/server ./server
  COPY --from=builder /app/dist/client ./dist/client
  COPY --from=builder /app/package.json ./
  COPY --from=builder /app/package-lock.json ./
  COPY --from=builder /app/node_modules ./node_modules

  ENV NODE_ENV=production
  ENV PORT=3000

  EXPOSE 3000

  CMD ["npx", "tsx", "server/index.ts"]
