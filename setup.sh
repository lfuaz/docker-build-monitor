#!/bin/bash

echo "=== Docker Build Monitor Setup ==="
echo ""

# Function to check if a command exists
command_exists() {
  command -v "$1" &> /dev/null
}

# Ask for package manager preference using keyboard selection
echo "Which package manager would you like to use?"
echo "Press a key to select:"
echo "[1] npm"
echo "[2] yarn"
echo "[3] bun"

# Read a single character
read -n 1 -s package_choice
echo ""

# Set package manager based on key pressed
case $package_choice in
  1)
    package_manager="npm"
    echo "Selected: npm"
    ;;
  2)
    package_manager="yarn"
    echo "Selected: yarn"
    ;;
  3)
    package_manager="bun"
    echo "Selected: bun"
    ;;
  *)
    echo "Invalid selection. Defaulting to npm."
    package_manager="npm"
    ;;
esac

# Validate and install package manager if needed
case $package_manager in
  npm)
    if ! command_exists npm; then
      echo "npm is not installed. Installing..."
      curl -fsSL https://npmjs.org/install.sh | sh
    else
      echo "npm is already installed."
    fi
    ;;
  yarn)
    if ! command_exists yarn; then
      echo "yarn is not installed. Installing..."
      if command_exists npm; then
        npm install -g yarn
      else
        curl -o- -L https://yarnpkg.com/install.sh | bash
      fi
    else
      echo "yarn is already installed."
    fi
    ;;
  bun)
    if ! command_exists bun; then
      echo "bun is not installed. Installing..."
      curl -fsSL https://bun.sh/install | bash
    else
      echo "bun is already installed."
    fi
    ;;
  *)
    echo "Invalid package manager selected. Defaulting to npm."
    package_manager="npm"
    if ! command_exists npm; then
      echo "npm is not installed. Installing..."
      curl -fsSL https://npmjs.org/install.sh | sh
    fi
    ;;
esac

# Source bashrc to ensure the package manager is available in current session
if [ -f "$HOME/.bashrc" ]; then
  echo "Reloading shell configuration..."
  source "$HOME/.bashrc"
fi

# Ask about purpose
echo ""
echo "Are you setting up for development or production use?"
echo "Press a key to select:"
echo "[1] Development (will install dependencies and run both frontend and backend in dev mode)"
echo "[2] Production (will build frontend and run core only)"
read -n 1 -s purpose
echo ""
echo "Selected: $([ "$purpose" = "1" ] && echo "Development" || echo "Production")"

# Ask for port configuration
echo ""
if [ "$purpose" = "1" ]; then
  echo "Development mode: Frontend will run on port 5173 (Vite default)"
  echo "What port should the backend server run on? (default: 3000)"
else
  echo "What port should the application run on? (default: 3000)"
fi
read -p "Port: " port_number

# Use default if no input
if [ -z "$port_number" ]; then
  port_number="3000"
fi

# Validate port number
if ! [[ "$port_number" =~ ^[0-9]+$ ]]; then
  echo "Invalid port number. Defaulting to 3000."
  port_number="3000"
fi

# Set working directory
cd "$(dirname "$0")" || exit

# If production mode, update the .env file in core folder
if [ "$purpose" = "2" ]; then
  echo ""
  echo "=== Configuring application port ==="
  
  # Create or update .env file in core directory
  if [ -f "core/.env" ]; then
    # Update PORT in existing .env file
    if grep -q "^PORT=" "core/.env"; then
      sed -i "s/^PORT=.*/PORT=$port_number/" "core/.env"
    else
      echo "PORT=$port_number" >> "core/.env"
    fi
  else
    # Create new .env file with PORT
    echo "PORT=$port_number" > "core/.env"
  fi
  
  echo "Application configured to run on port $port_number"
fi

# Handle frontend setup
echo ""
echo "=== Setting up frontend ==="
cd frontend || { echo "Error: frontend directory not found"; exit 1; }

echo "Installing frontend dependencies..."
case $package_manager in
  npm)
    npm install
    ;;
  yarn)
    yarn install
    ;;
  bun)
    bun install
    ;;
esac

echo "Building frontend..."
case $package_manager in
  npm)
    npm run build
    ;;
  yarn)
    yarn build
    ;;
  bun)
    bun run build
    ;;
esac

# If development, start frontend dev server in background
if [ "$purpose" = "1" ]; then
  echo "Starting frontend development server..."
  case $package_manager in
    npm)
      npm run dev &
      ;;
    yarn)
      yarn dev &
      ;;
    bun)
      bun run dev &
      ;;
  esac
  FRONTEND_PID=$!
  echo "Frontend development server started with PID: $FRONTEND_PID"
fi

# Change to core directory
cd ../core || { echo "Error: core directory not found"; exit 1; }
echo ""
echo "=== Setting up backend ==="

echo "Installing backend dependencies..."
case $package_manager in
  npm)
    npm install
    ;;
  yarn)
    yarn install
    ;;
  bun)
    bun install
    ;;
esac

# Run backend based on purpose
if [ "$purpose" = "1" ]; then
  echo "Starting backend in development mode..."
  # For development, pass the port as an environment variable
  case $package_manager in
    npm)
      PORT=$port_number npm run dev
      ;;
    yarn)
      PORT=$port_number yarn dev
      ;;
    bun)
      PORT=$port_number bun run dev
      ;;
  esac
else
  echo "Starting backend in production mode..."
  # For production, .env file has already been updated
  case $package_manager in
    npm)
      npm run start
      ;;
    yarn)
      yarn start
      ;;
    bun)
      bun run start
      ;;
  esac
fi

echo ""
echo "Setup complete!"
if [ "$purpose" = "1" ]; then
  echo "Frontend is running on: http://localhost:5173"
  echo "Backend is running on: http://localhost:$port_number"
else
  echo "Application is running on: http://localhost:$port_number"
fi
