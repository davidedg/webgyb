# syntax=docker/dockerfile:1.4

# Node.js major versions. Node 24 has no official linux/arm/v7 images,
# so 32-bit ARM uses the previous LTS (Astro requires Node >= 22.12).
ARG NODE_VERSION=24
ARG NODE_VERSION_ARMV7=22

# Per-architecture base images, selected below through TARGETARCH
FROM node:${NODE_VERSION}-slim AS base-amd64
FROM node:${NODE_VERSION}-slim AS base-arm64
FROM node:${NODE_VERSION_ARMV7}-slim AS base-arm

# Build stage: runs natively on the build platform (the build output is
# plain JavaScript, so it does not depend on the target architecture)
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS builder

ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building on $BUILDPLATFORM for $TARGETPLATFORM"

WORKDIR /app

# Configure npm (use the npm bundled with the Node.js image for reproducible builds)
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm config set fund false && \
    npm config set update-notifier false

# Copy package files
COPY package.json package-lock.json ./

# Install exactly what the lockfile specifies
RUN npm ci --no-audit --no-fund

# Copy source files and build the application
COPY . .
# Version shown in the UI (e.g. the release tag); defaults to package.json
ARG APP_VERSION
RUN npm run build

# Production dependencies stage: runs on the target platform, so native
# modules (better-sqlite3) and platform-specific packages match the
# architecture of the final image
FROM base-${TARGETARCH} AS deps

WORKDIR /app

# Build tools for native modules when no prebuilt binary is available
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm config set fund false && \
    npm config set update-notifier false

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Runtime stage
FROM base-${TARGETARCH} AS runner

# Install tini and curl
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tini \
    curl \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production files (owned by root, read-only for the app user)
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json .

# Set environment variables
ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production \
    BASE_PATH="" \
    TINI_SUBREAPER=true \
    NODE_OPTIONS="--max-old-space-size=1024"

# Run as the unprivileged "node" user (uid/gid 1000) provided by the base image
USER node

# Expose port
EXPOSE 3000

# Use tini as entrypoint with subreaper enabled
ENTRYPOINT ["/usr/bin/tini", "-s", "--"]
CMD ["node", "./dist/server/entry.mjs"]
