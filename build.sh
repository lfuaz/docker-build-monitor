#!/bin/bash
# Improved build script for the sse-react project

# Exit on error
set -e

# Store the initial directory
INITIAL_DIR=$(pwd)

# Print colorful status messages
function echo_status() {
  echo -e "\033[1;34m[BUILD]\033[0m $1"
}

# Use the current directory as the project root
PROJECT_ROOT=$(pwd)
echo_status "Using project root: $PROJECT_ROOT"

# Build frontend
echo_status "Building frontend..."
if [ -d "$PROJECT_ROOT/frontend" ]; then
  cd "$PROJECT_ROOT/frontend"
  pnpm run build || { echo_status "Frontend build failed!"; exit 1; }
  echo_status "Frontend build completed successfully."
  cd "$PROJECT_ROOT"
else
  echo_status "Error: frontend directory not found!"
  exit 1
fi

# Build core
echo_status "Setting up core server..."
if [ -d "$PROJECT_ROOT/core" ]; then
  cd "$PROJECT_ROOT/core"
  echo_status "Installing dependencies..."
  pnpm install || { echo_status "Core dependency installation failed!"; exit 1; }
  echo_status "Starting server..."
  node server.js || { echo_status "Server start failed!"; exit 1; }
else
  echo_status "Error: core directory not found!"
  exit 1
fi

# Return to the initial directory
cd "$INITIAL_DIR"

echo_status "Build process completed!"