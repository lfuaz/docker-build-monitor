FROM node:alpine

ARG PORT

RUN npm install -g pnpm

RUN apk add docker-cli docker-compose bash

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json pnpm-lock.yaml ./

RUN pnpm install

# Copy source code
COPY . .

EXPOSE ${PORT}

# Start the Express application
CMD ["pnpm", "start"]