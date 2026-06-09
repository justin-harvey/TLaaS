# indexer/Dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
# No committed lockfile yet -> use install; switch to `npm ci --omit=dev` once locked.
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "indexer.js"]
