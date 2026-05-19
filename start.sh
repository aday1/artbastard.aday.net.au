#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║                                                                          ║
# ║     █████╗ ██████╗ ████████╗██████╗  ██████╗  █████╗ ███████╗████████╗  ║
# ║    ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔═══██╗██╔══██╗██╔════╝╚══██╔══╝  ║
# ║    ███████║██████╔╝   ██║   ██████╔╝██║   ██║███████║███████╗   ██║     ║
# ║    ██╔══██║██╔══██╗   ██║   ██╔══██╗██║   ██║██╔══██║╚════██║   ██║     ║
# ║    ██║  ██║██║  ██║   ██║   ██║  ██║╚██████╔╝██║  ██║███████║   ██║     ║
# ║    ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝     ║
# ║                                                                          ║
# ║              🎭 DMX512 LIGHTING CONTROL SYSTEM 🎭                       ║
# ║                                                                          ║
# ║                    ⚡ THEATRICAL LAUNCH SCRIPT ⚡                        ║
# ║                                                                          ║
# ╚══════════════════════════════════════════════════════════════════════════╝

CLEAR=false
RESET=false
HELP=false
PORT=3030

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -Clear|--clear)
            CLEAR=true
            shift
            ;;
        -Reset|--reset)
            RESET=true
            shift
            ;;
        -Port|--port)
            PORT="$2"
            shift 2
            ;;
        -Help|--help|-h)
            HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -Help for usage information"
            exit 1
            ;;
    esac
done

# Validate port range
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "❌ Invalid port: $PORT. Port must be between 1 and 65535." >&2
    exit 1
fi

# Show help
if [ "$HELP" = true ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║  🎭 ArtBastard DMX512 - Sophisticated Launch Orchestrator 🎭 ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📖 Usage:"
    echo "  🚀 ./start.sh           # Fast start (recommended)"
    echo "  🧹 ./start.sh -Clear    # Full clean rebuild (removes everything, reinstalls, rebuilds)"
    echo "  🔄 ./start.sh -Reset    # Factory reset - clears all saved state (fixtures, scenes, config)"
    echo "  🌐 ./start.sh -Port 8080 # Specify web server port (default: 3030)"
    echo "  ❓ ./start.sh -Help     # Display this help"
    echo ""
    echo "🎯 Modes:"
    echo "  🚀 Default: Fast start - preserves cache and dependencies, only rebuilds if needed"
    echo "  🧹 -Clear:  Full clean - removes node_modules, cache, and build artifacts, then rebuilds"
    echo "  🔄 -Reset:  Factory reset - deletes all saved state files (config, scenes, fixtures, etc.)"
    echo "  🌐 -Port:   Specify web server port (1-65535, default: 3030)"
    echo ""
    echo "✨ May your lights shine bright! ✨"
    echo ""
    exit 0
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                          ║"
echo "║     █████╗ ██████╗ ████████╗██████╗  ██████╗  █████╗ ███████╗████████╗  ║"
echo "║    ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔═══██╗██╔══██╗██╔════╝╚══██╔══╝  ║"
echo "║    ███████║██████╔╝   ██║   ██████╔╝██║   ██║███████║███████╗   ██║     ║"
echo "║    ██╔══██║██╔══██╗   ██║   ██╔══██╗██║   ██║██╔══██║╚════██║   ██║     ║"
echo "║    ██║  ██║██║  ██║   ██║   ██║  ██║╚██████╔╝██║  ██║███████║   ██║     ║"
echo "║    ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝     ║"
echo "║                                                                          ║"
echo "║              🎭 DMX512 LIGHTING CONTROL SYSTEM 🎭                       ║"
echo "╚══════════════════════════════════════════════════════════════════════════╝"
echo ""
if [ "$CLEAR" = true ]; then
    echo "🧹 ════════════════════════════════════════════════════════════════ 🧹"
    echo "🧹  FULL CLEAN REBUILD MODE: Removing all artifacts and rebuilding"
    echo "🧹 ════════════════════════════════════════════════════════════════ 🧹"
elif [ "$RESET" = true ]; then
    echo "🔄 ════════════════════════════════════════════════════════════════ 🔄"
    echo "🔄  FACTORY RESET MODE: Clearing all saved state files"
    echo "🔄 ════════════════════════════════════════════════════════════════ 🔄"
else
    echo "🚀 ════════════════════════════════════════════════════════════════ 🚀"
    echo "🚀  FAST START MODE: Smart rebuild (only rebuilds if needed)"
    echo "🚀 ════════════════════════════════════════════════════════════════ 🚀"
fi
echo ""

START_TIME=$(date +%s)

# Factory reset - clear all saved state
if [ "$RESET" = true ]; then
    echo "🔄 ════════════════════════════════════════════════════════════════ 🔄"
    echo "🔄  FACTORY RESET: Clearing ALL saved state files..."
    echo "🔄 ════════════════════════════════════════════════════════════════ 🔄"
    echo ""
    
    # Clear data directory - remove ALL files and subdirectories
    if [ -d "data" ]; then
        echo "  🗑️  Removing ALL saved state files and directories..."
        # Remove all JSON files (including backups and any other data files)
        find data -type f -name "*.json" -delete 2>/dev/null || true
        # Remove any subdirectories (like data/fixtures/)
        find data -mindepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
        # Remove any remaining files
        find data -type f -delete 2>/dev/null || true
        echo "  ✅ All state files cleared!"
    else
        echo "  ℹ️  No data directory found (already clean)"
    fi
    
    # Clear logs directory (optional but recommended for true factory reset)
    if [ -d "logs" ]; then
        echo "  🗑️  Clearing log files..."
        rm -f logs/*.log 2>/dev/null || true
        echo "  ✅ Logs cleared!"
    fi
    
    # Create factory reset marker so frontend can clear localStorage
    mkdir -p data 2>/dev/null || true
    echo "{\"factoryReset\": true, \"timestamp\": $(date +%s)}" > data/.factory-reset-marker.json
    echo "  ✅ Factory reset marker created (frontend will clear localStorage)"
    
    echo ""
    echo "✨ ════════════════════════════════════════════════════════════════ ✨"
    echo "✨  Factory reset complete! ALL saved state has been cleared."
    echo "✨  The server will start with default settings (completely fresh)."
    echo "✨  Browser localStorage will be automatically cleared on next load."
    echo "✨ ════════════════════════════════════════════════════════════════ ✨"
    echo ""
fi

# Function to check if rebuild is needed
test_needs_rebuild() {
    NEEDS_REBUILD=false
    NEEDS_CACHE_CLEAR=false
    REASONS=()
    
    # Check backend
    if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
        NEEDS_REBUILD=true
        REASONS+=("Backend build missing")
    else
        # Check if source files are newer than build
        SERVER_BUILD_TIME=$(stat -c %Y dist/server.js 2>/dev/null || echo 0)
        if [ -d "src" ]; then
            NEWER_SOURCES=$(find src -type f -newer dist/server.js 2>/dev/null | head -1)
            if [ -n "$NEWER_SOURCES" ]; then
                NEEDS_REBUILD=true
                REASONS+=("Backend source files modified")
            fi
        fi
        
        # Check for major config changes
        for config_file in tsconfig.json package.json webpack.config.js vite.config.ts vite.config.js; do
            if [ -f "$config_file" ]; then
                CONFIG_TIME=$(stat -c %Y "$config_file" 2>/dev/null || echo 0)
                if [ "$CONFIG_TIME" -gt "$SERVER_BUILD_TIME" ]; then
                    NEEDS_REBUILD=true
                    NEEDS_CACHE_CLEAR=true
                    REASONS+=("Major config file changed: $config_file")
                fi
            fi
        done
    fi
    
    # Check React frontend
    if [ ! -d "react-app/dist" ] || [ ! -f "react-app/dist/index.html" ]; then
        NEEDS_REBUILD=true
        REASONS+=("Frontend build missing")
    else
        INDEX_BUILD_TIME=$(stat -c %Y react-app/dist/index.html 2>/dev/null || echo 0)
        if [ -d "react-app/src" ]; then
            NEWER_FRONTEND=$(find react-app/src -type f -newer react-app/dist/index.html 2>/dev/null | head -1)
            if [ -n "$NEWER_FRONTEND" ]; then
                NEEDS_REBUILD=true
                REASONS+=("Frontend source files modified")
            fi
        fi
        
        # Check if package.json changed
        if [ -f "react-app/package.json" ]; then
            PACKAGE_TIME=$(stat -c %Y react-app/package.json 2>/dev/null || echo 0)
            if [ "$PACKAGE_TIME" -gt "$INDEX_BUILD_TIME" ]; then
                NEEDS_REBUILD=true
                NEEDS_CACHE_CLEAR=true
                REASONS+=("Frontend dependencies changed (package.json)")
            fi
        fi
        
        # Check for major frontend config changes
        for config_file in react-app/tsconfig.json react-app/vite.config.ts react-app/vite.config.js react-app/.env react-app/.env.local; do
            if [ -f "$config_file" ]; then
                CONFIG_TIME=$(stat -c %Y "$config_file" 2>/dev/null || echo 0)
                if [ "$CONFIG_TIME" -gt "$INDEX_BUILD_TIME" ]; then
                    NEEDS_REBUILD=true
                    NEEDS_CACHE_CLEAR=true
                    REASONS+=("Major frontend config changed: $config_file")
                fi
            fi
        done
    fi
    
    # Check if node_modules are missing
    if [ ! -d "node_modules" ] || [ ! -d "react-app/node_modules" ]; then
        NEEDS_REBUILD=true
        REASONS+=("Dependencies missing")
    fi
    
    echo "$NEEDS_REBUILD|$NEEDS_CACHE_CLEAR|${REASONS[*]}"
}

# Function to launch browser when server is ready
start_browser_when_ready() {
    URL=${1:-"http://localhost:$PORT"}
    MAX_ATTEMPTS=${2:-45}
    
    (
        ATTEMPT=0
        while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
            if curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q "200"; then
                xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" 2>/dev/null || echo "Please open: $URL"
                break
            fi
            if [ $((ATTEMPT % 5)) -eq 0 ]; then
                echo "  Waiting for server... (attempt $ATTEMPT/$MAX_ATTEMPTS)"
            fi
            sleep 1
            ATTEMPT=$((ATTEMPT + 1))
        done
        
        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            echo "Server timeout - you may manually open: $URL"
        fi
    ) &
    echo $!
}

# FULL CLEAN REBUILD PATH: Complete cache clear and rebuild
if [ "$CLEAR" = true ]; then
    echo "🧹 ════════════════════════════════════════════════════════════════ 🧹"
    echo "🧹  FULL CLEAN REBUILD: Removing all artifacts and rebuilding"
    echo "🧹 ════════════════════════════════════════════════════════════════ 🧹"
    echo ""
    
    # Kill all processes
    echo "⚡ Terminating all Node.js processes..."
    pkill -f node 2>/dev/null || true
    pkill -f "ArtBastard" 2>/dev/null || true
    echo "  ✅ Processes terminated!"
    echo ""
    
    echo "🧹 ════════════════════════════════════════════════════════════════ 🧹"
    echo "🧹  FORCE CLEARING ALL CACHES..."
    echo "🧹 ════════════════════════════════════════════════════════════════ 🧹"
    
    # Clear Vite cache
    echo "  🗑️  Clearing Vite cache..."
    if [ -d "react-app/.vite" ]; then
        rm -rf react-app/.vite
        echo "     ✅ Vite cache cleared!"
    else
        echo "     ℹ️  No Vite cache found"
    fi
    
    # Clear npm cache
    echo "  🗑️  Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true
    npm cache verify 2>/dev/null || true
    echo "     ✅ npm cache cleared!"
    
    # Remove node_modules
    echo "  🗑️  Removing node_modules..."
    [ -d "node_modules" ] && rm -rf node_modules && echo "     ✅ Root node_modules removed!"
    [ -d "react-app/node_modules" ] && rm -rf react-app/node_modules && echo "     ✅ Frontend node_modules removed!"
    
    # Remove build artifacts
    echo "  🗑️  Removing build artifacts..."
    [ -d "dist" ] && rm -rf dist && echo "     ✅ Backend dist removed!"
    [ -d "react-app/dist" ] && rm -rf react-app/dist && echo "     ✅ Frontend dist removed!"
    
    echo ""
    echo "✨ Cache and artifacts cleared! ✨"
    echo ""
    
    # Reinstall dependencies
    echo "📦 ════════════════════════════════════════════════════════════════ 📦"
    echo "📦  Reinstalling all dependencies..."
    echo "📦 ════════════════════════════════════════════════════════════════ 📦"
    echo ""
    echo "  📥 Installing root dependencies..."
    npm install --no-audit --no-fund --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "  ❌ Root dependency installation failed!" >&2
        exit 1
    fi
    echo "  ✅ Root dependencies installed!"
    echo ""
    
    echo "  📥 Installing frontend dependencies..."
    cd react-app
    npm install --no-audit --no-fund --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "  ❌ Frontend dependency installation failed!" >&2
        cd ..
        exit 1
    fi
    cd ..
    echo "  ✅ Frontend dependencies installed!"
    echo ""
    echo "✨ All dependencies installed! ✨"
    echo ""
    
    # Force rebuild
    echo "🔨 ════════════════════════════════════════════════════════════════ 🔨"
    echo "🔨  FORCE REBUILDING..."
    echo "🔨 ════════════════════════════════════════════════════════════════ 🔨"
    echo ""
    echo "  🏗️  Building backend..."
    npm run build-backend
    if [ $? -ne 0 ]; then
        echo "  ❌ Backend build failed!" >&2
        exit 1
    fi
    echo "  ✅ Backend build complete!"
    echo ""
    
    echo "  🏗️  Building frontend..."
    cd react-app
    npm run build:vite
    if [ $? -ne 0 ]; then
        echo "  ❌ Frontend build failed!" >&2
        cd ..
        exit 1
    fi
    cd ..
    echo "  ✅ Frontend build complete!"
    echo ""
    echo "✨ Build completed! ✨"
    echo ""
    
    # Launch browser when server is ready
    echo "🌐 ════════════════════════════════════════════════════════════════ 🌐"
    echo "🌐  Browser will launch automatically when server is ready..."
    echo "🌐 ════════════════════════════════════════════════════════════════ 🌐"
    echo ""
    BROWSER_PID=$(start_browser_when_ready)
    
    # MIDI Device Auto-Connect Configuration
    echo ""
    echo "🎹 ════════════════════════════════════════════════════════════════ 🎹"
    echo "🎹  MIDI Device Auto-Connect Configuration"
    echo "🎹 ════════════════════════════════════════════════════════════════ 🎹"
    echo ""
    echo "  Configure which MIDI devices should auto-connect on startup."
    echo "  Press Enter to skip and use current configuration."
    echo ""
    
    # Check if Node.js is available
    if command -v node >/dev/null 2>&1; then
        # Check if the MIDI selector script exists
        MIDI_SELECTOR_SCRIPT="$(dirname "$0")/scripts/select-midi-devices.js"
        if [ -f "$MIDI_SELECTOR_SCRIPT" ]; then
            echo "  Running MIDI device selector..."
            echo ""
            if node "$MIDI_SELECTOR_SCRIPT"; then
                echo ""
                echo "  ✅ MIDI configuration updated!"
            else
                echo ""
                echo "  ⚠️  MIDI configuration cancelled or failed"
            fi
        else
            echo "  ℹ️  MIDI selector script not found, skipping configuration"
        fi
    else
        echo "  ℹ️  Node.js not available, skipping MIDI configuration"
    fi
    
    # Start server
    echo ""
    echo "🎭 ════════════════════════════════════════════════════════════════ 🎭"
    echo "🎭  Starting ArtBastard DMX512 Server on port $PORT..."
    echo "🎭 ════════════════════════════════════════════════════════════════ 🎭"
    echo ""
    PORT=$PORT npm start
    
    # Cleanup browser job
    kill $BROWSER_PID 2>/dev/null || true
    
    TOTAL_TIME=$(($(date +%s) - START_TIME))
    echo ""
    echo "✨ ════════════════════════════════════════════════════════════════ ✨"
    echo "✨  ArtBastard DMX512 clean rebuild completed in ${TOTAL_TIME}s!"
    echo "✨  May your lights shine bright! ✨"
    echo "✨ ════════════════════════════════════════════════════════════════ ✨"
    exit 0
fi

# FAST START PATH: Smart rebuild (only rebuilds if needed)
echo "🚀 ════════════════════════════════════════════════════════════════ 🚀"
echo "🚀  FAST START MODE"
echo "🚀  Smart rebuild - only rebuilds if source files changed"
echo "🚀 ════════════════════════════════════════════════════════════════ 🚀"
echo ""

# Process termination
echo "⚡ Executing graceful process termination..."
pkill -f "node.*server" 2>/dev/null || true
pkill -f "ArtBastard" 2>/dev/null || true
echo "  ✅ Process termination completed!"
echo ""

# Intelligent rebuild and cache detection
echo "🔍 Conducting architectural analysis..."
REBUILD_RESULT=$(test_needs_rebuild)
IFS='|' read -r NEEDS_REBUILD NEEDS_CACHE_CLEAR REASONS_STR <<< "$REBUILD_RESULT"
REASONS=($REASONS_STR)

# Check if cache clear is needed
if [ "$NEEDS_CACHE_CLEAR" = "true" ]; then
    echo "🧹 Cache optimization required (major code changes detected)..."
    for reason in "${REASONS[@]}"; do
        if [[ "$reason" == *"config"* ]] || [[ "$reason" == *"package.json"* ]] || [[ "$reason" == *"dependencies"* ]]; then
            echo "  ⚠️  $reason"
        fi
    done
    echo "  🗑️  Clearing Vite cache..."
    [ -d "react-app/.vite" ] && rm -rf react-app/.vite && echo "     ✅ Vite cache cleared!"
    echo "  🗑️  Clearing npm cache..."
    npm cache clean --force 2>/dev/null || true
    echo "  🔍 Verifying npm cache..."
    npm cache verify 2>/dev/null || true
    echo "  ✅ Cache cleared successfully!"
    echo ""
fi

# Check and install dependencies if missing
NEEDS_ROOT_INSTALL=false
NEEDS_FRONTEND_INSTALL=false

[ ! -d "node_modules" ] && NEEDS_ROOT_INSTALL=true
[ ! -d "react-app/node_modules" ] && NEEDS_FRONTEND_INSTALL=true

if [ "$NEEDS_ROOT_INSTALL" = true ] || [ "$NEEDS_FRONTEND_INSTALL" = true ]; then
    echo "📦 Dependencies missing - installing..."
    if [ "$NEEDS_ROOT_INSTALL" = true ]; then
        echo "  📥 Installing root dependencies..."
        npm install --prefer-offline --no-optional --no-audit --no-fund --legacy-peer-deps
        if [ $? -ne 0 ]; then
            echo "  ❌ Root dependency installation failed!" >&2
            exit 1
        fi
        echo "  ✅ Root dependencies installed!"
    fi
    if [ "$NEEDS_FRONTEND_INSTALL" = true ]; then
        echo "  📥 Installing frontend dependencies..."
        cd react-app
        npm install --prefer-offline --no-optional --no-audit --no-fund --legacy-peer-deps
        if [ $? -ne 0 ]; then
            echo "  ❌ Frontend dependency installation failed!" >&2
            cd ..
            exit 1
        fi
        cd ..
        echo "  ✅ Frontend dependencies installed!"
    fi
    echo "✨ Dependencies installed! ✨"
    echo ""
fi

if [ "$NEEDS_REBUILD" = "true" ]; then
    echo "🔨 Rebuild required:"
    for reason in "${REASONS[@]}"; do
        echo "  ⚠️  $reason"
    done
    echo ""
    echo "🔨 Executing intelligent rebuild..."
    echo ""
    
    # Build backend if needed
    if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
        echo "  🏗️  Building backend..."
        npm run build-backend
        if [ $? -ne 0 ]; then
            echo "  ❌ Backend build failed!" >&2
            exit 1
        fi
        echo "  ✅ Backend build complete!"
    else
        SERVER_BUILD_TIME=$(stat -c %Y dist/server.js 2>/dev/null || echo 0)
        NEWER_SOURCES=$(find src -type f -newer dist/server.js 2>/dev/null | head -1)
        if [ -n "$NEWER_SOURCES" ]; then
            echo "  🏗️  Building backend (source files modified)..."
            npm run build-backend
            if [ $? -ne 0 ]; then
                echo "  ❌ Backend build failed!" >&2
                exit 1
            fi
            echo "  ✅ Backend build complete!"
        fi
    fi
    
    # Build frontend if needed
    if [ ! -d "react-app/dist" ] || [ ! -f "react-app/dist/index.html" ]; then
        echo "  🏗️  Building frontend..."
        cd react-app
        npm run build:vite
        if [ $? -ne 0 ]; then
            echo "  ❌ Frontend build failed!" >&2
            cd ..
            exit 1
        fi
        cd ..
        echo "  ✅ Frontend build complete!"
    else
        INDEX_BUILD_TIME=$(stat -c %Y react-app/dist/index.html 2>/dev/null || echo 0)
        NEWER_FRONTEND=$(find react-app/src -type f -newer react-app/dist/index.html 2>/dev/null | head -1)
        PACKAGE_JSON_NEWER=false
        if [ -f "react-app/package.json" ]; then
            PACKAGE_TIME=$(stat -c %Y react-app/package.json 2>/dev/null || echo 0)
            [ "$PACKAGE_TIME" -gt "$INDEX_BUILD_TIME" ] && PACKAGE_JSON_NEWER=true
        fi
        if [ -n "$NEWER_FRONTEND" ] || [ "$PACKAGE_JSON_NEWER" = true ]; then
            echo "  🏗️  Building frontend (source files or dependencies modified)..."
            cd react-app
            npm run build:vite
            if [ $? -ne 0 ]; then
                echo "  ❌ Frontend build failed!" >&2
                cd ..
                exit 1
            fi
            cd ..
            echo "  ✅ Frontend build complete!"
        fi
    fi
    
    echo ""
    echo "✨ Intelligent rebuild completed! ✨"
else
    echo "✨ Architectural foundation intact - no rebuild required! ✨"
fi

echo ""
echo "🎹 ════════════════════════════════════════════════════════════════ 🎹"
echo "🎹  MIDI Device Auto-Connect Configuration"
echo "🎹 ════════════════════════════════════════════════════════════════ 🎹"
echo ""
echo "  Configure which MIDI devices should auto-connect on startup."
echo "  Press Enter to skip and use current configuration."
echo ""

# Check if Node.js is available
if command -v node >/dev/null 2>&1; then
    # Check if the MIDI selector script exists
    MIDI_SELECTOR_SCRIPT="$(dirname "$0")/scripts/select-midi-devices.js"
    if [ -f "$MIDI_SELECTOR_SCRIPT" ]; then
        echo "  Running MIDI device selector..."
        echo ""
        if node "$MIDI_SELECTOR_SCRIPT"; then
            echo ""
            echo "  ✅ MIDI configuration updated!"
        else
            echo ""
            echo "  ⚠️  MIDI configuration cancelled or failed"
        fi
    else
        echo "  ℹ️  MIDI selector script not found, skipping configuration"
    fi
else
    echo "  ℹ️  Node.js not available, skipping MIDI configuration"
fi

echo ""
echo "🎭 ════════════════════════════════════════════════════════════════ 🎭"
echo "🎭  Initiating ArtBastard DMX512 server deployment on port $PORT..."
echo "🎭 ════════════════════════════════════════════════════════════════ 🎭"
echo ""

# Launch browser when server is ready
echo "🌐 Browser will launch automatically when server is ready..."
BROWSER_PID=$(start_browser_when_ready)

# Deploy the server
PORT=$PORT npm start

# Cleanup browser job
kill $BROWSER_PID 2>/dev/null || true

TOTAL_TIME=$(($(date +%s) - START_TIME))
echo ""
echo "✨ ════════════════════════════════════════════════════════════════ ✨"
echo "✨  ArtBastard DMX512 session concluded in ${TOTAL_TIME}s!"
echo "✨  May your lights shine bright! ✨"
echo "✨ ════════════════════════════════════════════════════════════════ ✨"

