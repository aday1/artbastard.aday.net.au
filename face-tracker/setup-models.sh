#!/bin/bash

# ArtBastard Face Tracker - Model Setup Script
# Downloads required OpenCV model files

set -e

echo "=== ArtBastard Face Tracker - Model Setup ==="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Downloading OpenCV model files..."
echo ""

# Download Haar Cascade
if [ ! -f "haarcascade_frontalface_alt.xml" ]; then
    echo "Downloading Haar Cascade for face detection..."
    curl -L -o haarcascade_frontalface_alt.xml \
        https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_alt.xml
    echo "✓ Downloaded haarcascade_frontalface_alt.xml"
else
    echo "✓ haarcascade_frontalface_alt.xml already exists"
fi

echo ""

# Try to download facemark model (may fail if URL changes)
if [ ! -f "lbfmodel.yaml" ]; then
    echo "Attempting to download facemark model..."
    echo "Note: If this fails, the app will still work with basic face tracking"
    
    # Try multiple possible sources
    if curl -L -f -o lbfmodel.yaml \
        https://github.com/kurnianggoro/GSOC2017/raw/master/data/lbfmodel.yaml 2>/dev/null; then
        echo "✓ Downloaded lbfmodel.yaml"
    elif curl -L -f -o lbfmodel.yaml \
        https://raw.githubusercontent.com/kurnianggoro/GSOC2017/master/data/lbfmodel.yaml 2>/dev/null; then
        echo "✓ Downloaded lbfmodel.yaml"
    else
        echo "⚠ Could not download lbfmodel.yaml automatically"
        echo "  The app will work without it using basic face center tracking"
        echo "  For better accuracy, download it manually from OpenCV contrib modules"
    fi
else
    echo "✓ lbfmodel.yaml already exists"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Model files status:"
echo ""
if [ -f "haarcascade_frontalface_alt.xml" ]; then
    echo "  ✓ haarcascade_frontalface_alt.xml"
else
    echo "  ✗ haarcascade_frontalface_alt.xml (REQUIRED)"
fi

if [ -f "lbfmodel.yaml" ]; then
    echo "  ✓ lbfmodel.yaml (enhanced tracking)"
else
    echo "  ⚠ lbfmodel.yaml (optional - using basic tracking)"
fi

echo ""
echo "You can now build and run the face tracker!"
echo ""

