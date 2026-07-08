FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY gateway ./gateway
COPY services ./services

RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY package*.json ./

CMD ["node", "dist/gateway/src/index.js"]
