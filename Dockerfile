# syntax=docker/dockerfile:1.4

# Build stage with architecture-specific optimizations
FROM --platform=$BUILDPLATFORM node:20-slim AS builder

# Add build platform argument for better cross-compilation
ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building on $BUILDPLATFORM for $TARGETPLATFORM"

WORKDIR /app

# Install build dependencies including sharp requirements
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Update npm and configure settings (with platform-specific optimizations)
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm install -g npm@latest && \
    npm config set fund false && \
    npm config set update-notifier false

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM --platform=$TARGETPLATFORM node:20-slim AS runner

# Install tini and curl with platform-specific considerations
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tini \
    curl \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .

# Set environment variables
ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production \
    TINI_SUBREAPER=true \
    NODE_OPTIONS="--max-old-space-size=1024"

# Expose port
EXPOSE 3000

# Use tini as entrypoint with subreaper enabled
ENTRYPOINT ["/usr/bin/tini", "-s", "--"]
CMD ["node", "./dist/server/entry.mjs"] 