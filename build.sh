#!/bin/bash
# Build script for docker-build-monitor with interactive CLI

# Exit on error
set -e

RANDOM_STRING=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)

# Default values
DEPLOYMENT_MODE="docker"
DB_HOST="database"
DB_NAME="docker_monitor"
DB_PASSWORD=$RANDOM_STRING
DEBUG="true"
PORT="8048"

# Track which variables have been set via CLI
CLI_SET_MODE=false
CLI_SET_DB_HOST=false
CLI_SET_DB_NAME=false
CLI_SET_DB_PASS=false
CLI_SET_DEBUG=false
CLI_SET_PORT=false

# Print colorful status messages
function echo_status() {
  echo -e "\033[1;34m[BUILD]\033[0m $1"
}

# Display help message
function show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -m, --mode MODE       Deployment mode: 'docker' or 'local' (default: docker)"
  echo "  -h, --db-host HOST    Database host (default: database)"
  echo "  -n, --db-name NAME    Database name and user (default: docker_monitor)"
  echo "  -p, --db-pass PASS    Database password (default: moihznejfzebf)"
  echo "  -d, --debug BOOL      Debug mode: 'true' or 'false' (default: true)"
  echo "  -P, --port PORT       Port number (default: 8048)"
  echo "  --help                Display this help message"
  echo ""
  echo "If options are not provided, you will be prompted for input interactively."
  exit 0
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--mode)
      DEPLOYMENT_MODE="$2"
      CLI_SET_MODE=true
      shift 2
      ;;
    -h|--db-host)
      DB_HOST="$2"
      CLI_SET_DB_HOST=true
      shift 2
      ;;
    -n|--db-name)
      DB_NAME="$2"
      CLI_SET_DB_NAME=true
      shift 2
      ;;
    -p|--db-pass)
      DB_PASSWORD="$2"
      CLI_SET_DB_PASS=true
      shift 2
      ;;
    -d|--debug)
      DEBUG="$2"
      CLI_SET_DEBUG=true
      shift 2
      ;;
    -P|--port)
      PORT="$2"
      CLI_SET_PORT=true
      shift 2
      ;;
    --help)
      show_help
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      ;;
  esac
done

# Interactive prompt function
function prompt_input() {
  local prompt_text="$1"
  local default_value="$2"
  local user_input
  
  read -p "$prompt_text [$default_value]: " user_input
  echo "${user_input:-$default_value}"
}

# Gather missing information interactively if not provided via CLI
echo_status "Setting up configuration..."

if [ "$CLI_SET_MODE" = false ]; then
  echo "Select deployment mode:"
  echo "1) docker - Run in containerized environment"
  echo "2) local - Run on local machine"
  read -p "Enter choice [1]: " mode_choice
  case "${mode_choice:-1}" in
    1|docker) DEPLOYMENT_MODE="docker" ;;
    2|local) DEPLOYMENT_MODE="local" ;;
    *) echo "Invalid choice, using default: docker"; DEPLOYMENT_MODE="docker" ;;
  esac
fi

if [ "$CLI_SET_DB_HOST" = false ]; then
  db_host_default="database"
  [ "$DEPLOYMENT_MODE" = "local" ] && db_host_default="localhost"
  DB_HOST=$(prompt_input "Database host" "$db_host_default")
fi

if [ "$CLI_SET_DB_NAME" = false ]; then
  DB_NAME=$(prompt_input "Database name/user" "$DB_NAME")
fi

if [ "$CLI_SET_DB_PASS" = false ]; then
  DB_PASSWORD=$(prompt_input "Database password" "$DB_PASSWORD")
fi

if [ "$CLI_SET_DEBUG" = false ]; then
  DEBUG=$(prompt_input "Enable debug mode? (true/false)" "$DEBUG")
fi

if [ "$CLI_SET_PORT" = false ]; then
  PORT=$(prompt_input "Port number" "$PORT")
fi

# Store the initial directory
INITIAL_DIR=$(pwd)
USER=$(whoami)

# Use the current directory as the project root
PROJECT_ROOT=$(pwd)


#create init.sql file to add permission connect from '%' to the database using the user and password
echo_status "Creating init.sql file to add permission connect from '%' to the database using the user and password"
# Make sure the database directory exists
mkdir -p "$INITIAL_DIR/database"
cat > "$INITIAL_DIR/database/init.sql" << SQL
CREATE USER '$DB_NAME'@'%' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_NAME'@'%';
FLUSH PRIVILEGES;
SQL

echo_status "Using project root: $PROJECT_ROOT"
echo_status "Deployment mode: $DEPLOYMENT_MODE"

# Create environment file
function create_env_file() {
  local env_file="$1"
  echo_status "Creating environment file at $env_file"
  
  cat > "$env_file" << EOF
# Environment Variables
DB_HOST=$DB_HOST
DB_USER=$DB_NAME
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

DEBUG=$DEBUG

PORT=$PORT
EOF

  echo_status "Environment file created successfully."
}

# Create environment files
create_env_file "$PROJECT_ROOT/.env"
create_env_file "$PROJECT_ROOT/core/.env"

if [ "$DEPLOYMENT_MODE" = "docker" ]; then
  # Start Docker services first
  echo_status "Starting Docker services..."
  docker compose up -d --build || { echo_status "Docker Compose failed!"; exit 1; }
  echo_status "Docker services started successfully."
  
  # Then build frontend
  echo_status "Building frontend..."
  if [ -d "$PROJECT_ROOT/frontend" ]; then
    cd "$PROJECT_ROOT/frontend"
    echo_status "Installing dependencies..."
    pnpm install || { echo_status "Frontend dependency installation failed!"; exit 1; }
    echo_status "changing ownership of frontend directory"
    chown -R $USER:$USER dist || { echo_status "Failed to change ownership of frontend directory"; exit 1; }
    echo_status "Building frontend..."
    pnpm run build || { echo_status "Frontend build failed!"; exit 1; }
    echo_status "Frontend build completed successfully."
    cd "$PROJECT_ROOT"
  else
    echo_status "Error: frontend directory not found!"
    exit 1
  fi
  
  chown -R $USER:$USER ./frontend/dist
  echo_status "Application is running in Docker containers."
  echo_status "Access the application at http://localhost:$PORT"
else
  # For local mode, build frontend first
  echo_status "Building frontend..."
  if [ -d "$PROJECT_ROOT/frontend" ]; then
    cd "$PROJECT_ROOT/frontend"
    echo_status "Installing dependencies..."
    pnpm install || { echo_status "Frontend dependency installation failed!"; exit 1; }
    echo_status "Building frontend..."
    pnpm run build || { echo_status "Frontend build failed!"; exit 1; }
    echo_status "Frontend build completed successfully."
    cd "$PROJECT_ROOT"
  else
    echo_status "Error: frontend directory not found!"
    exit 1
  fi
  
  # Move frontend dist to core directory
  if [ -d "$PROJECT_ROOT/core" ]; then
    echo_status "Moving frontend dist to core directory..."
    
    # Check if the dist directory exists
    if [ ! -d "$PROJECT_ROOT/frontend/dist" ]; then
      echo_status "Error: Frontend dist directory not found after build!"
      echo_status "Please check the frontend build process."
      exit 1
    fi
    
    # Check if dist directory contains files
    if [ -z "$(ls -A "$PROJECT_ROOT/frontend/dist" 2>/dev/null)" ]; then
      echo_status "Warning: Frontend dist directory is empty after build!"
      echo_status "Please check the frontend build process."
      exit 1
    fi
    
    mkdir -p "$PROJECT_ROOT/core/dist"
    echo_status "Copying files from $PROJECT_ROOT/frontend/dist/ to $PROJECT_ROOT/core/dist/"
    
    # Use cp with more explicit path and better error handling
    cp -rv "$PROJECT_ROOT/frontend/dist/." "$PROJECT_ROOT/core/dist/"
    if [ $? -ne 0 ]; then
      echo_status "Failed to copy frontend files!"
      exit 1
    fi
    
    echo_status "Frontend files copied successfully."
    
    # Run core server
    cd "$PROJECT_ROOT/core"
    echo_status "Installing core dependencies..."
    pnpm install || { echo_status "Core dependency installation failed!"; exit 1; }
    
    echo_status "Starting server..."
    node server.js || { echo_status "Server start failed!"; exit 1; }
  else
    echo_status "Error: core directory not found!"
    exit 1
  fi
fi

# Return to the initial directory
cd "$INITIAL_DIR"

echo_status "Build process completed!"