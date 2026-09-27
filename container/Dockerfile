FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json server.mjs ./

ENV HF_HOME=/app/.cache

ENV TRANSFORMERS_CACHE=/app/.cache

ENV NPM_CONFIG_UPDATE_NOTIFIER=false

EXPOSE 8788

CMD ["sh", "-c", "if [ ! -d node_modules/@huggingface/transformers ]; then npm ci; fi; exec node server.mjs"]
