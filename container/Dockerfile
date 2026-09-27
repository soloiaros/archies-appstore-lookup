FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY server.mjs ./

ENV HF_HOME=/app/.cache

ENV TRANSFORMERS_CACHE=/app/.cache

EXPOSE 8788

CMD ["node", "server.mjs"]
