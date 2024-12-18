#!/bin/bash

# Set strict error handling
set -euo pipefail
IFS=$'\n\t'

# Default values
REGISTRY=""
VERSION="latest"
PLATFORMS="linux/amd64,linux/arm64,linux/arm/v7"
PUSH=false
BUILD_ALL=true
BUILDER_NAME="webgyb-multiarch"
CLEANUP=false

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help                Show this help message"
    echo "  -r, --registry REGISTRY   Docker registry (e.g., 'username/' or 'registry.example.com/')"
    echo "  -v, --version VERSION     Image version tag (default: latest)"
    echo "  -p, --platform PLATFORM   Build for specific platform (amd64, arm64, or armv7)"
    echo "  --push                    Push images to registry"
    echo "  --cleanup                 Remove builders and temporary containers after build"
    echo ""
    echo "Examples:"
    echo "  $0                        # Build all architectures locally"
    echo "  $0 -p amd64              # Build only AMD64 architecture"
    echo "  $0 -r username/ --push    # Build all and push to Docker Hub"
    echo "  $0 --cleanup             # Clean up all builders and temporary containers"
}

# Log function
log() {
    local level=$1
    shift
    case $level in
        "info")
            echo -e "${GREEN}[INFO]${NC} $*"
            ;;
        "warn")
            echo -e "${YELLOW}[WARN]${NC} $*"
            ;;
        "error")
            echo -e "${RED}[ERROR]${NC} $*"
            ;;
    esac
}

# Error handler
error_handler() {
    log "error" "An error occurred on line $1"
    cleanup_resources
    exit 1
}

trap 'error_handler ${LINENO}' ERR

# Cleanup function
cleanup_resources() {
    log "info" "Cleaning up resources..."
    
    # Stop and remove any running webgyb containers
    local containers
    containers=$(docker ps -a --filter "ancestor=webgyb" --format "{{.ID}}" 2>/dev/null || true)
    if [ -n "$containers" ]; then
        log "info" "Stopping and removing webgyb containers..."
        echo "$containers" | xargs docker stop >/dev/null 2>&1 || true
        echo "$containers" | xargs docker rm >/dev/null 2>&1 || true
    fi

    # Remove buildx builders
    log "info" "Removing buildx builders..."
    docker buildx rm "$BUILDER_NAME" >/dev/null 2>&1 || true
    docker buildx rm multiplatform-builder >/dev/null 2>&1 || true

    log "info" "Cleanup completed"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -p|--platform)
            case $2 in
                amd64)
                    PLATFORMS="linux/amd64"
                    ;;
                arm64)
                    PLATFORMS="linux/arm64"
                    ;;
                armv7)
                    PLATFORMS="linux/arm/v7"
                    ;;
                *)
                    log "error" "Invalid platform. Use amd64, arm64, or armv7"
                    exit 1
                    ;;
            esac
            BUILD_ALL=false
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        *)
            log "error" "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Setup buildx
setup_buildx() {
    log "info" "Setting up Docker Buildx..."
    if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
        docker buildx create --name "$BUILDER_NAME" --driver docker-container --bootstrap
    fi
    docker buildx use "$BUILDER_NAME"
}

# Function to build for a specific platform
build_platform() {
    local platform=$1
    local tag_suffix=$2
    log "info" "Building for $platform..."
    
    if [ "$PUSH" = true ]; then
        log "info" "Building and pushing for $platform..."
        docker buildx build --platform "$platform" \
            -t "${REGISTRY}webgyb:${VERSION}-${tag_suffix}" \
            -t "${REGISTRY}webgyb:latest-${tag_suffix}" \
            --push .
    else
        log "info" "Building locally for $platform..."
        docker buildx build --platform "$platform" \
            -t "webgyb:${tag_suffix}" \
            --load .
    fi
}

# Main build process
main() {
    # If only cleanup is requested
    if [ "$CLEANUP" = true ] && [ "$BUILD_ALL" = true ] && [ "$PUSH" = false ]; then
        cleanup_resources
        exit 0
    fi

    setup_buildx

    if [ "$BUILD_ALL" = true ]; then
        if [ "$PUSH" = true ]; then
            log "info" "Building and pushing all architectures..."
            docker buildx build --platform "$PLATFORMS" \
                -t "${REGISTRY}webgyb:${VERSION}" \
                -t "${REGISTRY}webgyb:latest" \
                --push .
        else
            log "info" "Building all architectures locally..."
            build_platform "linux/amd64" "amd64"
            build_platform "linux/arm64" "arm64"
            build_platform "linux/arm/v7" "armv7"
        fi
    else
        case $PLATFORMS in
            "linux/amd64")
                build_platform "$PLATFORMS" "amd64"
                ;;
            "linux/arm64")
                build_platform "$PLATFORMS" "arm64"
                ;;
            "linux/arm/v7")
                build_platform "$PLATFORMS" "armv7"
                ;;
        esac
    fi

    # Show results
    log "info" "Build completed successfully!"
    echo -e "\nAvailable images:"
    docker images webgyb

    echo -e "\nUsage examples:"
    echo "  AMD64 (x86_64): docker run -p 3000:3000 -v \"\$(pwd)/accounts:/app/accounts\" webgyb:amd64"
    echo "  ARM64:          docker run -p 3000:3000 -v \"\$(pwd)/accounts:/app/accounts\" webgyb:arm64"
    echo "  ARM/v7:         docker run -p 3000:3000 -v \"\$(pwd)/accounts:/app/accounts\" webgyb:armv7"

    # Cleanup if requested
    if [ "$CLEANUP" = true ]; then
        cleanup_resources
    fi
}

# Run main function
main
  