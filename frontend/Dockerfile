FROM node:18-alpine3.21 AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

CMD ["pnpm", "run", "dev"]

EXPOSE 5173