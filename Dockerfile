FROM node:18-bookworm-slim AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ .
RUN npm run build

FROM node:18-bookworm-slim AS server-builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:18-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/cafe.db

COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package*.json ./
COPY db.js ./
COPY server.js ./
COPY --from=client-builder /app/client/dist ./client/dist

RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "server.js"]