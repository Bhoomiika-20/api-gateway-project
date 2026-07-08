FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

ENV NODE_ENV=production

COPY gateway ./gateway
COPY services ./services

CMD ["node", "gateway/src/index.js"]
