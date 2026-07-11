FROM node:20-alpine
  WORKDIR /app
  COPY package.json package-lock.json* ./
  RUN npm install --production=false
  COPY . .
  RUN npm run build
  ENV NODE_ENV=production
  ENV PORT=3000
  EXPOSE 3000
  CMD ["npx","tsx","server/index.ts"]
