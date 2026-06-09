# validator/Dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app

# NOTE: using `npm install --omit=dev` because no package-lock.json is committed
# yet. Once a lockfile exists, prefer the reproducible `npm ci --omit=dev`.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN chmod +x start.sh

# Creates the dropzone and quarantine directories the watcher expects.
RUN mkdir -p drops quarantine

# start.sh runs both the governance API (server.js) and the dropzone poller (index.js).
CMD ["sh", "start.sh"]

