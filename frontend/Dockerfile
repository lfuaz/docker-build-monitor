# ----- Stage 1: Build the Vite app -----
FROM node:18-alpine3.21 AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files and build the app
COPY . .
RUN npm run build

# ----- Stage 2: Serve the app using Nginx -----
FROM nginx:alpine
# Copy the built files from the builder stage to Nginx's public directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 and run Nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]