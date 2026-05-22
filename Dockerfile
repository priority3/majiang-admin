FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/
COPY public/ ./public/

ENV PORT=3210
ENV REPO_PATH=/data/majiang-optimized

EXPOSE 3210

CMD ["node", "src/server.js"]
