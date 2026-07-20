# ==========================================
# Stage 1: Build & Dependencies Compiler
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apk add --no-cache libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies including devDependencies for Prisma generate step
RUN npm ci

# Generate Prisma Client binaries
RUN npx prisma generate

# ==========================================
# Stage 2: Production Execution Environment
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install curl for healthchecks
RUN apk add --no-cache curl

# Create non-privileged system user for running app safely
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/
COPY scripts ./scripts/

# Copy compiled dependencies and prisma client
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Ensure scripts have execution rights and folder belongs to nodejs
RUN chmod +x scripts/*.sh && \
    chown -R nodejs:nodejs /usr/src/app

USER nodejs

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
