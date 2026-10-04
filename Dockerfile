# syntax=docker/dockerfile:1.4

# Build stage with architecture-specific optimizations
FROM --platform=$BUILDPLATFORM node:24-slim AS builder

# Add build platform argument for better cross-compilation
ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building on $BUILDPLATFORM for $TARGETPLATFORM"

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Configure npm (use the npm bundled with the Node.js image for reproducible builds)
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm config set fund false && \
    npm config set update-notifier false

# Copy package files
COPY package.json package-lock.json ./

# Install exactly what the lockfile specifies
RUN npm ci --no-audit --no-fund

# Copy source files
COPY . .

# Build the application, then drop devDependencies from node_modules
RUN npm run build && \
    npm prune --omit=dev --no-audit --no-fund

# Runtime stage
FROM --platform=$TARGETPLATFORM node:24-slim AS runner

# Install tini and curl with platform-specific considerations
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tini \
    curl \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production files from builder (owned by root, read-only for the app user)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

# Set environment variables
ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production \
    TINI_SUBREAPER=true \
    NODE_OPTIONS="--max-old-space-size=1024"

# Run as the unprivileged "node" user (uid/gid 1000) provided by the base image
USER node

# Expose port
EXPOSE 3000

# Use tini as entrypoint with subreaper enabled
ENTRYPOINT ["/usr/bin/tini", "-s", "--"]
CMD ["node", "./dist/server/entry.mjs"]
