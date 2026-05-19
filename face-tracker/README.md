# ArtBastard DMX Face Tracker

A high-performance C++ application using OpenCV to track face movements and control DMX moving heads in real-time. Perfect for creating expressive puppet shows where moving heads mimic facial expressions and head movements.

## Features

- 🎭 **Real-time Face Tracking**: Uses OpenCV's face detection and landmark tracking
- 🎯 **Head Pose Estimation**: Calculates pan/tilt from facial landmarks
- 🎨 **DMX Integration**: Sends commands directly to ArtBastard DMX Controller via REST API
- 📊 **Smooth Movement**: Configurable smoothing for natural motion
- ⚙️ **Highly Configurable**: Adjust sensitivity, offsets, update rates, and more
- 🎥 **Live Preview**: Optional camera preview window

## Requirements

### System Dependencies

- **OpenCV 4.x** with contrib modules (for facemark)
- **libcurl** for HTTP requests
- **CMake 3.12+**
- **C++17** compatible compiler (GCC 7+, Clang 5+, MSVC 2017+)
- **nlohmann/json** (header-only, included or install separately)

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    cmake \
    libopencv-dev \
    libopencv-contrib-dev \
    libcurl4-openssl-dev \
    nlohmann-json3-dev
```

### Linux (Arch/CachyOS)

```bash
sudo pacman -S \
    base-devel \
    cmake \
    opencv \
    curl \
    nlohmann-json
```

### macOS

```bash
brew install opencv curl nlohmann-json cmake
```

### Windows

- Install OpenCV from [opencv.org](https://opencv.org/releases/)
- Install vcpkg and use it to install:
  - `vcpkg install opencv curl nlohmann-json`

## Building

### Quick Build

```bash
cd face-tracker
mkdir build
cd build
cmake ..
make
```

### Installation

```bash
sudo make install  # Optional: installs to system
```

Or simply run from the build directory:

```bash
./bin/face-tracker
```

## Configuration

The application uses `face-tracker-config.json` for configuration. On first run, it creates a default config file.

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `dmxApiUrl` | `http://localhost:3030/api/dmx/batch` | ArtBastard DMX Controller API endpoint |
| `panChannel` | `1` | DMX channel number for pan control |
| `tiltChannel` | `2` | DMX channel number for tilt control |
| `cameraIndex` | `0` | Webcam device index |
| `updateRate` | `30` | DMX updates per second |
| `panSensitivity` | `1.0` | Pan movement sensitivity (0.0-2.0) |
| `tiltSensitivity` | `1.0` | Tilt movement sensitivity (0.0-2.0) |
| `panOffset` | `128` | Center position for pan (0-255) |
| `tiltOffset` | `128` | Center position for tilt (0-255) |
| `showPreview` | `true` | Show camera preview window |
| `smoothingFactor` | `0.8` | Movement smoothing (0.0-1.0, higher = smoother) |

### Example Configuration

```json
{
  "dmxApiUrl": "http://192.168.1.100:3030/api/dmx/batch",
  "panChannel": 5,
  "tiltChannel": 6,
  "cameraIndex": 0,
  "updateRate": 30,
  "panSensitivity": 1.2,
  "tiltSensitivity": 1.0,
  "panOffset": 128,
  "tiltOffset": 128,
  "showPreview": true,
  "smoothingFactor": 0.85
}
```

## OpenCV Model Files

You need to download the following OpenCV model files and place them in the `face-tracker` directory:

### Required Files

1. **Haar Cascade for Face Detection**
   - File: `haarcascade_frontalface_alt.xml`
   - Download from: https://github.com/opencv/opencv/blob/master/data/haarcascades/haarcascade_frontalface_alt.xml
   - Place in: `face-tracker/` directory

2. **Face Landmark Model (Optional but Recommended)**
   - File: `lbfmodel.yaml`
   - Download from: https://github.com/kurnianggoro/GSOC2017/blob/master/data/lbfmodel.yaml
   - Or check OpenCV contrib face module
   - Place in: `face-tracker/` directory

### Quick Download Script (Linux/macOS)

```bash
cd face-tracker

# Download Haar cascade
curl -O https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_alt.xml

# Download facemark model (alternative sources)
# Option 1: From OpenCV contrib
# Option 2: Use a simpler approach - the app will work without it using basic face center tracking
```

**Note**: The application will work without the landmark model, using basic face center tracking. However, landmark tracking provides more accurate head pose estimation.

## Usage

### Basic Usage

1. **Start ArtBastard DMX Controller** first:
   ```bash
   npm start
   # Or your preferred method to start the DMX server
   ```

2. **Configure your moving head fixture** in ArtBastard:
   - Set up a moving head fixture with pan/tilt channels
   - Note the DMX channel numbers for pan and tilt
   - Update `face-tracker-config.json` with these channels

3. **Run the face tracker**:
   ```bash
   cd face-tracker
   ./bin/face-tracker
   ```

4. **Position yourself** in front of the camera and move your head!

### Keyboard Controls

- `Q` or `ESC`: Quit the application

### Troubleshooting

#### "Could not open camera"
- Check that your webcam is connected
- Try different `cameraIndex` values (0, 1, 2, etc.)
- On Linux, ensure your user has permissions: `sudo usermod -a -G video $USER` (log out and back in)

#### "Failed to initialize curl" or API connection errors
- Ensure ArtBastard DMX Controller is running
- Check the `dmxApiUrl` in config matches your server address
- Verify firewall allows connections
- Test API manually: `curl -X POST http://localhost:3030/api/dmx/batch -H "Content-Type: application/json" -d '{"0":128,"1":128}'`

#### "No face detected"
- Ensure good lighting
- Face the camera directly
- Check camera is not blocked or covered

#### Poor tracking accuracy
- Adjust `panSensitivity` and `tiltSensitivity` in config
- Increase `smoothingFactor` for smoother but slower response
- Decrease `smoothingFactor` for more responsive but jittery movement
- Download and place the `lbfmodel.yaml` file for better landmark tracking

## Integration with ArtBastard

The face tracker communicates with ArtBastard via the REST API endpoint `/api/dmx/batch`. This endpoint accepts a JSON object mapping DMX channel indices (0-based) to values (0-255).

### Example API Call

```json
{
  "0": 128,  // Pan channel (DMX channel 1, 0-indexed)
  "1": 150   // Tilt channel (DMX channel 2, 0-indexed)
}
```

The face tracker automatically formats and sends these updates at the configured rate.

## Performance Tips

- **Update Rate**: Lower rates (15-20 Hz) reduce network load but are less responsive
- **Smoothing**: Higher smoothing (0.8-0.9) creates smoother motion but adds latency
- **Resolution**: The app sets camera to 640x480 for good balance of speed and accuracy
- **CPU Usage**: Face tracking is CPU-intensive; ensure your system can handle real-time processing

## Advanced Features

### Multiple Moving Heads

To control multiple moving heads simultaneously, you can:

1. Run multiple instances with different configs (different channels)
2. Modify the code to send multiple pan/tilt pairs in one API call

### Calibration

1. Position yourself centered in frame
2. Note the pan/tilt values shown in preview
3. Adjust `panOffset` and `tiltOffset` so these values are at 128 (center) when you're centered

## Development

### Building with Debug Symbols

```bash
cd build
cmake -DCMAKE_BUILD_TYPE=Debug ..
make
```

### Verbose Output

The application outputs tracking information to stdout:
```
Face tracked - Pan: 135, Tilt: 142 (raw: 0.055, 0.110)
```

## License

This face tracker is part of the ArtBastard DMX512 project. See the main project LICENSE file.

## Contributing

Contributions welcome! Areas for improvement:
- Multi-face tracking
- Expression detection (smile, frown, etc.)
- Eye tracking for additional control
- WebSocket integration for lower latency
- Direct ArtNet output (bypassing HTTP API)

## Credits

- OpenCV team for excellent computer vision libraries
- ArtBastard DMX Controller project
- Built for expressive DMX puppet shows

---

**Enjoy creating expressive DMX puppet shows! 🎭✨**

