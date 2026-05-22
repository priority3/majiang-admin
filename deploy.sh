#!/bin/bash
set -e

REMOTE="tencent-cvm"
REMOTE_DIR="/opt/majiang-admin"
IMAGE_NAME="majiang-admin"
CONTAINER_NAME="majiang-admin"
VOLUME_NAME="majiang-admin-data"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
UI_DIR="$SCRIPT_DIR/ui"

echo "📦 Deploying majiang-admin to Tencent Cloud..."

# Build React UI
echo "🔨 Building React UI..."
cd "$UI_DIR" && npm run build
# Copy built files into admin public/
rm -rf "$SCRIPT_DIR/public"
cp -r "$UI_DIR/dist" "$SCRIPT_DIR/public"
cd "$SCRIPT_DIR"

# Create remote directory
ssh $REMOTE "mkdir -p $REMOTE_DIR"

# Copy files
echo "📤 Copying files..."
scp -r src/ public/ package.json Dockerfile docker-compose.yml $REMOTE:$REMOTE_DIR/

# Build and run
echo "🔨 Building Docker image..."
ssh $REMOTE "cd $REMOTE_DIR && docker build -t $IMAGE_NAME ."

# Stop old container if exists
echo "🔄 Stopping old container..."
ssh $REMOTE "docker stop $CONTAINER_NAME 2>/dev/null || true"
ssh $REMOTE "docker rm $CONTAINER_NAME 2>/dev/null || true"

# Create volume if not exists
echo "💾 Creating data volume..."
ssh $REMOTE "docker volume create $VOLUME_NAME 2>/dev/null || true"

# Run new container with volume
echo "🚀 Starting container..."
ssh $REMOTE "docker run -d --name $CONTAINER_NAME --restart unless-stopped -p 3210:3210 -v /opt/majiang-optimized:/data/majiang-optimized:ro -v $VOLUME_NAME:/app/data $IMAGE_NAME"

echo "✅ Deployed! Container running on port 3210"
echo "📊 Data persisted to volume: $VOLUME_NAME"
