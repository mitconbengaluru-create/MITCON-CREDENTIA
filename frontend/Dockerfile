# ──────────────────────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDeps for the build step)
RUN npm ci --legacy-peer-deps

# Copy source
COPY . .

# Build production bundle
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 2: Serve with nginx
# ──────────────────────────────────────────────────────────
FROM nginx:stable-alpine AS production

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check: verify nginx is serving
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
