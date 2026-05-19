// Prevent Windows headers from defining min/max macros that break std::min/std::max
// MUST be defined before any includes that might pull in Windows headers
#ifdef _WIN32
    #ifndef NOMINMAX
    #define NOMINMAX
    #endif
    #ifndef WIN32_LEAN_AND_MEAN
    #define WIN32_LEAN_AND_MEAN
    #endif
#endif

#include <opencv2/opencv.hpp>
#ifdef HAVE_OPENCV_FACE
#include <opencv2/face.hpp>
#endif
#include <opencv2/imgproc.hpp>
#include <opencv2/imgproc/imgproc.hpp>
#include <iostream>
#include <thread>
#include <chrono>
#include <vector>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <cmath>
#include <curl/curl.h>

// Platform-specific includes
#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <io.h>
    #define sleep(x) Sleep((x)*1000)
    #pragma comment(lib, "ws2_32.lib")
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
#endif
#include <cstring>

#include <nlohmann/json.hpp>

using namespace cv;
#ifdef HAVE_OPENCV_FACE
using namespace cv::face;
#endif
using json = nlohmann::json;

// Configuration structure
struct Config {
    std::string dmxApiUrl = "http://localhost:3030/api/dmx/batch";
    int panChannel = 1;  // DMX channel for pan (default)
    int tiltChannel = 2; // DMX channel for tilt (default)
    int irisChannel = 0; // DMX channel for iris (0 = disabled)
    int zoomChannel = 0; // DMX channel for zoom (0 = disabled)
    int focusChannel = 0; // DMX channel for focus (0 = disabled)
    int cameraIndex = 0;
    int updateRate = 20; // Updates per second (reduced for smoother movement)
    float panSensitivity = 1.0f;
    float tiltSensitivity = 1.0f;
    int panOffset = 128;  // Center position for pan (0-255)
    int tiltOffset = 128; // Center position for tilt (0-255)
    int irisValue = 128;  // Default iris value (0-255)
    int zoomValue = 128;  // Default zoom value (0-255)
    int focusValue = 128; // Default focus value (0-255)
    bool showPreview = true;
    bool show3DVisualization = true; // Show 3D fixture visualization
    float smoothingFactor = 0.85f; // Smoothing for movement (0.0-1.0, higher = smoother)
    float maxVelocity = 5.0f; // Maximum change per update (prevents overshooting)
    // Camera brightness/contrast controls
    float brightness = 1.0f;    // Brightness multiplier (0.0-3.0, default 1.0)
    float contrast = 1.0f;      // Contrast multiplier (0.0-3.0, default 1.0)
    int cameraExposure = -1;    // Camera exposure (-1 = auto, or specific value)
    int cameraBrightness = -1;  // Camera brightness (-1 = auto, or specific value)
    bool autoExposure = true;   // Enable auto exposure
    
    // OSC Configuration
    bool useOSC = false;              // Use OSC instead of HTTP API
    std::string oscHost = "127.0.0.1"; // OSC target host
    int oscPort = 9000;               // OSC target port
    std::string oscPanPath = "/dmx/pan";    // OSC path for pan
    std::string oscTiltPath = "/dmx/tilt";  // OSC path for tilt
    std::string oscIrisPath = "/dmx/iris";  // OSC path for iris
    std::string oscZoomPath = "/dmx/zoom";  // OSC path for zoom
    std::string oscFocusPath = "/dmx/focus"; // OSC path for focus
    
    // Range cutoff values (min/max for each channel)
    int panMin = 0;      // Minimum DMX value for pan
    int panMax = 255;    // Maximum DMX value for pan
    int tiltMin = 0;     // Minimum DMX value for tilt
    int tiltMax = 255;   // Maximum DMX value for tilt
    int irisMin = 0;     // Minimum DMX value for iris
    int irisMax = 255;   // Maximum DMX value for iris
    int zoomMin = 0;     // Minimum DMX value for zoom
    int zoomMax = 255;   // Maximum DMX value for zoom
    int focusMin = 0;    // Minimum DMX value for focus
    int focusMax = 255;  // Maximum DMX value for focus
    
    // Rigging parameters (mechanical calibration)
    float panScale = 1.0f;    // Scale factor for pan movement
    float tiltScale = 1.0f;   // Scale factor for tilt movement
    float panDeadZone = 0.0f; // Dead zone threshold for pan (ignore small movements)
    float tiltDeadZone = 0.0f; // Dead zone threshold for tilt
    float panLimit = 1.0f;    // Maximum range multiplier for pan (0.0-1.0)
    float tiltLimit = 1.0f;   // Maximum range multiplier for tilt (0.0-1.0)
    float panGear = 1.0f;     // Gear ratio for pan (higher = slower movement)
    float tiltGear = 1.0f;    // Gear ratio for tilt (higher = slower movement)
};

// Global state
struct FaceTrackerState {
    Ptr<CascadeClassifier> faceCascade;
#ifdef HAVE_OPENCV_FACE
    Ptr<Facemark> facemark;
#else
    void* facemark = nullptr;  // Placeholder when face module not available
#endif
    std::vector<Point2f> landmarks;
    Point2f headCenter;
    float currentPan = 0.0f;
    float currentTilt = 0.0f;
    float smoothedPan = 0.0f;
    float smoothedTilt = 0.0f;
    float panVelocity = 0.0f; // Velocity for smoother movement
    float tiltVelocity = 0.0f; // Velocity for smoother movement
    bool faceDetected = false;
    // 3D visualization viewport
    float viewAngleX = 0.0f; // View rotation X (up/down)
    float viewAngleY = -45.0f; // View rotation Y (left/right, default -45 for side view)
    float viewDistance = 1.2f; // View distance (zoom)
    bool viewportDragging = false; // Mouse dragging for viewport
    Point2f lastMousePos; // Last mouse position for dragging
    bool autoOrbit = false; // Auto-orbit around fixture
    float autoOrbitSpeed = 1.0f; // Auto-orbit speed (degrees per frame)
    bool showXYZLattice = false; // Show XYZ coordinate axes
    int viewAngleXSlider = 0; // Slider value for viewAngleX (0-360, maps to -90 to +90)
    int viewAngleYSlider = 315; // Slider value for viewAngleY (0-360, maps to -180 to +180, default -45° = 315)
    // Gesture/intent detection
    std::vector<float> panHistory; // History of pan values for gesture detection
    std::vector<float> tiltHistory; // History of tilt values for gesture detection
    const size_t gestureHistorySize = 30; // Frames to track (about 1 second at 30fps)
    std::string lastGesture = ""; // Last detected gesture
    int gestureCooldown = 0; // Cooldown to prevent duplicate detections
    // Configuration is always visible in separate window
    Config config;
    VideoCapture* cap;  // Pointer to camera for trackbar callbacks
    int brightnessSlider = 50;   // Trackbar position (0-100, represents 0.0-3.0)
    int contrastSlider = 33;     // Trackbar position (0-100, represents 0.0-3.0)
    int exposureSlider = 50;     // Trackbar position (0-100, represents exposure)
    int autoExposureSlider = 0;  // Trackbar position (0=OFF/Manual, 1=ON/Auto)
    int colorModeSlider = 1;     // Trackbar position (0=Grayscale, 1=Color)
    Mat lastDisplayFrame;        // Store last display frame for mouse callback
    // Config window sliders (for interactive editing)
    int panChannelSlider = 1;
    int tiltChannelSlider = 2;
    int panMinSlider = 0;
    int panMaxSlider = 255;
    int tiltMinSlider = 0;
    int tiltMaxSlider = 255;
    int panScaleSlider = 100;    // 0-200, represents 0.0-2.0
    int tiltScaleSlider = 100;
    int panDeadZoneSlider = 0;   // 0-100, represents 0.0-1.0
    int tiltDeadZoneSlider = 0;
    int panLimitSlider = 100;    // 0-100, represents 0.0-1.0
    int tiltLimitSlider = 100;
    int panGearSlider = 100;      // 10-200, represents 0.1-2.0
    int tiltGearSlider = 100;
    int oscEnableSlider = 0;  // 0=OFF (HTTP), 1=ON (OSC)
    int oscPortSlider = 9000; // OSC port (0-10000 for UI)
    // Additional config sliders
    int updateRateSlider = 20;  // 1-100 Hz
    int smoothingFactorSlider = 85; // 0-100, represents 0.0-1.0
    int maxVelocitySlider = 50; // 0-100, represents 0.0-10.0
    int panSensitivitySlider = 100; // 0-200, represents 0.0-2.0
    int tiltSensitivitySlider = 100; // 0-200, represents 0.0-2.0
    int panOffsetSlider = 128; // 0-255
    int tiltOffsetSlider = 128; // 0-255
    int irisChannelSlider = 0; // 0-512 (0 = disabled)
    int zoomChannelSlider = 0; // 0-512 (0 = disabled)
    int focusChannelSlider = 0; // 0-512 (0 = disabled)
    int irisValueSlider = 128; // 0-255
    int zoomValueSlider = 128; // 0-255
    int focusValueSlider = 128; // 0-255
    int cameraIndexSlider = 0; // 0-10
    int irisMinSlider = 0; // 0-255
    int irisMaxSlider = 255; // 0-255
    int zoomMinSlider = 0; // 0-255
    int zoomMaxSlider = 255; // 0-255
    int focusMinSlider = 0; // 0-255
    int focusMaxSlider = 255; // 0-255
    int autoOrbitSpeedSlider = 10; // 0-100, represents 0.0-10.0 degrees per frame
};

// Callback for libcurl to write response
static size_t WriteCallback(void *contents, size_t size, size_t nmemb, void *userp) {
    ((std::string*)userp)->append((char*)contents, size * nmemb);
    return size * nmemb;
}

// Forward declarations
void saveConfig(const Config& config, const std::string& configPath);

// Detect gestures from head movement history
std::string detectGesture(std::vector<float>& panHistory, std::vector<float>& tiltHistory, float currentPan, float currentTilt) {
    // Need at least 10 frames of history
    if (panHistory.size() < 10 || tiltHistory.size() < 10) {
        return "";
    }
    
    // Calculate movement patterns
    // For nodding: look for vertical (tilt) oscillation
    // For shaking: look for horizontal (pan) oscillation
    
    // Analyze recent tilt changes for nodding
    float tiltRange = 0.0f;
    int tiltDirectionChanges = 0;
    float lastTiltDir = 0.0f;
    
    for (size_t i = 1; i < tiltHistory.size(); i++) {
        float tiltChange = tiltHistory[i] - tiltHistory[i-1];
        float currentDir = (tiltChange > 0.05f) ? 1.0f : ((tiltChange < -0.05f) ? -1.0f : 0.0f);
        
        if (currentDir != 0 && currentDir != lastTiltDir && lastTiltDir != 0) {
            tiltDirectionChanges++;
        }
        if (currentDir != 0) lastTiltDir = currentDir;
        
        tiltRange = std::max(tiltRange, std::abs(tiltChange));
    }
    
    // Analyze recent pan changes for head shaking
    float panRange = 0.0f;
    int panDirectionChanges = 0;
    float lastPanDir = 0.0f;
    
    for (size_t i = 1; i < panHistory.size(); i++) {
        float panChange = panHistory[i] - panHistory[i-1];
        float currentDir = (panChange > 0.05f) ? 1.0f : ((panChange < -0.05f) ? -1.0f : 0.0f);
        
        if (currentDir != 0 && currentDir != lastPanDir && lastPanDir != 0) {
            panDirectionChanges++;
        }
        if (currentDir != 0) lastPanDir = currentDir;
        
        panRange = std::max(panRange, std::abs(panChange));
    }
    
    // Detect nodding (vertical oscillation with direction changes)
    if (tiltDirectionChanges >= 2 && tiltRange > 0.1f) {
        return "NODDING";
    }
    
    // Detect head shaking (horizontal oscillation with direction changes)
    if (panDirectionChanges >= 2 && panRange > 0.1f) {
        return "SHAKING";
    }
    
    // Detect looking up (sustained upward tilt)
    if (tiltHistory.size() >= 10) {
        float avgRecentTilt = 0.0f;
        for (size_t i = tiltHistory.size() - 10; i < tiltHistory.size(); i++) {
            avgRecentTilt += tiltHistory[i];
        }
        avgRecentTilt /= 10.0f;
        if (avgRecentTilt < -0.3f) { // Looking up
            return "LOOKING_UP";
        }
        if (avgRecentTilt > 0.3f) { // Looking down
            return "LOOKING_DOWN";
        }
    }
    
    // Detect looking left/right (sustained pan)
    if (panHistory.size() >= 10) {
        float avgRecentPan = 0.0f;
        for (size_t i = panHistory.size() - 10; i < panHistory.size(); i++) {
            avgRecentPan += panHistory[i];
        }
        avgRecentPan /= 10.0f;
        if (avgRecentPan < -0.3f) { // Looking left
            return "LOOKING_LEFT";
        }
        if (avgRecentPan > 0.3f) { // Looking right
            return "LOOKING_RIGHT";
        }
    }
    
    return "";
}

// Helper function to pad OSC string to 4-byte boundary
void padOSCString(std::vector<uint8_t>& buffer, const std::string& str) {
    for (char c : str) {
        buffer.push_back(static_cast<uint8_t>(c));
    }
    buffer.push_back(0); // Null terminator
    // Pad to 4-byte boundary
    while (buffer.size() % 4 != 0) {
        buffer.push_back(0);
    }
}

// Send OSC message via UDP
bool sendOSCMessage(const std::string& host, int port, const std::string& path, float value) {
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        std::cerr << "Failed to create OSC socket" << std::endl;
        return false;
    }
    
    struct sockaddr_in serverAddr;
    std::memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(port);
    
    if (inet_pton(AF_INET, host.c_str(), &serverAddr.sin_addr) <= 0) {
        std::cerr << "Invalid OSC host address: " << host << std::endl;
#ifdef _WIN32
        closesocket(sock);
#else
        close(sock);
#endif
        return false;
    }
    
    // Build OSC message: path + type tag + float value
    std::vector<uint8_t> message;
    
    // OSC address pattern (path)
    padOSCString(message, path);
    
    // OSC type tag string (",f" for float)
    padOSCString(message, ",f");
    
    // Float value (big-endian 32-bit float)
    union {
        float f;
        uint8_t bytes[4];
    } floatUnion;
    floatUnion.f = value;
    
    // OSC uses big-endian byte order
    #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
        message.push_back(floatUnion.bytes[3]);
        message.push_back(floatUnion.bytes[2]);
        message.push_back(floatUnion.bytes[1]);
        message.push_back(floatUnion.bytes[0]);
    #else
        message.push_back(floatUnion.bytes[0]);
        message.push_back(floatUnion.bytes[1]);
        message.push_back(floatUnion.bytes[2]);
        message.push_back(floatUnion.bytes[3]);
    #endif
    
    // Send message
#ifdef _WIN32
    int sent = sendto(sock, (const char*)message.data(), (int)message.size(), 0,
                     (struct sockaddr*)&serverAddr, sizeof(serverAddr));
#else
    ssize_t sent = sendto(sock, (const char*)message.data(), message.size(), 0,
                         (struct sockaddr*)&serverAddr, sizeof(serverAddr));
#endif
    
#ifdef _WIN32
    closesocket(sock);
#else
    close(sock);
#endif
    
    if (sent < 0) {
        std::cerr << "Failed to send OSC message to " << host << ":" << port << std::endl;
        return false;
    }
    
    return true;
}

// Send DMX values via HTTP API or OSC (based on config)
bool sendDmxValues(const Config& config, int panValue, int tiltValue) {
    if (config.useOSC) {
        // Send via OSC
        bool panOK = sendOSCMessage(config.oscHost, config.oscPort, config.oscPanPath, 
                                     static_cast<float>(panValue) / 255.0f); // Normalize to 0.0-1.0
        bool tiltOK = sendOSCMessage(config.oscHost, config.oscPort, config.oscTiltPath, 
                                      static_cast<float>(tiltValue) / 255.0f); // Normalize to 0.0-1.0
        
        // Send optional channels if configured
        if (config.irisChannel > 0) {
            sendOSCMessage(config.oscHost, config.oscPort, config.oscIrisPath, 
                          static_cast<float>(config.irisValue) / 255.0f);
        }
        if (config.zoomChannel > 0) {
            sendOSCMessage(config.oscHost, config.oscPort, config.oscZoomPath, 
                          static_cast<float>(config.zoomValue) / 255.0f);
        }
        if (config.focusChannel > 0) {
            sendOSCMessage(config.oscHost, config.oscPort, config.oscFocusPath, 
                          static_cast<float>(config.focusValue) / 255.0f);
        }
        
        return panOK && tiltOK;
    } else {
        // Send via HTTP API (original implementation)
        // Build JSON payload with all configured channels
        // Validate channels are > 0 before sending (channels are 1-indexed in config, 0-indexed in API)
        json payload;
        if (config.panChannel > 0) {
            payload[std::to_string(config.panChannel - 1)] = panValue;  // DMX channels are 0-indexed in API
        }
        if (config.tiltChannel > 0) {
            payload[std::to_string(config.tiltChannel - 1)] = tiltValue;
        }
        
        // Add optional channels if configured (0 = disabled)
        if (config.irisChannel > 0) {
            payload[std::to_string(config.irisChannel - 1)] = config.irisValue;
        }
        if (config.zoomChannel > 0) {
            payload[std::to_string(config.zoomChannel - 1)] = config.zoomValue;
        }
        if (config.focusChannel > 0) {
            payload[std::to_string(config.focusChannel - 1)] = config.focusValue;
        }
        
        // Don't send if no channels are configured
        if (payload.empty()) {
            return true;  // No channels to send, but not an error
        }
        
        std::string jsonStr = payload.dump();
        
        // Ensure jsonStr is valid JSON (should never be "null" string)
        if (jsonStr.empty() || jsonStr == "null") {
            std::cerr << "Invalid JSON payload generated" << std::endl;
            return false;
        }
        
        CURL *curl;
        CURLcode res;
        std::string readBuffer;
        
        curl = curl_easy_init();
        if (!curl) {
            std::cerr << "Failed to initialize curl" << std::endl;
            return false;
        }
        
        // Setup curl
        struct curl_slist *headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        
        curl_easy_setopt(curl, CURLOPT_URL, config.dmxApiUrl.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonStr.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 1L);
        
        res = curl_easy_perform(curl);
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        
        if (res != CURLE_OK) {
            std::cerr << "curl_easy_perform() failed: " << curl_easy_strerror(res) << std::endl;
            return false;
        }
        
        return true;
    }
}

// Load configuration from JSON file
Config loadConfig(const std::string& configPath = "face-tracker-config.json") {
    Config config;
    std::ifstream file(configPath);
    
    if (!file.is_open()) {
        std::cout << "Config file not found, using defaults. Creating " << configPath << std::endl;
        // Save default config
        saveConfig(config, configPath);
        return config;
    }
    
    json j;
    file >> j;
    
    if (j.contains("dmxApiUrl")) config.dmxApiUrl = j["dmxApiUrl"];
    if (j.contains("panChannel")) config.panChannel = j["panChannel"];
    if (j.contains("tiltChannel")) config.tiltChannel = j["tiltChannel"];
    if (j.contains("irisChannel")) config.irisChannel = j["irisChannel"];
    if (j.contains("zoomChannel")) config.zoomChannel = j["zoomChannel"];
    if (j.contains("focusChannel")) config.focusChannel = j["focusChannel"];
    if (j.contains("cameraIndex")) config.cameraIndex = j["cameraIndex"];
    if (j.contains("updateRate")) config.updateRate = j["updateRate"];
    if (j.contains("panSensitivity")) config.panSensitivity = j["panSensitivity"];
    if (j.contains("tiltSensitivity")) config.tiltSensitivity = j["tiltSensitivity"];
    if (j.contains("panOffset")) config.panOffset = j["panOffset"];
    if (j.contains("tiltOffset")) config.tiltOffset = j["tiltOffset"];
    if (j.contains("irisValue")) config.irisValue = j["irisValue"];
    if (j.contains("zoomValue")) config.zoomValue = j["zoomValue"];
    if (j.contains("focusValue")) config.focusValue = j["focusValue"];
    if (j.contains("showPreview")) config.showPreview = j["showPreview"];
    if (j.contains("show3DVisualization")) config.show3DVisualization = j["show3DVisualization"];
    if (j.contains("smoothingFactor")) config.smoothingFactor = j["smoothingFactor"];
    if (j.contains("maxVelocity")) config.maxVelocity = j["maxVelocity"];
    if (j.contains("brightness")) config.brightness = j["brightness"];
    if (j.contains("contrast")) config.contrast = j["contrast"];
    if (j.contains("cameraExposure")) config.cameraExposure = j["cameraExposure"];
    if (j.contains("cameraBrightness")) config.cameraBrightness = j["cameraBrightness"];
    if (j.contains("autoExposure")) config.autoExposure = j["autoExposure"];
    
    // OSC configuration
    if (j.contains("useOSC")) config.useOSC = j["useOSC"];
    if (j.contains("oscHost")) config.oscHost = j["oscHost"];
    if (j.contains("oscPort")) config.oscPort = j["oscPort"];
    if (j.contains("oscPanPath")) config.oscPanPath = j["oscPanPath"];
    if (j.contains("oscTiltPath")) config.oscTiltPath = j["oscTiltPath"];
    if (j.contains("oscIrisPath")) config.oscIrisPath = j["oscIrisPath"];
    if (j.contains("oscZoomPath")) config.oscZoomPath = j["oscZoomPath"];
    if (j.contains("oscFocusPath")) config.oscFocusPath = j["oscFocusPath"];
    
    // Range cutoffs
    if (j.contains("panMin")) config.panMin = j["panMin"];
    if (j.contains("panMax")) config.panMax = j["panMax"];
    if (j.contains("tiltMin")) config.tiltMin = j["tiltMin"];
    if (j.contains("tiltMax")) config.tiltMax = j["tiltMax"];
    if (j.contains("irisMin")) config.irisMin = j["irisMin"];
    if (j.contains("irisMax")) config.irisMax = j["irisMax"];
    if (j.contains("zoomMin")) config.zoomMin = j["zoomMin"];
    if (j.contains("zoomMax")) config.zoomMax = j["zoomMax"];
    if (j.contains("focusMin")) config.focusMin = j["focusMin"];
    if (j.contains("focusMax")) config.focusMax = j["focusMax"];
    
    // Rigging parameters
    if (j.contains("panScale")) config.panScale = j["panScale"];
    if (j.contains("tiltScale")) config.tiltScale = j["tiltScale"];
    if (j.contains("panDeadZone")) config.panDeadZone = j["panDeadZone"];
    if (j.contains("tiltDeadZone")) config.tiltDeadZone = j["tiltDeadZone"];
    if (j.contains("panLimit")) config.panLimit = j["panLimit"];
    if (j.contains("tiltLimit")) config.tiltLimit = j["tiltLimit"];
    if (j.contains("panGear")) config.panGear = j["panGear"];
    if (j.contains("tiltGear")) config.tiltGear = j["tiltGear"];
    
    return config;
}

// Save configuration to JSON file
void saveConfig(const Config& config, const std::string& configPath = "face-tracker-config.json") {
    json j;
    j["dmxApiUrl"] = config.dmxApiUrl;
    j["panChannel"] = config.panChannel;
    j["tiltChannel"] = config.tiltChannel;
    j["irisChannel"] = config.irisChannel;
    j["zoomChannel"] = config.zoomChannel;
    j["focusChannel"] = config.focusChannel;
    j["cameraIndex"] = config.cameraIndex;
    j["updateRate"] = config.updateRate;
    j["panSensitivity"] = config.panSensitivity;
    j["tiltSensitivity"] = config.tiltSensitivity;
    j["panOffset"] = config.panOffset;
    j["tiltOffset"] = config.tiltOffset;
    j["irisValue"] = config.irisValue;
    j["zoomValue"] = config.zoomValue;
    j["focusValue"] = config.focusValue;
    j["showPreview"] = config.showPreview;
    j["show3DVisualization"] = config.show3DVisualization;
    j["smoothingFactor"] = config.smoothingFactor;
    j["maxVelocity"] = config.maxVelocity;
    j["brightness"] = config.brightness;
    j["contrast"] = config.contrast;
    j["cameraExposure"] = config.cameraExposure;
    j["cameraBrightness"] = config.cameraBrightness;
    j["autoExposure"] = config.autoExposure;
    
    // OSC configuration
    j["useOSC"] = config.useOSC;
    j["oscHost"] = config.oscHost;
    j["oscPort"] = config.oscPort;
    j["oscPanPath"] = config.oscPanPath;
    j["oscTiltPath"] = config.oscTiltPath;
    j["oscIrisPath"] = config.oscIrisPath;
    j["oscZoomPath"] = config.oscZoomPath;
    j["oscFocusPath"] = config.oscFocusPath;
    
    // Range cutoffs
    j["panMin"] = config.panMin;
    j["panMax"] = config.panMax;
    j["tiltMin"] = config.tiltMin;
    j["tiltMax"] = config.tiltMax;
    j["irisMin"] = config.irisMin;
    j["irisMax"] = config.irisMax;
    j["zoomMin"] = config.zoomMin;
    j["zoomMax"] = config.zoomMax;
    j["focusMin"] = config.focusMin;
    j["focusMax"] = config.focusMax;
    
    // Rigging parameters
    j["panScale"] = config.panScale;
    j["tiltScale"] = config.tiltScale;
    j["panDeadZone"] = config.panDeadZone;
    j["tiltDeadZone"] = config.tiltDeadZone;
    j["panLimit"] = config.panLimit;
    j["tiltLimit"] = config.tiltLimit;
    j["panGear"] = config.panGear;
    j["tiltGear"] = config.tiltGear;
    
    std::ofstream file(configPath);
    file << j.dump(2);
}

// Estimate head pose from facial landmarks
void estimateHeadPose(const std::vector<Point2f>& landmarks, 
                      const Size& imageSize,
                      float& pan, float& tilt) {
    if (landmarks.size() < 68) return; // Need full 68-point model
    
    // Key facial landmark indices (for 68-point model)
    // Left eye corner
    Point2f leftEye = landmarks[36];
    // Right eye corner
    Point2f rightEye = landmarks[45];
    
    // Calculate face center
    Point2f faceCenter = (leftEye + rightEye) / 2.0f;
    
    // Calculate image center
    Point2f imageCenter(imageSize.width / 2.0f, imageSize.height / 2.0f);
    
    // Pan (horizontal) - based on face center offset from image center
    float panOffset = (faceCenter.x - imageCenter.x) / imageCenter.x;
    pan = panOffset; // -1.0 to 1.0
    
    // Tilt (vertical) - based on face center offset from image center
    float tiltOffset = (faceCenter.y - imageCenter.y) / imageCenter.y;
    tilt = tiltOffset; // -1.0 to 1.0
    
    // Optional: Use nose direction for better pan estimation
    // Calculate face angle from eye alignment
    Point2f eyeVector = rightEye - leftEye;
    float eyeAngle = atan2(eyeVector.y, eyeVector.x);
    // Normalize to -1 to 1 range
    pan = pan * 0.7f + (eyeAngle / CV_PI) * 0.3f;
}

// Improved smoothing with velocity limiting
void smoothWithVelocity(float& current, float target, float& velocity, float smoothing, float maxVel) {
    // Calculate desired change
    float error = target - current;
    
    // Update velocity (with damping)
    velocity = velocity * smoothing + error * (1.0f - smoothing);
    
    // Limit velocity to max
    if (velocity > maxVel) velocity = maxVel;
    if (velocity < -maxVel) velocity = -maxVel;
    
    // Apply velocity to current position
    current += velocity;
    
    // Optional: apply additional smoothing directly
    current = current * smoothing + target * (1.0f - smoothing);
}

// Map head movement to DMX values (0-255) with rigging parameters
void mapToDmx(const float pan, const float tilt, const Config& config, int& panValue, int& tiltValue) {
    // Apply dead zone (ignore small movements)
    float adjustedPan = pan;
    float adjustedTilt = tilt;
    
    if (std::abs(pan) < config.panDeadZone) {
        adjustedPan = 0.0f;
    } else {
        // Remove dead zone from value
        float sign = pan > 0 ? 1.0f : -1.0f;
        adjustedPan = sign * (std::abs(pan) - config.panDeadZone) / (1.0f - config.panDeadZone);
    }
    
    if (std::abs(tilt) < config.tiltDeadZone) {
        adjustedTilt = 0.0f;
    } else {
        float sign = tilt > 0 ? 1.0f : -1.0f;
        adjustedTilt = sign * (std::abs(tilt) - config.tiltDeadZone) / (1.0f - config.tiltDeadZone);
    }
    
    // Apply rigging: scale, sensitivity, gear ratio, and limit
    float panMovement = adjustedPan * config.panSensitivity * config.panScale / config.panGear * config.panLimit;
    float tiltMovement = adjustedTilt * config.tiltSensitivity * config.tiltScale / config.tiltGear * config.tiltLimit;
    
    // Convert from -1.0 to 1.0 range to 0-255, with offset
    panValue = static_cast<int>(config.panOffset + (panMovement * 127.0f));
    tiltValue = static_cast<int>(config.tiltOffset + (tiltMovement * 127.0f));
    
    // Clamp to configured min/max ranges (not just 0-255)
    panValue = std::max(config.panMin, std::min(config.panMax, panValue));
    tiltValue = std::max(config.tiltMin, std::min(config.tiltMax, tiltValue));
}

// Helper: 3D point to 2D projection with viewport rotation
Point project3D(float x, float y, float z, float viewAngleX, float viewAngleY, float viewDist, 
                int centerX, int centerY, int scale) {
    // Rotate around Y axis (pan rotation)
    float cosY = std::cos(viewAngleY * CV_PI / 180.0f);
    float sinY = std::sin(viewAngleY * CV_PI / 180.0f);
    float x1 = x * cosY - z * sinY;
    float z1 = x * sinY + z * cosY;
    
    // Rotate around X axis (tilt rotation)
    float cosX = std::cos(viewAngleX * CV_PI / 180.0f);
    float sinX = std::sin(viewAngleX * CV_PI / 180.0f);
    float y1 = y * cosX - z1 * sinX;
    float z2 = y * sinX + z1 * cosX;
    
    // Perspective projection
    float perspective = 1.0f / (viewDist + z2 * 0.001f);
    int px = centerX + static_cast<int>(x1 * scale * perspective);
    int py = centerY - static_cast<int>(y1 * scale * perspective); // Flip Y for screen coordinates
    
    return Point(px, py);
}

// Draw XYZ coordinate axes/lattice
void drawXYZAxes(Mat& canvas, float viewAngleX, float viewAngleY, float viewDist, int centerX, int centerY, int scale) {
    // Draw coordinate axes (RGB = XYZ)
    // X axis (red) - horizontal
    Point xStart = project3D(0, 0, 0, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
    Point xEnd = project3D(0.3f, 0, 0, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
    line(canvas, xStart, xEnd, Scalar(0, 0, 255), 2); // Red (BGR)
    putText(canvas, "X", xEnd, FONT_HERSHEY_SIMPLEX, 0.4, Scalar(0, 0, 255), 1);
    
    // Y axis (green) - vertical
    Point yStart = project3D(0, 0, 0, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
    Point yEnd = project3D(0, 0.3f, 0, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
    line(canvas, yStart, yEnd, Scalar(0, 255, 0), 2); // Green (BGR)
    putText(canvas, "Y", yEnd, FONT_HERSHEY_SIMPLEX, 0.4, Scalar(0, 255, 0), 1);
    
    // Z axis (blue) - depth
    Point zStart = project3D(0, 0, 0, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
    Point zEnd = project3D(0, 0, 0.3f, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
    line(canvas, zStart, zEnd, Scalar(255, 0, 0), 2); // Blue (BGR)
    putText(canvas, "Z", zEnd, FONT_HERSHEY_SIMPLEX, 0.4, Scalar(255, 0, 0), 1);
    
    // Draw grid lines on XY plane (at Z=0)
    int gridSize = 5;
    float gridSpacing = 0.1f;
    Scalar gridColor(100, 100, 100);
    
    for (int i = -gridSize; i <= gridSize; i++) {
        // Lines parallel to X axis
        Point g1 = project3D(-gridSize * gridSpacing, 0, i * gridSpacing, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
        Point g2 = project3D(gridSize * gridSpacing, 0, i * gridSpacing, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
        line(canvas, g1, g2, gridColor, 1);
        
        // Lines parallel to Z axis
        Point g3 = project3D(i * gridSpacing, 0, -gridSize * gridSpacing, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
        Point g4 = project3D(i * gridSpacing, 0, gridSize * gridSpacing, viewAngleX, viewAngleY, viewDist, centerX, centerY, scale);
        line(canvas, g3, g4, gridColor, 1);
    }
}

// Render configuration window with all settings and visualization
// Render rigging visualization preview only (configuration UI is now in React)
void renderRiggingPreview(Mat& canvas, FaceTrackerState& state, float currentPan, float currentTilt) {
    int width = canvas.cols;
    int height = canvas.rows;
    
    // Clear with dark background
    canvas = Scalar(30, 30, 40);
    
    int x = 20;
    int lineHeight = 22;
    Scalar textColor(255, 255, 255);
    Scalar headerColor(150, 200, 255);
    Scalar valueColor(200, 255, 200);
    
    int y = 20;
    
    // Title
    putText(canvas, "Face Movement -> DMX Mapping Preview", Point(x, y),
           FONT_HERSHEY_DUPLEX, 0.7, headerColor, 2);
    y += lineHeight * 2;
    
    putText(canvas, "(Configure in React UI)", Point(x, y),
           FONT_HERSHEY_SIMPLEX, 0.4, Scalar(150, 150, 150), 1);
    y += lineHeight + 10;
    
    // Draw visualization area
    int vizX = x + 20;
    int vizY = y;
    int vizWidth = width - 2 * x - 40;
    int vizHeight = height - vizY - 60;
    
    // Background for visualization
    rectangle(canvas, Point(vizX, vizY), Point(vizX + vizWidth, vizY + vizHeight), 
             Scalar(20, 20, 30), -1);
    rectangle(canvas, Point(vizX, vizY), Point(vizX + vizWidth, vizY + vizHeight), 
             Scalar(100, 100, 100), 1);
    
    // Draw axes
    int centerX = vizX + vizWidth / 2;
    int centerY = vizY + vizHeight / 2;
    
    // Horizontal axis (Pan)
    line(canvas, Point(vizX, centerY), Point(vizX + vizWidth, centerY), Scalar(100, 100, 100), 1);
    putText(canvas, "Pan (-1.0)", Point(vizX + 5, centerY - 5), FONT_HERSHEY_SIMPLEX, 0.3, textColor, 1);
    putText(canvas, "Pan (+1.0)", Point(vizX + vizWidth - 60, centerY - 5), FONT_HERSHEY_SIMPLEX, 0.3, textColor, 1);
    
    // Vertical axis (Tilt)
    line(canvas, Point(centerX, vizY), Point(centerX, vizY + vizHeight), Scalar(100, 100, 100), 1);
    putText(canvas, "Tilt (+1.0)", Point(centerX + 5, vizY + 15), FONT_HERSHEY_SIMPLEX, 0.3, textColor, 1);
    putText(canvas, "Tilt (-1.0)", Point(centerX + 5, vizY + vizHeight - 5), FONT_HERSHEY_SIMPLEX, 0.3, textColor, 1);
    
    // Draw range boxes (min/max limits)
    int panMinX = vizX + static_cast<int>((state.config.panMin / 255.0f) * vizWidth);
    int panMaxX = vizX + static_cast<int>((state.config.panMax / 255.0f) * vizWidth);
    rectangle(canvas, Point(vizX, vizY), Point(panMinX, vizY + vizHeight), 
             Scalar(50, 0, 0), -1); // Red for clamped min
    rectangle(canvas, Point(panMaxX, vizY), Point(vizX + vizWidth, vizY + vizHeight), 
             Scalar(50, 0, 0), -1); // Red for clamped max
    
    // Draw current face position
    if (state.faceDetected) {
        // Map face position to visualization
        int faceX = centerX + static_cast<int>(currentPan * (vizWidth / 2));
        int faceY = centerY - static_cast<int>(currentTilt * (vizHeight / 2));
        faceX = std::max(vizX, std::min(vizX + vizWidth, faceX));
        faceY = std::max(vizY, std::min(vizY + vizHeight, faceY));
        
        // Draw face position indicator
        circle(canvas, Point(faceX, faceY), 8, Scalar(0, 255, 255), -1); // Yellow circle
        circle(canvas, Point(faceX, faceY), 8, Scalar(255, 255, 255), 2); // White border
        
        // Calculate and show DMX values
        int panValue, tiltValue;
        mapToDmx(currentPan, currentTilt, state.config, panValue, tiltValue);
        
        // Draw DMX output position
        int dmxX = vizX + static_cast<int>((panValue / 255.0f) * vizWidth);
        int dmxY = centerY - static_cast<int>(((tiltValue - 128) / 127.0f) * (vizHeight / 2));
        dmxX = std::max(vizX, std::min(vizX + vizWidth, dmxX));
        dmxY = std::max(vizY, std::min(vizY + vizHeight, dmxY));
        
        // Draw line from face to DMX output
        line(canvas, Point(faceX, faceY), Point(dmxX, dmxY), Scalar(100, 255, 100), 2);
        
        // Draw DMX output indicator
        circle(canvas, Point(dmxX, dmxY), 6, Scalar(0, 255, 0), -1); // Green circle
        circle(canvas, Point(dmxX, dmxY), 6, Scalar(255, 255, 255), 2); // White border
        
        // Show values
        putText(canvas, "Face: (" + std::to_string(currentPan).substr(0, 3) + "," + 
               std::to_string(currentTilt).substr(0, 3) + ")", 
               Point(faceX - 30, faceY - 15), FONT_HERSHEY_SIMPLEX, 0.35, Scalar(255, 255, 255), 1);
        putText(canvas, "DMX: (" + std::to_string(panValue) + "," + std::to_string(tiltValue) + ")", 
               Point(dmxX - 25, dmxY + 20), FONT_HERSHEY_SIMPLEX, 0.35, Scalar(200, 255, 200), 1);
    }
    
    // Legend
    y = vizY + vizHeight + 15;
    putText(canvas, "Legend: Yellow = Face Position | Green = DMX Output | Red = Clamped Range", 
           Point(x, y), FONT_HERSHEY_SIMPLEX, 0.35, textColor, 1);
}

// Helper function to reload config periodically (called from main loop)
void reloadConfigIfChanged(Config& config) {
    static std::chrono::steady_clock::time_point lastCheck = std::chrono::steady_clock::now();
    static std::string lastConfigHash;
    
    auto now = std::chrono::steady_clock::now();
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastCheck).count();
    
    // Check every 500ms
    if (elapsed < 500) {
        return;
    }
    
    lastCheck = now;
    
    // Read config file
    std::ifstream file("face-tracker-config.json");
    if (!file.is_open()) {
        return;
    }
    
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();
    
    // Simple hash to detect changes
    std::hash<std::string> hasher;
    std::string currentHash = std::to_string(hasher(content));
    
    if (currentHash != lastConfigHash) {
        lastConfigHash = currentHash;
        
        try {
            json j = json::parse(content);
            
            // Reload all config values
            if (j.contains("dmxApiUrl")) config.dmxApiUrl = j["dmxApiUrl"];
            if (j.contains("panChannel")) config.panChannel = j["panChannel"];
            if (j.contains("tiltChannel")) config.tiltChannel = j["tiltChannel"];
            if (j.contains("irisChannel")) config.irisChannel = j["irisChannel"];
            if (j.contains("zoomChannel")) config.zoomChannel = j["zoomChannel"];
            if (j.contains("focusChannel")) config.focusChannel = j["focusChannel"];
            if (j.contains("cameraIndex")) config.cameraIndex = j["cameraIndex"];
            if (j.contains("updateRate")) config.updateRate = j["updateRate"];
            if (j.contains("panSensitivity")) config.panSensitivity = j["panSensitivity"];
            if (j.contains("tiltSensitivity")) config.tiltSensitivity = j["tiltSensitivity"];
            if (j.contains("panOffset")) config.panOffset = j["panOffset"];
            if (j.contains("tiltOffset")) config.tiltOffset = j["tiltOffset"];
            if (j.contains("irisValue")) config.irisValue = j["irisValue"];
            if (j.contains("zoomValue")) config.zoomValue = j["zoomValue"];
            if (j.contains("focusValue")) config.focusValue = j["focusValue"];
            if (j.contains("showPreview")) config.showPreview = j["showPreview"];
            if (j.contains("show3DVisualization")) config.show3DVisualization = j["show3DVisualization"];
            if (j.contains("smoothingFactor")) config.smoothingFactor = j["smoothingFactor"];
            if (j.contains("maxVelocity")) config.maxVelocity = j["maxVelocity"];
            if (j.contains("brightness")) config.brightness = j["brightness"];
            if (j.contains("contrast")) config.contrast = j["contrast"];
            if (j.contains("cameraExposure")) config.cameraExposure = j["cameraExposure"];
            if (j.contains("cameraBrightness")) config.cameraBrightness = j["cameraBrightness"];
            if (j.contains("autoExposure")) config.autoExposure = j["autoExposure"];
            if (j.contains("useOSC")) config.useOSC = j["useOSC"];
            if (j.contains("oscHost")) config.oscHost = j["oscHost"];
            if (j.contains("oscPort")) config.oscPort = j["oscPort"];
            if (j.contains("oscPanPath")) config.oscPanPath = j["oscPanPath"];
            if (j.contains("oscTiltPath")) config.oscTiltPath = j["oscTiltPath"];
            if (j.contains("oscIrisPath")) config.oscIrisPath = j["oscIrisPath"];
            if (j.contains("oscZoomPath")) config.oscZoomPath = j["oscZoomPath"];
            if (j.contains("oscFocusPath")) config.oscFocusPath = j["oscFocusPath"];
            if (j.contains("panMin")) config.panMin = j["panMin"];
            if (j.contains("panMax")) config.panMax = j["panMax"];
            if (j.contains("tiltMin")) config.tiltMin = j["tiltMin"];
            if (j.contains("tiltMax")) config.tiltMax = j["tiltMax"];
            if (j.contains("irisMin")) config.irisMin = j["irisMin"];
            if (j.contains("irisMax")) config.irisMax = j["irisMax"];
            if (j.contains("zoomMin")) config.zoomMin = j["zoomMin"];
            if (j.contains("zoomMax")) config.zoomMax = j["zoomMax"];
            if (j.contains("focusMin")) config.focusMin = j["focusMin"];
            if (j.contains("focusMax")) config.focusMax = j["focusMax"];
            if (j.contains("panScale")) config.panScale = j["panScale"];
            if (j.contains("tiltScale")) config.tiltScale = j["tiltScale"];
            if (j.contains("panDeadZone")) config.panDeadZone = j["panDeadZone"];
            if (j.contains("tiltDeadZone")) config.tiltDeadZone = j["tiltDeadZone"];
            if (j.contains("panLimit")) config.panLimit = j["panLimit"];
            if (j.contains("tiltLimit")) config.tiltLimit = j["tiltLimit"];
            if (j.contains("panGear")) config.panGear = j["panGear"];
            if (j.contains("tiltGear")) config.tiltGear = j["tiltGear"];
            
            std::cout << "Configuration reloaded from React UI" << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "Error reloading config: " << e.what() << std::endl;
        }
    }
}

// Render detailed 3D moving head fixture visualization
void render3DFixture(Mat& canvas, float /*panAngle*/, float /*tiltAngle*/, int panDmx, int tiltDmx, 
                     float viewAngleX, float viewAngleY, float viewDist, bool showLattice) {
    int width = canvas.cols;
    int height = canvas.rows;
    
    // Center point
    Point center(width / 2, height / 2);
    int scale = std::min(width, height) / 4;
    
    // Convert pan/tilt to radians
    float panRad = ((panDmx - 128) / 128.0f) * CV_PI / 2.0f;
    float tiltRad = ((tiltDmx - 128) / 128.0f) * CV_PI / 4.0f;
    
    // Define 3D model coordinates (in fixture-local space)
    // Base stand (cylindrical)
    float baseHeight = 0.8f;
    float baseRadius = 0.15f;
    int baseSegments = 12;
    
    // Pan arm (horizontal bar)
    float armLength = 0.4f;
    
    // Fixture head dimensions
    float headLength = 0.35f;
    float headWidth = 0.25f;
    float headHeight = 0.2f;
    
    // Draw base stand (vertical cylinder from bottom)
    Scalar baseColor(80, 80, 90); // Dark gray metallic
    Scalar armColor(120, 120, 130); // Lighter gray
    Scalar headColor(150, 150, 180); // Purple-tinted metallic
    Scalar lensColor(255, 220, 100); // Warm yellow/orange
    Scalar beamColor(255, 200, 50, 180); // Yellow beam with transparency
    
    // Base cylinder - draw top and bottom circles
    std::vector<Point> baseBottom, baseTop;
    for (int i = 0; i < baseSegments; i++) {
        float angle = (i / float(baseSegments)) * 2.0f * CV_PI;
        float x = std::cos(angle) * baseRadius;
        float y = std::sin(angle) * baseRadius;
        baseBottom.push_back(project3D(x, -baseHeight/2, y, viewAngleX, viewAngleY, viewDist, center.x, center.y, scale));
        baseTop.push_back(project3D(x, baseHeight/2, y, viewAngleX, viewAngleY, viewDist, center.x, center.y, scale));
    }
    
    // Draw base cylinder sides
    for (size_t i = 0; i < baseBottom.size(); i++) {
        line(canvas, baseBottom[i], baseTop[i], baseColor, 3);
        line(canvas, baseBottom[i], baseBottom[(i+1) % baseBottom.size()], baseColor, 2);
        line(canvas, baseTop[i], baseTop[(i+1) % baseTop.size()], baseColor, 2);
    }
    
    // Pan rotation - rotate arm around Y axis
    float cosPan = std::cos(panRad);
    float sinPan = std::sin(panRad);
    
    // Pan arm (horizontal bar extending from base)
    Point armStart = project3D(0, baseHeight/2 + 0.05f, 0, viewAngleX, viewAngleY, viewDist, center.x, center.y, scale);
    Point armEnd = project3D(armLength * cosPan, baseHeight/2 + 0.05f, armLength * sinPan, 
                             viewAngleX, viewAngleY, viewDist, center.x, center.y, scale);
    
    // Draw pan arm with thickness
    line(canvas, armStart, armEnd, armColor, 8);
    
    // Pan joint (rotating connection)
    circle(canvas, armStart, 6, Scalar(200, 200, 210), -1);
    circle(canvas, armStart, 6, Scalar(255, 255, 255), 2);
    
    // Fixture head position (at end of arm, with tilt rotation)
    float headX = armLength * cosPan;
    float headZ = armLength * sinPan;
    float headY = baseHeight/2 + 0.1f;
    
    // Tilt rotation (around local X axis)
    float cosTilt = std::cos(tiltRad);
    float sinTilt = std::sin(tiltRad);
    
    // Define head corners in local space (before tilt)
    std::vector<std::vector<float>> headCornersLocal = {
        {-headWidth/2, headHeight/2, -headLength/2}, // Front-bottom-left
        {headWidth/2, headHeight/2, -headLength/2},  // Front-bottom-right
        {headWidth/2, -headHeight/2, -headLength/2}, // Front-top-right
        {-headWidth/2, -headHeight/2, -headLength/2},// Front-top-left
        {-headWidth/2, headHeight/2, headLength/2},  // Back-bottom-left
        {headWidth/2, headHeight/2, headLength/2},   // Back-bottom-right
        {headWidth/2, -headHeight/2, headLength/2},  // Back-top-right
        {-headWidth/2, -headHeight/2, headLength/2}  // Back-top-left
    };
    
    // Apply tilt rotation, then translate to head position, then pan rotation
    std::vector<Point> headCorners2D;
    for (const auto& corner : headCornersLocal) {
        // Apply tilt rotation (around X axis)
        float x = corner[0];
        float y = corner[1] * cosTilt - corner[2] * sinTilt;
        float z = corner[1] * sinTilt + corner[2] * cosTilt;
        
        // Translate to head position
        x += headX;
        y += headY;
        z += headZ;
        
        // Project to 2D
        headCorners2D.push_back(project3D(x, y, z, viewAngleX, viewAngleY, viewDist, center.x, center.y, scale));
    }
    
    // Draw head faces (box)
    // Front face (facing camera)
    std::vector<Point> frontFace = {headCorners2D[2], headCorners2D[3], headCorners2D[0], headCorners2D[1]};
    fillPoly(canvas, std::vector<std::vector<Point>>{frontFace}, headColor);
    
    // Top face
    std::vector<Point> topFace = {headCorners2D[3], headCorners2D[2], headCorners2D[6], headCorners2D[7]};
    fillPoly(canvas, std::vector<std::vector<Point>>{topFace}, Scalar(headColor[0]*1.2f, headColor[1]*1.2f, headColor[2]*1.2f));
    
    // Draw head edges
    for (int i = 0; i < 4; i++) {
        line(canvas, headCorners2D[i], headCorners2D[(i+1)%4], Scalar(255, 255, 255), 2); // Front face
        line(canvas, headCorners2D[i+4], headCorners2D[((i+1)%4)+4], Scalar(200, 200, 200), 2); // Back face
        line(canvas, headCorners2D[i], headCorners2D[i+4], Scalar(180, 180, 180), 2); // Connecting edges
    }
    
    // Draw lens (at front of head)
    Point lensCenter2D = project3D(headX, headY, headZ - headLength/2, 
                                    viewAngleX, viewAngleY, viewDist, center.x, center.y, scale);
    int lensRadius = scale / 15;
    circle(canvas, lensCenter2D, lensRadius, lensColor, -1);
    circle(canvas, lensCenter2D, lensRadius, Scalar(255, 255, 255), 2);
    
    // Draw light beam (from lens)
    float beamLength = 1.5f;
    float beamX = headX + std::sin(panRad + tiltRad) * beamLength;
    float beamY = headY - std::cos(tiltRad) * beamLength * 0.3f;
    float beamZ = headZ - headLength/2 - std::cos(panRad + tiltRad) * beamLength;
    Point beamEnd2D = project3D(beamX, beamY, beamZ, 
                                viewAngleX, viewAngleY, viewDist, center.x, center.y, scale);
    
    // Draw beam with gradient effect (lines from center to edge)
    for (int i = 0; i < 5; i++) {
        float t = i / 4.0f;
        int thickness = 5 - i;
        Scalar beamColorScalar(255 - i*30, 200 - i*20, 50 - i*5);
        Point beamMid = Point(lensCenter2D.x + (beamEnd2D.x - lensCenter2D.x) * t,
                              lensCenter2D.y + (beamEnd2D.y - lensCenter2D.y) * t);
        if (thickness > 0) {
            line(canvas, lensCenter2D, beamMid, beamColorScalar, thickness);
        }
    }
    
    // Draw tilt joint (at arm end)
    circle(canvas, armEnd, 5, Scalar(180, 180, 190), -1);
    circle(canvas, armEnd, 5, Scalar(255, 255, 255), 1);
    
    // Draw XYZ axes/lattice if enabled
    if (showLattice) {
        drawXYZAxes(canvas, viewAngleX, viewAngleY, viewDist, center.x, center.y, scale);
    }
    
    // Text overlay - moved to bottom to avoid title overlap
    std::string dmxText = "Pan: " + std::to_string(panDmx) + " | Tilt: " + std::to_string(tiltDmx);
    putText(canvas, dmxText, Point(10, height - 35), FONT_HERSHEY_SIMPLEX, 0.5, Scalar(200, 255, 200), 2);
    
    // Draw angles (moved lower)
    std::string angleText = "Pan: " + std::to_string(static_cast<int>(panRad * 180.0f / CV_PI)) + 
                           "° | Tilt: " + std::to_string(static_cast<int>(tiltRad * 180.0f / CV_PI)) + "°";
    putText(canvas, angleText, Point(10, height - 10), FONT_HERSHEY_SIMPLEX, 0.5, Scalar(200, 255, 200), 2);
    
}

// Apply brightness and contrast adjustments
void adjustBrightnessContrast(const Mat& src, Mat& dst, float brightness, float contrast) {
    // Brightness: add/subtract constant value
    // Contrast: multiply pixel values
    src.convertTo(dst, -1, contrast, (brightness - 1.0f) * 127.0f);
}

// Helper function to safely set camera property (checks if supported)
bool setCameraProperty(VideoCapture& cap, int propId, double value, const std::string& propName = "") {
    bool success = cap.set(propId, value);
    if (!success && !propName.empty()) {
        // Property not supported by this camera backend (e.g., GStreamer)
        // This is normal for some properties on certain cameras
    }
    return success;
}

// Trackbar callback functions
void onBrightnessTrackbar(int pos, void* userdata) {
    // Trackbar value 0-100 maps to brightness 0.0-3.0
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->brightnessSlider = pos;
    state->config.brightness = pos / 33.33f;  // 0-100 -> 0.0-3.0
    if (state->config.brightness < 0.1f) state->config.brightness = 0.1f;
}

void onContrastTrackbar(int pos, void* userdata) {
    // Trackbar value 0-100 maps to contrast 0.0-3.0
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->contrastSlider = pos;
    state->config.contrast = pos / 33.33f;  // 0-100 -> 0.0-3.0
    if (state->config.contrast < 0.1f) state->config.contrast = 0.1f;
}

void onExposureTrackbar(int pos, void* userdata) {
    // Trackbar value 0-100 maps to exposure adjustment
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->exposureSlider = pos;
    if (state->cap && state->cap->isOpened()) {
        // When exposure slider is moved, disable auto exposure and apply manual value
        state->config.autoExposure = false;
        setCameraProperty(*state->cap, CAP_PROP_AUTO_EXPOSURE, 0.25); // Manual exposure mode
        
        // Map 0-100 to exposure range (camera dependent, typically -13 to 1)
        // 0 = darkest (1), 100 = brightest (-13)
        // Note: Lower values = more exposure = brighter
        double exposure = 1.0 - (pos / 100.0) * 14.0;  // 1 to -13
        bool exposureSet = setCameraProperty(*state->cap, CAP_PROP_EXPOSURE, exposure);
        
        if (exposureSet) {
            // Update config only if property was actually set
            state->config.cameraExposure = static_cast<int>(exposure);
        }
        
        // Update auto-exposure trackbar to manual mode
        state->autoExposureSlider = 0;
        state->config.autoExposure = false;
    }
}

void onAutoExposureTrackbar(int pos, void* userdata) {
    // Trackbar: 0 = Manual (OFF), 1 = Auto (ON)
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->autoExposureSlider = pos;
    state->config.autoExposure = (pos == 1);
    
    if (state->cap && state->cap->isOpened()) {
        if (state->config.autoExposure) {
            bool success = setCameraProperty(*state->cap, CAP_PROP_AUTO_EXPOSURE, 0.75); // Auto exposure mode
            if (success) {
                std::cout << "Auto exposure enabled" << std::endl;
            }
        } else {
            bool autoExpSet = setCameraProperty(*state->cap, CAP_PROP_AUTO_EXPOSURE, 0.25); // Manual exposure mode
            // Apply current exposure slider value
            double exposure = 1.0 - (state->exposureSlider / 100.0) * 14.0;
            bool exposureSet = setCameraProperty(*state->cap, CAP_PROP_EXPOSURE, exposure);
            
            if (autoExpSet && exposureSet) {
                state->config.cameraExposure = static_cast<int>(exposure);
                std::cout << "Auto exposure disabled. Manual exposure: " << exposure << std::endl;
            }
        }
    }
}

void onColorModeTrackbar(int pos, void* userdata) {
    // Trackbar: 0 = Grayscale, 1 = Color
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->colorModeSlider = pos;
    std::cout << (pos == 1 ? "Color mode" : "Grayscale mode") << std::endl;
}

// Viewport rotation trackbar callbacks
void onViewAngleXTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->viewAngleXSlider = pos;
    // Map 0-360 slider to -90 to +90 degrees
    state->viewAngleX = (pos / 360.0f) * 180.0f - 90.0f;
}

void onViewAngleYTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->viewAngleYSlider = pos;
    // Map 0-360 slider to -180 to +180 degrees
    state->viewAngleY = (pos / 360.0f) * 360.0f - 180.0f;
}

// Configuration window trackbar callbacks
void onPanChannelTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panChannel = pos;
    state->panChannelSlider = pos;
}

void onTiltChannelTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltChannel = pos;
    state->tiltChannelSlider = pos;
}

void onPanMinTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panMin = pos;
    state->panMinSlider = pos;
    // Ensure min < max
    if (state->config.panMin >= state->config.panMax) {
        state->config.panMax = state->config.panMin + 1;
        if (state->config.panMax > 255) state->config.panMax = 255;
    }
}

void onPanMaxTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panMax = pos;
    state->panMaxSlider = pos;
    // Ensure max > min
    if (state->config.panMax <= state->config.panMin) {
        state->config.panMin = state->config.panMax - 1;
        if (state->config.panMin < 0) state->config.panMin = 0;
    }
}

void onTiltMinTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltMin = pos;
    state->tiltMinSlider = pos;
    // Ensure min < max
    if (state->config.tiltMin >= state->config.tiltMax) {
        state->config.tiltMax = state->config.tiltMin + 1;
        if (state->config.tiltMax > 255) state->config.tiltMax = 255;
    }
}

void onTiltMaxTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltMax = pos;
    state->tiltMaxSlider = pos;
    // Ensure max > min
    if (state->config.tiltMax <= state->config.tiltMin) {
        state->config.tiltMin = state->config.tiltMax - 1;
        if (state->config.tiltMin < 0) state->config.tiltMin = 0;
    }
}

void onPanScaleTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panScale = pos / 100.0f; // 0-200 maps to 0.0-2.0
    state->panScaleSlider = pos;
}

void onTiltScaleTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltScale = pos / 100.0f;
    state->tiltScaleSlider = pos;
}

void onPanDeadZoneTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panDeadZone = pos / 100.0f; // 0-100 maps to 0.0-1.0
    state->panDeadZoneSlider = pos;
}

void onTiltDeadZoneTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltDeadZone = pos / 100.0f;
    state->tiltDeadZoneSlider = pos;
}

void onPanLimitTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panLimit = pos / 100.0f; // 0-100 maps to 0.0-1.0
    state->panLimitSlider = pos;
}

void onTiltLimitTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltLimit = pos / 100.0f;
    state->tiltLimitSlider = pos;
}

void onPanGearTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.panGear = std::max(0.1f, pos / 100.0f); // 10-200 maps to 0.1-2.0
    state->panGearSlider = pos;
}

void onTiltGearTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->config.tiltGear = std::max(0.1f, pos / 100.0f);
    state->tiltGearSlider = pos;
}

// OSC configuration trackbar callbacks
void onOSCEnableTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->oscEnableSlider = pos;
    state->config.useOSC = (pos == 1);
    std::cout << "OSC: " << (state->config.useOSC ? "ENABLED" : "DISABLED (using HTTP API)") << std::endl;
}

void onOSCPortTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->oscPortSlider = pos;
    state->config.oscPort = pos;
    std::cout << "OSC Port: " << pos << std::endl;
}

// Additional config trackbar callbacks
void onUpdateRateTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->updateRateSlider = pos;
    state->config.updateRate = pos;
    std::cout << "Update Rate: " << pos << " Hz" << std::endl;
}

void onSmoothingFactorTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->smoothingFactorSlider = pos;
    state->config.smoothingFactor = pos / 100.0f; // 0-100 maps to 0.0-1.0
    std::cout << "Smoothing Factor: " << state->config.smoothingFactor << std::endl;
}

void onMaxVelocityTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->maxVelocitySlider = pos;
    state->config.maxVelocity = pos / 10.0f; // 0-100 maps to 0.0-10.0
    std::cout << "Max Velocity: " << state->config.maxVelocity << std::endl;
}

void onPanSensitivityTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->panSensitivitySlider = pos;
    state->config.panSensitivity = pos / 100.0f; // 0-200 maps to 0.0-2.0
    std::cout << "Pan Sensitivity: " << state->config.panSensitivity << std::endl;
}

void onTiltSensitivityTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->tiltSensitivitySlider = pos;
    state->config.tiltSensitivity = pos / 100.0f; // 0-200 maps to 0.0-2.0
    std::cout << "Tilt Sensitivity: " << state->config.tiltSensitivity << std::endl;
}

void onPanOffsetTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->panOffsetSlider = pos;
    state->config.panOffset = pos;
    std::cout << "Pan Offset (Center): " << pos << std::endl;
}

void onTiltOffsetTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->tiltOffsetSlider = pos;
    state->config.tiltOffset = pos;
    std::cout << "Tilt Offset (Center): " << pos << std::endl;
}

void onIrisChannelTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->irisChannelSlider = pos;
    state->config.irisChannel = pos;
    std::cout << "Iris Channel: " << (pos > 0 ? std::to_string(pos) : "DISABLED") << std::endl;
}

void onZoomChannelTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->zoomChannelSlider = pos;
    state->config.zoomChannel = pos;
    std::cout << "Zoom Channel: " << (pos > 0 ? std::to_string(pos) : "DISABLED") << std::endl;
}

void onFocusChannelTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->focusChannelSlider = pos;
    state->config.focusChannel = pos;
    std::cout << "Focus Channel: " << (pos > 0 ? std::to_string(pos) : "DISABLED") << std::endl;
}

void onIrisValueTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->irisValueSlider = pos;
    state->config.irisValue = pos;
    std::cout << "Iris Value: " << pos << std::endl;
}

void onZoomValueTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->zoomValueSlider = pos;
    state->config.zoomValue = pos;
    std::cout << "Zoom Value: " << pos << std::endl;
}

void onFocusValueTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->focusValueSlider = pos;
    state->config.focusValue = pos;
    std::cout << "Focus Value: " << pos << std::endl;
}

void onCameraIndexTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->cameraIndexSlider = pos;
    state->config.cameraIndex = pos;
    std::cout << "Camera Index: " << pos << " (requires restart)" << std::endl;
}

void onIrisMinTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->irisMinSlider = pos;
    state->config.irisMin = pos;
    if (state->config.irisMin >= state->config.irisMax) {
        state->config.irisMax = state->config.irisMin + 1;
        if (state->config.irisMax > 255) state->config.irisMax = 255;
    }
}

void onIrisMaxTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->irisMaxSlider = pos;
    state->config.irisMax = pos;
    if (state->config.irisMax <= state->config.irisMin) {
        state->config.irisMin = state->config.irisMax - 1;
        if (state->config.irisMin < 0) state->config.irisMin = 0;
    }
}

void onZoomMinTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->zoomMinSlider = pos;
    state->config.zoomMin = pos;
    if (state->config.zoomMin >= state->config.zoomMax) {
        state->config.zoomMax = state->config.zoomMin + 1;
        if (state->config.zoomMax > 255) state->config.zoomMax = 255;
    }
}

void onZoomMaxTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->zoomMaxSlider = pos;
    state->config.zoomMax = pos;
    if (state->config.zoomMax <= state->config.zoomMin) {
        state->config.zoomMin = state->config.zoomMax - 1;
        if (state->config.zoomMin < 0) state->config.zoomMin = 0;
    }
}

void onFocusMinTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->focusMinSlider = pos;
    state->config.focusMin = pos;
    if (state->config.focusMin >= state->config.focusMax) {
        state->config.focusMax = state->config.focusMin + 1;
        if (state->config.focusMax > 255) state->config.focusMax = 255;
    }
}

void onFocusMaxTrackbar(int pos, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    state->focusMaxSlider = pos;
    state->config.focusMax = pos;
    if (state->config.focusMax <= state->config.focusMin) {
        state->config.focusMin = state->config.focusMax - 1;
        if (state->config.focusMin < 0) state->config.focusMin = 0;
    }
}


// Mouse callback for button clicks - works with separate windows
void onMouse(int event, int x, int y, int flags, void* userdata) {
    FaceTrackerState* state = static_cast<FaceTrackerState*>(userdata);
    
    // Window names for identification
    // We can't directly get the window name from the mouse event,
    // so we'll check which window the click coordinates make sense for
    
    // Handle buttons in 3D Visualization window (800x600)
    if (event == EVENT_LBUTTONDOWN && state->config.show3DVisualization) {
        // Assume click is in 3D window if coordinates fit
        int vizWidth = 800;
        int vizHeight = 600;
        int relX = x;
        int relY = y;
        
        // Button positions in 3D section (top-right corner)
        int buttonWidth = 120;
        int buttonHeight = 25;
        int buttonSpacing = 5;
        int margin = 10;
        int startX = vizWidth - margin - buttonWidth; // Right side
        int startY = 60; // Below title
        
        // Button 1: Auto-Orbit Toggle
        if (relX >= startX && relX <= startX + buttonWidth && 
            relY >= startY && relY <= startY + buttonHeight) {
            state->autoOrbit = !state->autoOrbit;
            std::cout << "Auto-Orbit toggled to: " << (state->autoOrbit ? "ON" : "OFF") << std::endl;
            return;
        }
        
        // Button 2: XYZ Lattice Toggle
        int button2Y = startY + buttonHeight + buttonSpacing;
        if (relX >= startX && relX <= startX + buttonWidth && 
            relY >= button2Y && relY <= button2Y + buttonHeight) {
            state->showXYZLattice = !state->showXYZLattice;
            std::cout << "XYZ Lattice toggled to: " << (state->showXYZLattice ? "ON" : "OFF") << std::endl;
            return;
        }
        
        // Button 3: Reset View
        int button3Y = button2Y + buttonHeight + buttonSpacing;
        if (relX >= startX && relX <= startX + buttonWidth && 
            relY >= button3Y && relY <= button3Y + buttonHeight) {
            state->viewAngleX = 0.0f;
            state->viewAngleY = -45.0f;
            state->viewDistance = 1.2f;
            std::cout << "3D view reset" << std::endl;
            return;
        }
        
        // Zoom buttons (left side)
        int zoomButtonWidth = 80;
        int zoomButtonHeight = 25;
        int zoomX = 10;
        int zoomY = vizHeight - 80;
        
        // Zoom In
        if (relX >= zoomX && relX <= zoomX + zoomButtonWidth && 
            relY >= zoomY && relY <= zoomY + zoomButtonHeight) {
            state->viewDistance *= 0.9f;
            if (state->viewDistance < 0.5f) state->viewDistance = 0.5f;
            std::cout << "Zoom In: " << state->viewDistance << std::endl;
            return;
        }
        
        // Zoom Out
        int zoomOutY = zoomY + zoomButtonHeight + buttonSpacing;
        if (relX >= zoomX && relX <= zoomX + zoomButtonWidth && 
            relY >= zoomOutY && relY <= zoomOutY + zoomButtonHeight) {
            state->viewDistance *= 1.1f;
            if (state->viewDistance > 3.0f) state->viewDistance = 3.0f;
            std::cout << "Zoom Out: " << state->viewDistance << std::endl;
            return;
        }
        
        // Rotate buttons
        int rotateButtonWidth = 60;
        int rotateButtonHeight = 22;
        int rotateStartY = zoomOutY + zoomButtonHeight + 10;
        int rotateX = 10;
        int rotateRightX = rotateX + rotateButtonWidth + 5;
        
        // Rotate Left
        if (relX >= rotateX && relX <= rotateX + rotateButtonWidth && 
            relY >= rotateStartY && relY <= rotateStartY + rotateButtonHeight) {
            state->viewAngleY -= 5.0f;
            if (state->viewAngleY < -360) state->viewAngleY += 360;
            std::cout << "Rotate Left" << std::endl;
            return;
        }
        
        // Rotate Right
        if (relX >= rotateRightX && relX <= rotateRightX + rotateButtonWidth && 
            relY >= rotateStartY && relY <= rotateStartY + rotateButtonHeight) {
            state->viewAngleY += 5.0f;
            if (state->viewAngleY > 360) state->viewAngleY -= 360;
            std::cout << "Rotate Right" << std::endl;
            return;
        }
        
        // Rotate Up
        int rotateUpY = rotateStartY + rotateButtonHeight + 5;
        if (relX >= rotateX && relX <= rotateX + rotateButtonWidth && 
            relY >= rotateUpY && relY <= rotateUpY + rotateButtonHeight) {
            state->viewAngleX += 5.0f;
            state->viewAngleX = std::min(90.0f, state->viewAngleX);
            std::cout << "Rotate Up" << std::endl;
            return;
        }
        
        // Rotate Down
        if (relX >= rotateRightX && relX <= rotateRightX + rotateButtonWidth && 
            relY >= rotateUpY && relY <= rotateUpY + rotateButtonHeight) {
            state->viewAngleX -= 5.0f;
            state->viewAngleX = std::max(-90.0f, state->viewAngleX);
            std::cout << "Rotate Down" << std::endl;
            return;
        }
    }
    
    // Handle clicks in configuration windows (custom +/- buttons)
    // Coordinates are relative to each window (0,0 at top-left of window)
    // We need to store the current window name in state or check window dimensions
    // For now, use a simpler approach: check coordinates against expected button layout
    
    int labelWidth = 200;
    int valueWidth = 60;
    int buttonWidth = 30;
    int buttonHeight = 24;
    int spacing = 10;
    int lineHeight = 30;
    int startY = 30 + 30 + 10; // Title height + lineHeight + spacing
    int buttonX = labelWidth + valueWidth;
    
    // Determine which config window based on coordinates and window size
    // Since mouse callbacks are per-window, coordinates are relative to that window
    // We'll check button positions for all windows and let the first match handle it
    
    // Config: DMX Channels window (500x400) - 5 parameters
    if (x >= buttonX && x <= buttonX + buttonWidth * 2 + spacing && y >= startY - 18 && y < startY + 6 * lineHeight) {
        int row = (y - startY + 18) / lineHeight;
        if (row >= 0 && row < 5 && y >= startY + row * lineHeight - 18 && y <= startY + row * lineHeight + 6) {
            if (x < buttonX + buttonWidth) {
                // Minus
                if (row == 0) state->config.panChannel = std::max(1, state->config.panChannel - 1);
                else if (row == 1) state->config.tiltChannel = std::max(1, state->config.tiltChannel - 1);
                else if (row == 2) state->config.irisChannel = std::max(0, state->config.irisChannel - 1);
                else if (row == 3) state->config.zoomChannel = std::max(0, state->config.zoomChannel - 1);
                else if (row == 4) state->config.focusChannel = std::max(0, state->config.focusChannel - 1);
            } else if (x >= buttonX + buttonWidth + spacing) {
                // Plus
                if (row == 0) state->config.panChannel = std::min(512, state->config.panChannel + 1);
                else if (row == 1) state->config.tiltChannel = std::min(512, state->config.tiltChannel + 1);
                else if (row == 2) state->config.irisChannel = std::min(512, state->config.irisChannel + 1);
                else if (row == 3) state->config.zoomChannel = std::min(512, state->config.zoomChannel + 1);
                else if (row == 4) state->config.focusChannel = std::min(512, state->config.focusChannel + 1);
            }
            return;
        }
    }
    
    // Config: Range Limits window (500x500) - 10 parameters
    if (x >= buttonX && x <= buttonX + buttonWidth * 2 + spacing && y >= startY - 18 && y < startY + 10 * lineHeight) {
        int row = (y - startY + 18) / lineHeight;
        if (row >= 0 && row < 10 && y >= startY + row * lineHeight - 18 && y <= startY + row * lineHeight + 6) {
            if (x < buttonX + buttonWidth) {
                // Minus
                if (row == 0) state->config.panMin = std::max(0, state->config.panMin - 1);
                else if (row == 1) state->config.panMax = std::max(state->config.panMin + 1, state->config.panMax - 1);
                else if (row == 2) state->config.tiltMin = std::max(0, state->config.tiltMin - 1);
                else if (row == 3) state->config.tiltMax = std::max(state->config.tiltMin + 1, state->config.tiltMax - 1);
                else if (row == 4) state->config.irisMin = std::max(0, state->config.irisMin - 1);
                else if (row == 5) state->config.irisMax = std::max(state->config.irisMin + 1, state->config.irisMax - 1);
                else if (row == 6) state->config.zoomMin = std::max(0, state->config.zoomMin - 1);
                else if (row == 7) state->config.zoomMax = std::max(state->config.zoomMin + 1, state->config.zoomMax - 1);
                else if (row == 8) state->config.focusMin = std::max(0, state->config.focusMin - 1);
                else if (row == 9) state->config.focusMax = std::max(state->config.focusMin + 1, state->config.focusMax - 1);
            } else if (x >= buttonX + buttonWidth + spacing) {
                // Plus
                if (row == 0) state->config.panMin = std::min(state->config.panMax - 1, state->config.panMin + 1);
                else if (row == 1) state->config.panMax = std::min(255, state->config.panMax + 1);
                else if (row == 2) state->config.tiltMin = std::min(state->config.tiltMax - 1, state->config.tiltMin + 1);
                else if (row == 3) state->config.tiltMax = std::min(255, state->config.tiltMax + 1);
                else if (row == 4) state->config.irisMin = std::min(state->config.irisMax - 1, state->config.irisMin + 1);
                else if (row == 5) state->config.irisMax = std::min(255, state->config.irisMax + 1);
                else if (row == 6) state->config.zoomMin = std::min(state->config.zoomMax - 1, state->config.zoomMin + 1);
                else if (row == 7) state->config.zoomMax = std::min(255, state->config.zoomMax + 1);
                else if (row == 8) state->config.focusMin = std::min(state->config.focusMax - 1, state->config.focusMin + 1);
                else if (row == 9) state->config.focusMax = std::min(255, state->config.focusMax + 1);
            }
            return;
        }
    }
    
    // Config: Rigging window (500x400) - 8 parameters
    if (x >= buttonX && x <= buttonX + buttonWidth * 2 + spacing && y >= startY - 18 && y < startY + 8 * lineHeight) {
        int row = (y - startY + 18) / lineHeight;
        if (row >= 0 && row < 8 && y >= startY + row * lineHeight - 18 && y <= startY + row * lineHeight + 6) {
            float step = 0.01f;
            if (x < buttonX + buttonWidth) {
                // Minus
                if (row == 0) state->config.panScale = std::max(0.0f, state->config.panScale - step);
                else if (row == 1) state->config.tiltScale = std::max(0.0f, state->config.tiltScale - step);
                else if (row == 2) state->config.panDeadZone = std::max(0.0f, state->config.panDeadZone - step);
                else if (row == 3) state->config.tiltDeadZone = std::max(0.0f, state->config.tiltDeadZone - step);
                else if (row == 4) state->config.panLimit = std::max(0.0f, state->config.panLimit - step);
                else if (row == 5) state->config.tiltLimit = std::max(0.0f, state->config.tiltLimit - step);
                else if (row == 6) state->config.panGear = std::max(0.1f, state->config.panGear - step);
                else if (row == 7) state->config.tiltGear = std::max(0.1f, state->config.tiltGear - step);
            } else if (x >= buttonX + buttonWidth + spacing) {
                // Plus
                if (row == 0) state->config.panScale = std::min(2.0f, state->config.panScale + step);
                else if (row == 1) state->config.tiltScale = std::min(2.0f, state->config.tiltScale + step);
                else if (row == 2) state->config.panDeadZone = std::min(1.0f, state->config.panDeadZone + step);
                else if (row == 3) state->config.tiltDeadZone = std::min(1.0f, state->config.tiltDeadZone + step);
                else if (row == 4) state->config.panLimit = std::min(1.0f, state->config.panLimit + step);
                else if (row == 5) state->config.tiltLimit = std::min(1.0f, state->config.tiltLimit + step);
                else if (row == 6) state->config.panGear = std::min(2.0f, state->config.panGear + step);
                else if (row == 7) state->config.tiltGear = std::min(2.0f, state->config.tiltGear + step);
            }
            return;
        }
    }
    
    // Config: OSC window (500x200) - 2 parameters
    if (x >= buttonX && x <= buttonX + buttonWidth * 2 + spacing && y >= startY - 18 && y < startY + 2 * lineHeight) {
        int row = (y - startY + 18) / lineHeight;
        if (row == 0 && y >= startY - 18 && y <= startY + 6) {
            // OSC Enable toggle (entire button area)
            state->config.useOSC = !state->config.useOSC;
            return;
        } else if (row == 1 && y >= startY + lineHeight - 18 && y <= startY + lineHeight + 6) {
            if (x < buttonX + buttonWidth) {
                state->config.oscPort = std::max(0, state->config.oscPort - 1);
            } else if (x >= buttonX + buttonWidth + spacing) {
                state->config.oscPort = std::min(10000, state->config.oscPort + 1);
            }
            return;
        }
    }
    
    // Config: Advanced window (500x600) - 11 parameters  
    if (x >= buttonX && x <= buttonX + buttonWidth * 2 + spacing && y >= startY - 18 && y < startY + 11 * lineHeight) {
        int row = (y - startY + 18) / lineHeight;
        if (row >= 0 && row < 11 && y >= startY + row * lineHeight - 18 && y <= startY + row * lineHeight + 6) {
            if (x < buttonX + buttonWidth) {
                // Minus
                if (row == 0) state->config.updateRate = std::max(1, state->config.updateRate - 1);
                else if (row == 1) state->config.smoothingFactor = std::max(0.0f, state->config.smoothingFactor - 0.01f);
                else if (row == 2) state->config.maxVelocity = std::max(0.0f, state->config.maxVelocity - 0.1f);
                else if (row == 3) state->config.panSensitivity = std::max(0.0f, state->config.panSensitivity - 0.01f);
                else if (row == 4) state->config.tiltSensitivity = std::max(0.0f, state->config.tiltSensitivity - 0.01f);
                else if (row == 5) state->config.panOffset = std::max(0, state->config.panOffset - 1);
                else if (row == 6) state->config.tiltOffset = std::max(0, state->config.tiltOffset - 1);
                else if (row == 7) state->config.cameraIndex = std::max(0, state->config.cameraIndex - 1);
                else if (row == 8) state->config.irisValue = std::max(0, state->config.irisValue - 1);
                else if (row == 9) state->config.zoomValue = std::max(0, state->config.zoomValue - 1);
                else if (row == 10) state->config.focusValue = std::max(0, state->config.focusValue - 1);
            } else if (x >= buttonX + buttonWidth + spacing) {
                // Plus
                if (row == 0) state->config.updateRate = std::min(100, state->config.updateRate + 1);
                else if (row == 1) state->config.smoothingFactor = std::min(1.0f, state->config.smoothingFactor + 0.01f);
                else if (row == 2) state->config.maxVelocity = std::min(10.0f, state->config.maxVelocity + 0.1f);
                else if (row == 3) state->config.panSensitivity = std::min(2.0f, state->config.panSensitivity + 0.01f);
                else if (row == 4) state->config.tiltSensitivity = std::min(2.0f, state->config.tiltSensitivity + 0.01f);
                else if (row == 5) state->config.panOffset = std::min(255, state->config.panOffset + 1);
                else if (row == 6) state->config.tiltOffset = std::min(255, state->config.tiltOffset + 1);
                else if (row == 7) state->config.cameraIndex = std::min(10, state->config.cameraIndex + 1);
                else if (row == 8) state->config.irisValue = std::min(255, state->config.irisValue + 1);
                else if (row == 9) state->config.zoomValue = std::min(255, state->config.zoomValue + 1);
                else if (row == 10) state->config.focusValue = std::min(255, state->config.focusValue + 1);
            }
            return;
        }
    }
    
    // Handle buttons in Theatre window (on stage floor)
    if (event == EVENT_LBUTTONDOWN && !state->lastDisplayFrame.empty()) {
        // Get theatre frame dimensions
        int theatreWidth = state->lastDisplayFrame.cols;
        int theatreHeight = state->lastDisplayFrame.rows;
        int headerHeight = 60;
        int stageHeight = 40;
        int curtainWidth = 80;
        
        // Button dimensions and positions (on stage floor)
        int buttonWidth = 150;
        int buttonHeight = 32;
        int buttonSpacing = 10;
        int numButtons = 2; // Auto Exp, Color Mode
        
        // Calculate button positions (centered on stage floor)
        int stageTopY = headerHeight + (theatreHeight - headerHeight - stageHeight);
        int totalButtonWidth = numButtons * buttonWidth + (numButtons - 1) * buttonSpacing;
        int startX = (theatreWidth - totalButtonWidth) / 2;
        int buttonY = stageTopY + (stageHeight - buttonHeight) / 2;
        
        // Button 1: Auto Exposure Toggle
        if (x >= startX && x <= startX + buttonWidth && 
            y >= buttonY && y <= buttonY + buttonHeight) {
            state->autoExposureSlider = state->autoExposureSlider == 1 ? 0 : 1;
            onAutoExposureTrackbar(state->autoExposureSlider, state);
            std::cout << "Auto Exposure toggled to: " << (state->autoExposureSlider == 1 ? "ON" : "OFF") << std::endl;
            return;
        }
        
        // Button 2: Color Mode Toggle
        int button2X = startX + buttonWidth + buttonSpacing;
        if (x >= button2X && x <= button2X + buttonWidth && 
            y >= buttonY && y <= buttonY + buttonHeight) {
            state->colorModeSlider = state->colorModeSlider == 1 ? 0 : 1;
            onColorModeTrackbar(state->colorModeSlider, state);
            std::cout << "Color Mode toggled to: " << (state->colorModeSlider == 1 ? "Color" : "Grayscale") << std::endl;
            return;
        }
    }
}


// Main tracking loop
void trackFace(VideoCapture& cap, FaceTrackerState& state) {
    Mat frame, gray, adjusted;
    std::vector<Rect> faces;
    std::vector<std::vector<Point2f>> shapes;
    
    int frameCount = 0;
    bool trackbarsCreated = false;  // Flag to ensure trackbars are created only once
    
    auto lastUpdate = std::chrono::steady_clock::now();
    
    while (true) {
        cap >> frame;
        if (frame.empty()) {
            std::cerr << "Failed to capture frame" << std::endl;
            break;
        }
        
        // Create separate windows for each configuration category
        if (state.config.showPreview && !trackbarsCreated) {
            // Window 1: Theatre preview (RESIZABLE - user can drag corners to resize)
            namedWindow("ArtBastard Puppet Theatre", WINDOW_NORMAL);
            resizeWindow("ArtBastard Puppet Theatre", 900, 700);
            moveWindow("ArtBastard Puppet Theatre", 0, 0);
            setMouseCallback("ArtBastard Puppet Theatre", onMouse, &state);
            
            // Window 2: 3D Visualization (RESIZABLE)
            namedWindow("3D Fixture Visualization", WINDOW_NORMAL);
            resizeWindow("3D Fixture Visualization", 800, 600);
            moveWindow("3D Fixture Visualization", 920, 0);
            setMouseCallback("3D Fixture Visualization", onMouse, &state);
            
            // Window 3: Rigging Preview (configuration UI is now in React)
            namedWindow("Rigging Preview", WINDOW_NORMAL);
            resizeWindow("Rigging Preview", 600, 500);
            moveWindow("Rigging Preview", 1740, 0);
            
            // Initialize button states
            state.autoExposureSlider = state.config.autoExposure ? 1 : 0;
            state.colorModeSlider = 1; // Default to color mode
            // Configuration window is separate and always visible
            
            // Camera control trackbars on theatre window (descriptive labels)
            createTrackbar("Camera Brightness (0-100, multiplies image brightness)", "ArtBastard Puppet Theatre", 
                          &state.brightnessSlider, 100, onBrightnessTrackbar, &state);
            setTrackbarPos("Camera Brightness (0-100, multiplies image brightness)", "ArtBastard Puppet Theatre", state.brightnessSlider);
            
            createTrackbar("Camera Contrast (0-100, multiplies image contrast)", "ArtBastard Puppet Theatre", 
                          &state.contrastSlider, 100, onContrastTrackbar, &state);
            setTrackbarPos("Camera Contrast (0-100, multiplies image contrast)", "ArtBastard Puppet Theatre", state.contrastSlider);
            
            createTrackbar("Camera Exposure (0=dark, 100=bright, manual mode)", "ArtBastard Puppet Theatre", 
                          &state.exposureSlider, 100, onExposureTrackbar, &state);
            setTrackbarPos("Camera Exposure (0=dark, 100=bright, manual mode)", "ArtBastard Puppet Theatre", state.exposureSlider);
            
            // 3D viewport trackbars on 3D window (descriptive labels)
            if (state.config.show3DVisualization) {
                createTrackbar("3D View Rotation X (up/down angle, 0-360)", "3D Fixture Visualization", &state.viewAngleXSlider, 360, onViewAngleXTrackbar, &state);
                setTrackbarPos("3D View Rotation X (up/down angle, 0-360)", "3D Fixture Visualization", 180);
                
                createTrackbar("3D View Rotation Y (left/right angle, 0-360)", "3D Fixture Visualization", &state.viewAngleYSlider, 360, onViewAngleYTrackbar, &state);
                setTrackbarPos("3D View Rotation Y (left/right angle, 0-360)", "3D Fixture Visualization", 180);
            }
            
            trackbarsCreated = true;
            std::cout << "Windows created: Theatre, 3D Visualization, Rigging Preview!" << std::endl;
        }
        
        // Apply brightness/contrast adjustments (always apply to use trackbar values)
        adjustBrightnessContrast(frame, adjusted, state.config.brightness, state.config.contrast);
        frame = adjusted;
        
        cvtColor(frame, gray, COLOR_BGR2GRAY);
        equalizeHist(gray, gray);
        
        // Detect faces
        state.faceCascade->detectMultiScale(gray, faces, 1.1, 3, 0, Size(50, 50));
        
        if (faces.size() > 0) {
            state.faceDetected = true;
            Rect faceRect = faces[0]; // Use first detected face
            
            // Detect facial landmarks
            std::vector<Point2f> landmarks;
            bool landmarksDetected = false;
            
#ifdef HAVE_OPENCV_FACE
            if (state.facemark && state.facemark.get()) {
                std::vector<std::vector<Point2f>> shapes;
                if (state.facemark->fit(frame, faces, shapes)) {
                    if (shapes.size() > 0 && shapes[0].size() >= 68) {
                        landmarks = shapes[0];
                        state.landmarks = landmarks;
                        landmarksDetected = true;
                        
                        // Estimate head pose
                        float pan = 0.0f, tilt = 0.0f;
                        estimateHeadPose(landmarks, frame.size(), pan, tilt);
                    
                    // Apply smoothing
                    // Improved smoothing with velocity limiting
                    smoothWithVelocity(state.smoothedPan, pan, state.panVelocity, 
                                      state.config.smoothingFactor, state.config.maxVelocity / 127.0f);
                    smoothWithVelocity(state.smoothedTilt, tilt, state.tiltVelocity, 
                                      state.config.smoothingFactor, state.config.maxVelocity / 127.0f);
                    
                    // Add to gesture history
                    state.panHistory.push_back(state.smoothedPan);
                    state.tiltHistory.push_back(state.smoothedTilt);
                    
                    // Keep history size limited
                    if (state.panHistory.size() > state.gestureHistorySize) {
                        state.panHistory.erase(state.panHistory.begin());
                    }
                    if (state.tiltHistory.size() > state.gestureHistorySize) {
                        state.tiltHistory.erase(state.tiltHistory.begin());
                    }
                    
                    // Detect gestures
                    if (state.gestureCooldown > 0) {
                        state.gestureCooldown--;
                    }
                    
                    std::string gesture = "";
                    if (state.gestureCooldown == 0 && state.panHistory.size() >= 10) {
                        gesture = detectGesture(state.panHistory, state.tiltHistory, state.smoothedPan, state.smoothedTilt);
                        
                        if (!gesture.empty() && gesture != state.lastGesture) {
                            std::cout << "Gesture detected: " << gesture << std::endl;
                            state.lastGesture = gesture;
                            state.gestureCooldown = 30; // Cooldown to prevent duplicate detections
                        }
                    }
                    
                    // Map to DMX values
                    int panValue, tiltValue;
                    mapToDmx(state.smoothedPan, state.smoothedTilt, state.config, panValue, tiltValue);
                    
                    // Send DMX update at configured rate
                    auto now = std::chrono::steady_clock::now();
                    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastUpdate).count();
                    int updateInterval = 1000 / state.config.updateRate;
                    
                    if (elapsed >= updateInterval) {
                        sendDmxValues(state.config, panValue, tiltValue);
                        lastUpdate = now;
                        
                        if (!gesture.empty()) {
                            std::cout << "Face tracked - Pan: " << panValue << ", Tilt: " << tiltValue 
                                      << " | Gesture: " << gesture << std::endl;
                        } else {
                            std::cout << "Face tracked - Pan: " << panValue << ", Tilt: " << tiltValue 
                                      << " (raw: " << state.smoothedPan << ", " << state.smoothedTilt << ")" << std::endl;
                        }
                    }
                    
                    // Draw landmarks on preview (bright yellow/orange)
                    if (state.config.showPreview) {
                        for (const auto& point : landmarks) {
                            circle(frame, point, 3, Scalar(0, 255, 255), -1); // Bright yellow (BGR)
                        }
                        // Draw face rectangle (bright orange)
                        rectangle(frame, faceRect, Scalar(0, 165, 255), 3); // Bright orange (BGR)
                        // Pan/tilt values moved to theatre overlay, not on preview frame
                    }
                }
            }
#endif
            // Fallback to face center if landmarks not detected or face module not available
            if (!landmarksDetected) {
                // Face detected but landmarks failed - use face center for basic tracking
                state.faceDetected = true;
                Point2f faceCenter(faceRect.x + faceRect.width / 2.0f, faceRect.y + faceRect.height / 2.0f);
                Point2f imageCenter(frame.size().width / 2.0f, frame.size().height / 2.0f);
                
                float pan = (faceCenter.x - imageCenter.x) / imageCenter.x;
                float tilt = (faceCenter.y - imageCenter.y) / imageCenter.y;
                
                // Improved smoothing with velocity limiting
                smoothWithVelocity(state.smoothedPan, pan, state.panVelocity, 
                                  state.config.smoothingFactor, state.config.maxVelocity / 127.0f);
                smoothWithVelocity(state.smoothedTilt, tilt, state.tiltVelocity, 
                                  state.config.smoothingFactor, state.config.maxVelocity / 127.0f);
                
                // Add to gesture history
                state.panHistory.push_back(state.smoothedPan);
                state.tiltHistory.push_back(state.smoothedTilt);
                
                // Keep history size limited
                if (state.panHistory.size() > state.gestureHistorySize) {
                    state.panHistory.erase(state.panHistory.begin());
                }
                if (state.tiltHistory.size() > state.gestureHistorySize) {
                    state.tiltHistory.erase(state.tiltHistory.begin());
                }
                
                // Detect gestures
                if (state.gestureCooldown > 0) {
                    state.gestureCooldown--;
                }
                
                std::string gesture = "";
                if (state.gestureCooldown == 0 && state.panHistory.size() >= 10) {
                    gesture = detectGesture(state.panHistory, state.tiltHistory, state.smoothedPan, state.smoothedTilt);
                    
                    if (!gesture.empty() && gesture != state.lastGesture) {
                        std::cout << "Gesture detected: " << gesture << std::endl;
                        state.lastGesture = gesture;
                        state.gestureCooldown = 30; // Cooldown to prevent duplicate detections
                    }
                }
                
                int panValue, tiltValue;
                mapToDmx(state.smoothedPan, state.smoothedTilt, state.config, panValue, tiltValue);
                
                auto now = std::chrono::steady_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastUpdate).count();
                int updateInterval = 1000 / state.config.updateRate;
                
                if (elapsed >= updateInterval) {
                    sendDmxValues(state.config, panValue, tiltValue);
                    lastUpdate = now;
                    
                    if (!gesture.empty()) {
                        std::cout << "Face tracked - Pan: " << panValue << ", Tilt: " << tiltValue 
                                  << " | Gesture: " << gesture << std::endl;
                    }
                }
                
                if (state.config.showPreview) {
                    // Draw face rectangle (bright orange)
                    rectangle(frame, faceRect, Scalar(0, 165, 255), 3); // Bright orange (BGR)
                    circle(frame, faceCenter, 6, Scalar(0, 255, 255), -1); // Bright yellow (BGR)
                    // Pan/tilt values moved to theatre overlay, not on preview frame
                }
            }
        } else {
            state.faceDetected = false;
            // "No face detected" text moved to theatre overlay, not on preview frame
        }
        
        // Check quit flag
        if (!state.config.showPreview) {
            saveConfig(state.config);
            std::cout << "Application exiting. Settings saved." << std::endl;
            break;
        }
        
        if (state.config.showPreview) {
            // Determine which frame to show based on color mode
            // Force color format - ensure frame is BGR (3 channels)
            Mat displayFrame;
            if (frame.channels() == 1) {
                // Camera is outputting grayscale - convert to BGR
                cvtColor(frame, displayFrame, COLOR_GRAY2BGR);
                std::cout << "Warning: Camera is outputting grayscale. Forcing color conversion." << std::endl;
            } else if (frame.channels() == 3) {
                // Frame is already color (BGR)
                displayFrame = frame.clone();
            } else {
                // Unexpected format - try to clone anyway
                displayFrame = frame.clone();
                std::cout << "Warning: Unexpected frame format (" << frame.channels() << " channels)" << std::endl;
            }
            
            // Apply color/grayscale mode toggle (only for display, not camera)
            if (state.colorModeSlider == 0) {
                // Grayscale mode - convert to grayscale for display only
                Mat gray;
                cvtColor(displayFrame, gray, COLOR_BGR2GRAY);
                cvtColor(gray, displayFrame, COLOR_GRAY2BGR); // Convert back to BGR for drawing
            }
            // When colorModeSlider == 1, we keep displayFrame as color
            
            // Create theatrical backdrop with curtains
            int curtainWidth = 80; // Width of each curtain
            int headerHeight = 60; // Height of theatrical header
            int stageHeight = 40;  // Height of stage floor
            
            // Create larger frame with theatre backdrop
            Mat theatreFrame = Mat::zeros(displayFrame.rows + headerHeight + stageHeight, 
                                         displayFrame.cols + (curtainWidth * 2), CV_8UC3);
            
            // ArtBastard colors (BGR format)
            Scalar curtainRed = Scalar(0, 0, 180);      // Deep red velvet
            Scalar curtainAccent = Scalar(0, 0, 220);   // Lighter red
            Scalar headerPurple = Scalar(236, 56, 131); // ArtBastard purple #8338ec
            Scalar accentYellow = Scalar(42, 211, 255); // ArtBastard yellow #ffd32a
            Scalar accentTeal = Scalar(165, 255, 6);    // ArtBastard teal #06ffa5
            Scalar stageBrown = Scalar(25, 60, 120);    // Wooden stage
            
            // Draw left curtain with folds
            for (int i = 0; i < curtainWidth; i++) {
                int foldPos = (i / 20) % 2; // Create fold pattern
                int x = i;
                Scalar color = foldPos ? curtainRed : curtainAccent;
                rectangle(theatreFrame, Point(x, headerHeight), 
                        Point(x + 1, headerHeight + displayFrame.rows + stageHeight), color, -1);
            }
            // Draw curtain tassels/fringe at bottom
            for (int i = 0; i < curtainWidth; i += 5) {
                line(theatreFrame, Point(i, headerHeight + displayFrame.rows + stageHeight),
                     Point(i, headerHeight + displayFrame.rows + stageHeight + 10), curtainAccent, 2);
            }
            
            // Draw right curtain with folds
            for (int i = 0; i < curtainWidth; i++) {
                int foldPos = ((curtainWidth - i) / 20) % 2;
                int x = displayFrame.cols + curtainWidth + i;
                Scalar color = foldPos ? curtainRed : curtainAccent;
                rectangle(theatreFrame, Point(x, headerHeight), 
                        Point(x + 1, headerHeight + displayFrame.rows + stageHeight), color, -1);
            }
            // Draw curtain tassels/fringe at bottom
            for (int i = 0; i < curtainWidth; i += 5) {
                int x = displayFrame.cols + curtainWidth + i;
                line(theatreFrame, Point(x, headerHeight + displayFrame.rows + stageHeight),
                     Point(x, headerHeight + displayFrame.rows + stageHeight + 10), curtainAccent, 2);
            }
            
            // Draw theatrical header (top backdrop)
            rectangle(theatreFrame, Point(0, 0), 
                     Point(theatreFrame.cols, headerHeight), headerPurple, -1);
            
            // Draw decorative border on header
            rectangle(theatreFrame, Point(0, 0), 
                     Point(theatreFrame.cols, headerHeight), accentYellow, 3);
            
            // Draw "ArtBastard Puppet Theatre" title (top, larger, white)
            std::string title = "ArtBastard Puppet Theatre";
            int baseline = 0;
            Size titleSize = getTextSize(title, FONT_HERSHEY_DUPLEX, 0.9, 2, &baseline);
            Point titlePos((theatreFrame.cols - titleSize.width) / 2, 35);
            putText(theatreFrame, title, titlePos, FONT_HERSHEY_DUPLEX, 0.9, Scalar(255, 255, 255), 2);
            
            // Draw "Le Theatre des Marionnettes" subtitle (below title, smaller, teal, with spacing)
            std::string subtitle = "* Le Theatre des Marionnettes *";
            Size subtitleSize = getTextSize(subtitle, FONT_HERSHEY_SIMPLEX, 0.4, 1, &baseline);
            Point subtitlePos((theatreFrame.cols - subtitleSize.width) / 2, 52);
            putText(theatreFrame, subtitle, subtitlePos, FONT_HERSHEY_SIMPLEX, 0.4, accentTeal, 1);
            
            // Place camera preview in center (stage)
            Rect stageRect(curtainWidth, headerHeight, displayFrame.cols, displayFrame.rows);
            displayFrame.copyTo(theatreFrame(stageRect));
            
            // Draw decorative spotlight effects on preview
            for (int i = 0; i < 3; i++) {
                int x = curtainWidth + (displayFrame.cols / 4) * (i + 1);
                ellipse(theatreFrame, Point(x, headerHeight + 20), Size(150, 80), 0, 180, 360,
                       Scalar(255, 211, 42), 1, LINE_AA); // Yellow glow
                ellipse(theatreFrame, Point(x, headerHeight + 20), Size(120, 60), 0, 180, 360,
                       Scalar(165, 255, 6), 1, LINE_AA); // Teal glow
            }
            
            // Draw stage floor
            Rect stageFloorRect(0, headerHeight + displayFrame.rows, 
                               theatreFrame.cols, stageHeight);
            rectangle(theatreFrame, stageFloorRect, stageBrown, -1);
            
            // Draw wooden planks on stage
            for (int i = 0; i < theatreFrame.cols; i += 20) {
                line(theatreFrame, Point(i, headerHeight + displayFrame.rows),
                     Point(i, headerHeight + displayFrame.rows + stageHeight),
                     Scalar(15, 40, 80), 1);
            }
            
            // Draw control buttons on stage floor (make sure they're visible!)
            int buttonWidth = 150;
            int buttonHeight = 32; // Slightly taller
            int buttonSpacing = 10;
            int numButtons = 2; // Auto Exp, Color Mode (Config always visible)
            int totalButtonWidth = numButtons * buttonWidth + (numButtons - 1) * buttonSpacing;
            int startX = (theatreFrame.cols - totalButtonWidth) / 2;
            // Ensure buttons are centered vertically in stage floor area
            int buttonY = headerHeight + displayFrame.rows + (stageHeight - buttonHeight) / 2;
            
            // Helper to draw theatrical button
            auto drawTheatreButton = [&](int x, int y, const std::string& text, bool active) {
                Scalar buttonColor = active ? accentTeal : Scalar(60, 60, 60); // Brighter inactive
                Scalar borderColor = active ? accentYellow : Scalar(150, 150, 150); // Brighter border
                
                // Draw button with glow effect when active
                if (active) {
                    // Outer glow
                    rectangle(theatreFrame, Point(x-3, y-3), 
                             Point(x + buttonWidth + 3, y + buttonHeight + 3), 
                             accentYellow, 3);
                }
                
                // Draw button background
                rectangle(theatreFrame, Point(x, y), 
                         Point(x + buttonWidth, y + buttonHeight), buttonColor, -1);
                rectangle(theatreFrame, Point(x, y), 
                         Point(x + buttonWidth, y + buttonHeight), borderColor, 3); // Thicker border
                
                // Draw button text with shadow (larger, more readable)
                int baseline = 0;
                Size textSize = getTextSize(text, FONT_HERSHEY_SIMPLEX, 0.6, 2, &baseline); // Larger font
                Point textPos(x + (buttonWidth - textSize.width) / 2, 
                             y + (buttonHeight + textSize.height) / 2);
                // Shadow
                putText(theatreFrame, text, Point(textPos.x + 2, textPos.y + 2), 
                       FONT_HERSHEY_SIMPLEX, 0.6, Scalar(0, 0, 0), 3); // Thicker shadow
                // Main text
                Scalar textColor = active ? Scalar(255, 255, 255) : Scalar(200, 200, 200); // Brighter text
                putText(theatreFrame, text, textPos, 
                       FONT_HERSHEY_SIMPLEX, 0.6, textColor, 3); // Thicker, larger text
            };
            
            // Button 1: Auto Exposure Toggle
            std::string autoExpText = "Auto Exp: " + std::string(state.autoExposureSlider == 1 ? "ON" : "OFF");
            drawTheatreButton(startX, buttonY, autoExpText, state.autoExposureSlider == 1);
            
            // Button 2: Color Mode Toggle
            std::string colorText = "Mode: " + std::string(state.colorModeSlider == 1 ? "Color" : "Gray");
            drawTheatreButton(startX + buttonWidth + buttonSpacing, buttonY, colorText, state.colorModeSlider == 1);
            
            // Config window is separate - no toggle button needed
            
            // Draw settings overlay at top of preview (on stage) - left side (improved colors)
            std::string settingsText = "Bright: " + std::to_string(state.config.brightness).substr(0, 4) + 
                                       " | Contrast: " + std::to_string(state.config.contrast).substr(0, 4);
            // Use darker background for text readability
            Size settingsSize = getTextSize(settingsText, FONT_HERSHEY_SIMPLEX, 0.5, 1, &baseline);
            rectangle(theatreFrame, 
                      Point(curtainWidth + 8, headerHeight + 18),
                      Point(curtainWidth + settingsSize.width + 12, headerHeight + 35),
                      Scalar(20, 20, 40), -1); // Dark background
            putText(theatreFrame, settingsText, 
                   Point(curtainWidth + 10, headerHeight + 30), 
                   FONT_HERSHEY_SIMPLEX, 0.5, Scalar(255, 255, 200), 2); // Light yellow text
            
            // Draw face tracking status and pan/tilt values - right side (improved colors)
            if (state.faceDetected) {
                // Get pan/tilt values from the last frame
                int panValue, tiltValue;
                mapToDmx(state.smoothedPan, state.smoothedTilt, state.config, panValue, tiltValue);
                
                std::string panTiltText = "Pan: " + std::to_string(panValue) + " Tilt: " + std::to_string(tiltValue);
                Size panTiltSize = getTextSize(panTiltText, FONT_HERSHEY_SIMPLEX, 0.5, 1, &baseline);
                // Dark background for readability
                rectangle(theatreFrame,
                         Point(theatreFrame.cols - curtainWidth - panTiltSize.width - 12, headerHeight + 55),
                         Point(theatreFrame.cols - curtainWidth - 8, headerHeight + 72),
                         Scalar(20, 20, 40), -1);
                putText(theatreFrame, panTiltText, 
                       Point(theatreFrame.cols - curtainWidth - panTiltSize.width - 10, headerHeight + 67),
                       FONT_HERSHEY_SIMPLEX, 0.5, Scalar(200, 255, 200), 2); // Light green text
                
                std::string trackingText = "ACTING";
                Size trackSize = getTextSize(trackingText, FONT_HERSHEY_SIMPLEX, 0.6, 2, &baseline);
                // Dark background for readability
                rectangle(theatreFrame,
                         Point(theatreFrame.cols - curtainWidth - trackSize.width - 12, headerHeight + 18),
                         Point(theatreFrame.cols - curtainWidth - 8, headerHeight + 38),
                         Scalar(20, 20, 40), -1);
                putText(theatreFrame, trackingText, 
                       Point(theatreFrame.cols - curtainWidth - trackSize.width - 10, headerHeight + 32),
                       FONT_HERSHEY_SIMPLEX, 0.6, Scalar(100, 255, 100), 2); // Bright green text
                
                // Display gesture if detected (bright orange/yellow)
                if (!state.lastGesture.empty()) {
                    std::string gestureText = "Gesture: " + state.lastGesture;
                    Size gestureSize = getTextSize(gestureText, FONT_HERSHEY_SIMPLEX, 0.5, 1, &baseline);
                    // Bright background for gesture
                    rectangle(theatreFrame,
                             Point(theatreFrame.cols - curtainWidth - gestureSize.width - 12, headerHeight + 40),
                             Point(theatreFrame.cols - curtainWidth - 8, headerHeight + 55),
                             Scalar(0, 150, 255), -1); // Orange background (BGR)
                    putText(theatreFrame, gestureText, 
                           Point(theatreFrame.cols - curtainWidth - gestureSize.width - 10, headerHeight + 50),
                           FONT_HERSHEY_SIMPLEX, 0.5, Scalar(0, 255, 255), 2); // Bright yellow text
                }
            } else {
                std::string waitingText = "AWAITING PERFORMER";
                Size waitSize = getTextSize(waitingText, FONT_HERSHEY_SIMPLEX, 0.5, 1, &baseline);
                // Dark background
                rectangle(theatreFrame,
                         Point(theatreFrame.cols - curtainWidth - waitSize.width - 12, headerHeight + 18),
                         Point(theatreFrame.cols - curtainWidth - 8, headerHeight + 35),
                         Scalar(20, 20, 40), -1);
                putText(theatreFrame, waitingText, 
                       Point(theatreFrame.cols - curtainWidth - waitSize.width - 10, headerHeight + 30),
                       FONT_HERSHEY_SIMPLEX, 0.5, Scalar(180, 180, 180), 2); // Light gray text
            }
            
            // Store frame for mouse callback (update dimensions for theatre frame)
            state.lastDisplayFrame = theatreFrame.clone();
            
            // Show Theatre window (separate window)
            imshow("ArtBastard Puppet Theatre", theatreFrame);
            
            // Show 3D Visualization window (SEPARATE RESIZABLE WINDOW - always shown)
            int vizWidth = 800;
            int vizHeight = 600;
            Mat vizCanvas(vizHeight, vizWidth, CV_8UC3, Scalar(20, 20, 40));
            
            if (state.config.show3DVisualization) {
                // Auto-orbit logic
                if (state.autoOrbit) {
                    state.viewAngleY += state.autoOrbitSpeed;
                    if (state.viewAngleY > 360) state.viewAngleY -= 360;
                    if (state.viewAngleY < -360) state.viewAngleY += 360;
                }
                
                int panValue, tiltValue;
                mapToDmx(state.smoothedPan, state.smoothedTilt, state.config, panValue, tiltValue);
                
                render3DFixture(vizCanvas, state.smoothedPan, state.smoothedTilt, panValue, tiltValue,
                               state.viewAngleX, state.viewAngleY, state.viewDistance, state.showXYZLattice);
                
                // Add title
                putText(vizCanvas, "3D Fixture Visualization", 
                       Point(10, 25), FONT_HERSHEY_SIMPLEX, 0.6, Scalar(255, 255, 255), 2);
                
                // Display DMX values at bottom
                std::string dmxText = "Pan: " + std::to_string(panValue) + " / Tilt: " + std::to_string(tiltValue);
                putText(vizCanvas, dmxText, 
                       Point(10, vizCanvas.rows - 30),
                       FONT_HERSHEY_SIMPLEX, 0.5, Scalar(200, 200, 255), 1);
                
                // Display angle values
                std::string angleText = "Pan Angle: " + std::to_string((int)(state.smoothedPan * 90)) + 
                                       " / Tilt Angle: " + std::to_string((int)(state.smoothedTilt * 90));
                putText(vizCanvas, angleText, 
                       Point(10, vizCanvas.rows - 10),
                       FONT_HERSHEY_SIMPLEX, 0.5, Scalar(200, 200, 255), 1);
                
                // Draw Auto-Orbit and XYZ Lattice buttons (top-right)
                int buttonWidth = 120;
                int buttonHeight = 25;
                int buttonSpacing = 5;
                int margin = 10;
                int startX = vizCanvas.cols - margin - buttonWidth;
                int startY = 60;
                
                // Button 1: Auto-Orbit
                Scalar orbitColor = state.autoOrbit ? Scalar(100, 255, 100) : Scalar(40, 40, 40);
                rectangle(vizCanvas, Point(startX, startY), Point(startX + buttonWidth, startY + buttonHeight), orbitColor, -1);
                rectangle(vizCanvas, Point(startX, startY), Point(startX + buttonWidth, startY + buttonHeight), Scalar(255, 255, 255), 1);
                std::string orbitText = "Auto-Orbit: " + std::string(state.autoOrbit ? "ON" : "OFF");
                int baseline = 0;
                Size textSize = getTextSize(orbitText, FONT_HERSHEY_SIMPLEX, 0.4, 1, &baseline);
                putText(vizCanvas, orbitText, Point(startX + (buttonWidth - textSize.width) / 2, startY + (buttonHeight + textSize.height) / 2),
                       FONT_HERSHEY_SIMPLEX, 0.4, Scalar(255, 255, 255), 1);
                
                // Button 2: XYZ Lattice
                int button2Y = startY + buttonHeight + buttonSpacing;
                Scalar latticeColor = state.showXYZLattice ? Scalar(100, 150, 255) : Scalar(40, 40, 40);
                rectangle(vizCanvas, Point(startX, button2Y), Point(startX + buttonWidth, button2Y + buttonHeight), latticeColor, -1);
                rectangle(vizCanvas, Point(startX, button2Y), Point(startX + buttonWidth, button2Y + buttonHeight), Scalar(255, 255, 255), 1);
                std::string latticeText = "XYZ Lattice: " + std::string(state.showXYZLattice ? "ON" : "OFF");
                textSize = getTextSize(latticeText, FONT_HERSHEY_SIMPLEX, 0.4, 1, &baseline);
                putText(vizCanvas, latticeText, Point(startX + (buttonWidth - textSize.width) / 2, button2Y + (buttonHeight + textSize.height) / 2),
                       FONT_HERSHEY_SIMPLEX, 0.4, Scalar(255, 255, 255), 1);
                
                // Button 3: Reset View
                int button3Y = button2Y + buttonHeight + buttonSpacing;
                rectangle(vizCanvas, Point(startX, button3Y), Point(startX + buttonWidth, button3Y + buttonHeight), Scalar(60, 60, 150), -1);
                rectangle(vizCanvas, Point(startX, button3Y), Point(startX + buttonWidth, button3Y + buttonHeight), Scalar(255, 255, 255), 1);
                std::string resetText = "Reset View";
                textSize = getTextSize(resetText, FONT_HERSHEY_SIMPLEX, 0.4, 1, &baseline);
                putText(vizCanvas, resetText, Point(startX + (buttonWidth - textSize.width) / 2, button3Y + (buttonHeight + textSize.height) / 2),
                       FONT_HERSHEY_SIMPLEX, 0.4, Scalar(255, 255, 255), 1);
                
                // Zoom buttons (left side)
                int zoomButtonWidth = 80;
                int zoomButtonHeight = 25;
                int zoomX = 10;
                int zoomY = vizCanvas.rows - 80;
                
                // Zoom In
                rectangle(vizCanvas, Point(zoomX, zoomY), Point(zoomX + zoomButtonWidth, zoomY + zoomButtonHeight), Scalar(60, 150, 60), -1);
                rectangle(vizCanvas, Point(zoomX, zoomY), Point(zoomX + zoomButtonWidth, zoomY + zoomButtonHeight), Scalar(255, 255, 255), 1);
                std::string zoomInText = "Zoom +";
                textSize = getTextSize(zoomInText, FONT_HERSHEY_SIMPLEX, 0.35, 1, &baseline);
                putText(vizCanvas, zoomInText, Point(zoomX + (zoomButtonWidth - textSize.width) / 2, zoomY + (zoomButtonHeight + textSize.height) / 2),
                       FONT_HERSHEY_SIMPLEX, 0.35, Scalar(255, 255, 255), 1);
                
                // Zoom Out
                int zoomOutY = zoomY + zoomButtonHeight + buttonSpacing;
                rectangle(vizCanvas, Point(zoomX, zoomOutY), Point(zoomX + zoomButtonWidth, zoomOutY + zoomButtonHeight), Scalar(150, 60, 60), -1);
                rectangle(vizCanvas, Point(zoomX, zoomOutY), Point(zoomX + zoomButtonWidth, zoomOutY + zoomButtonHeight), Scalar(255, 255, 255), 1);
                std::string zoomOutText = "Zoom -";
                textSize = getTextSize(zoomOutText, FONT_HERSHEY_SIMPLEX, 0.35, 1, &baseline);
                putText(vizCanvas, zoomOutText, Point(zoomX + (zoomButtonWidth - textSize.width) / 2, zoomOutY + (zoomButtonHeight + textSize.height) / 2),
                       FONT_HERSHEY_SIMPLEX, 0.35, Scalar(255, 255, 255), 1);
                
                // Rotate buttons (below zoom)
                int rotateButtonWidth = 60;
                int rotateButtonHeight = 22;
                int rotateStartY = zoomOutY + zoomButtonHeight + 10;
                int rotateX = 10;
                
                // Rotate Left
                rectangle(vizCanvas, Point(rotateX, rotateStartY), Point(rotateX + rotateButtonWidth, rotateStartY + rotateButtonHeight), Scalar(60, 60, 150), -1);
                rectangle(vizCanvas, Point(rotateX, rotateStartY), Point(rotateX + rotateButtonWidth, rotateStartY + rotateButtonHeight), Scalar(255, 255, 255), 1);
                putText(vizCanvas, "Left", Point(rotateX + 5, rotateStartY + 16), FONT_HERSHEY_SIMPLEX, 0.3, Scalar(255, 255, 255), 1);
                
                // Rotate Right
                int rotateRightX = rotateX + rotateButtonWidth + 5;
                rectangle(vizCanvas, Point(rotateRightX, rotateStartY), Point(rotateRightX + rotateButtonWidth, rotateStartY + rotateButtonHeight), Scalar(60, 60, 150), -1);
                rectangle(vizCanvas, Point(rotateRightX, rotateStartY), Point(rotateRightX + rotateButtonWidth, rotateStartY + rotateButtonHeight), Scalar(255, 255, 255), 1);
                putText(vizCanvas, "Right", Point(rotateRightX + 5, rotateStartY + 16), FONT_HERSHEY_SIMPLEX, 0.3, Scalar(255, 255, 255), 1);
                
                // Rotate Up
                int rotateUpY = rotateStartY + rotateButtonHeight + 5;
                rectangle(vizCanvas, Point(rotateX, rotateUpY), Point(rotateX + rotateButtonWidth, rotateUpY + rotateButtonHeight), Scalar(60, 60, 150), -1);
                rectangle(vizCanvas, Point(rotateX, rotateUpY), Point(rotateX + rotateButtonWidth, rotateUpY + rotateButtonHeight), Scalar(255, 255, 255), 1);
                putText(vizCanvas, "Up", Point(rotateX + 18, rotateUpY + 16), FONT_HERSHEY_SIMPLEX, 0.3, Scalar(255, 255, 255), 1);
                
                // Rotate Down
                rectangle(vizCanvas, Point(rotateRightX, rotateUpY), Point(rotateRightX + rotateButtonWidth, rotateUpY + rotateButtonHeight), Scalar(60, 60, 150), -1);
                rectangle(vizCanvas, Point(rotateRightX, rotateUpY), Point(rotateRightX + rotateButtonWidth, rotateUpY + rotateButtonHeight), Scalar(255, 255, 255), 1);
                putText(vizCanvas, "Down", Point(rotateRightX + 2, rotateUpY + 16), FONT_HERSHEY_SIMPLEX, 0.3, Scalar(255, 255, 255), 1);
            }
            // Show 3D Visualization window (SEPARATE RESIZABLE WINDOW - always shown)
            imshow("3D Fixture Visualization", vizCanvas);
            
            // Render and show rigging preview window (configuration UI is now in React)
            Mat riggingCanvas(500, 600, CV_8UC3);
            renderRiggingPreview(riggingCanvas, state, state.smoothedPan, state.smoothedTilt);
            imshow("Rigging Preview", riggingCanvas);
            
            // Process window events
            waitKey(1);
            
            // Handle window close buttons
            int theatreVisible = getWindowProperty("ArtBastard Puppet Theatre", WND_PROP_VISIBLE);
            int vizVisible = getWindowProperty("3D Fixture Visualization", WND_PROP_VISIBLE);
            
            // If main theatre window is closed, exit application
            if (theatreVisible < 0) {
                saveConfig(state.config);
                std::cout << "Theatre window closed. Settings saved." << std::endl;
                break;
            }
            
            // If 3D window is closed, disable 3D visualization
            if (vizVisible < 0) {
                state.config.show3DVisualization = false;
            }
        }
        
        frameCount++;
    }
}

int main(int /*argc*/, char** /*argv*/) {
    std::cout << "=== ArtBastard DMX Face Tracker ===" << std::endl;
    std::cout << "OpenCV Face Tracking for Moving Head Control" << std::endl;
    std::cout << "====================================" << std::endl;
    
#ifdef _WIN32
    // Initialize Winsock
    WSADATA wsaData;
    int wsaResult = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (wsaResult != 0) {
        std::cerr << "WSAStartup failed: " << wsaResult << std::endl;
        return 1;
    }
#endif
    
    // Initialize curl
    curl_global_init(CURL_GLOBAL_DEFAULT);
    
    // Load configuration
    Config config = loadConfig();
    std::cout << "Configuration loaded:" << std::endl;
    std::cout << "  DMX API URL: " << config.dmxApiUrl << std::endl;
    std::cout << "  Pan Channel: " << config.panChannel << std::endl;
    std::cout << "  Tilt Channel: " << config.tiltChannel << std::endl;
    std::cout << "  Camera Index: " << config.cameraIndex << std::endl;
    std::cout << "  Update Rate: " << config.updateRate << " Hz" << std::endl;
    
    // Initialize face detection
    FaceTrackerState state;
    state.config = config;
    
    // Load face cascade - try multiple possible locations
    std::vector<std::string> cascadePaths = {
        "haarcascade_frontalface_alt.xml",  // Current directory
        "../haarcascade_frontalface_alt.xml",  // Parent (if run from build/bin)
        "../../haarcascade_frontalface_alt.xml",  // Face-tracker root
        "../face-tracker/haarcascade_frontalface_alt.xml",  // If run from build
        "face-tracker/haarcascade_frontalface_alt.xml"  // Alternative
    };
    
    state.faceCascade = makePtr<CascadeClassifier>();
    bool cascadeLoaded = false;
    std::string loadedPath;
    
    for (const auto& cascadePath : cascadePaths) {
        if (state.faceCascade->load(cascadePath)) {
            cascadeLoaded = true;
            loadedPath = cascadePath;
            break;
        }
    }
    
    if (!cascadeLoaded) {
        std::cerr << "Error: Could not load face cascade from any location!" << std::endl;
        std::cerr << "Tried:" << std::endl;
        for (const auto& path : cascadePaths) {
            std::cerr << "  - " << path << std::endl;
        }
        std::cerr << std::endl;
        std::cerr << "Please ensure haarcascade_frontalface_alt.xml is in:" << std::endl;
        std::cerr << "  - Current directory, OR" << std::endl;
        std::cerr << "  - face-tracker/ directory" << std::endl;
        std::cerr << "You can download it from: https://github.com/opencv/opencv/tree/master/data/haarcascades" << std::endl;
        curl_global_cleanup();
        return -1;
    }
    
    std::cout << "Loaded face cascade from: " << loadedPath << std::endl;
    
    // Initialize facemark detector (for landmarks)
#ifdef HAVE_OPENCV_FACE
    state.facemark = FacemarkLBF::create();
    std::vector<std::string> facemarkPaths = {
        "lbfmodel.yaml",  // Current directory
        "../lbfmodel.yaml",  // Parent (if run from build/bin)
        "../../lbfmodel.yaml",  // Face-tracker root
        "../face-tracker/lbfmodel.yaml",  // If run from build
        "face-tracker/lbfmodel.yaml"  // Alternative
    };
    
    bool facemarkLoaded = false;
    for (const auto& facemarkPath : facemarkPaths) {
        try {
            state.facemark->loadModel(facemarkPath);
            std::cout << "Facial landmark model loaded from: " << facemarkPath << std::endl;
            facemarkLoaded = true;
            break;
        } catch (const cv::Exception& e) {
            // Try next path
            continue;
        }
    }
    
    if (!facemarkLoaded) {
        std::cout << "Warning: Could not load facial landmark model" << std::endl;
        std::cout << "Face detection will work but without detailed landmark tracking" << std::endl;
        std::cout << "You can download the model from OpenCV's face module" << std::endl;
        state.facemark = Ptr<Facemark>(); // Will use basic face center tracking
    }
#else
    std::cout << "OpenCV face module not available - using basic face center tracking" << std::endl;
    std::cout << "To enable facial landmark tracking, install OpenCV with contrib modules:" << std::endl;
    std::cout << "  vcpkg install opencv[contrib]:x64-windows" << std::endl;
    state.facemark = nullptr; // Will use basic face center tracking
#endif
    
    // Open camera
    VideoCapture cap(config.cameraIndex);
    if (!cap.isOpened()) {
        std::cerr << "Error: Could not open camera " << config.cameraIndex << std::endl;
        curl_global_cleanup();
        return -1;
    }
    
    // Set camera resolution for better performance (these are usually well-supported)
    setCameraProperty(cap, CAP_PROP_FRAME_WIDTH, 640);
    setCameraProperty(cap, CAP_PROP_FRAME_HEIGHT, 480);
    setCameraProperty(cap, CAP_PROP_FPS, 30);
    
    // Try to force color format (before grabbing frame)
    // Some backends require this to be set before opening, but we try anyway
    cap.set(CAP_PROP_CONVERT_RGB, 1);
    
    // Check if camera outputs color or grayscale - grab a test frame
    Mat testFrame;
    cap >> testFrame;
    if (!testFrame.empty()) {
        if (testFrame.channels() == 1) {
            std::cout << "WARNING: Camera is outputting GRAYSCALE frames (1 channel)." << std::endl;
            std::cout << "This is likely a camera driver limitation. The application will" << std::endl;
            std::cout << "convert frames to color, but quality may be reduced." << std::endl;
            std::cout << "Try a different camera or check camera settings." << std::endl;
        } else if (testFrame.channels() == 3) {
            std::cout << "Camera is outputting COLOR frames (3 channels - BGR format)." << std::endl;
        } else {
            std::cout << "WARNING: Camera output has " << testFrame.channels() << " channels (unexpected format)." << std::endl;
        }
    }
    // Note: testFrame will be discarded, we'll capture fresh frames in the loop
    
    // Configure camera exposure and brightness (may not be supported by all cameras)
    if (!config.autoExposure) {
        // Disable auto exposure for manual control
        setCameraProperty(cap, CAP_PROP_AUTO_EXPOSURE, 0.25, "auto exposure");
        if (config.cameraExposure >= -13 && config.cameraExposure <= 1) {
            bool success = setCameraProperty(cap, CAP_PROP_EXPOSURE, config.cameraExposure, "exposure");
            if (success) {
                std::cout << "Set camera exposure to: " << config.cameraExposure << " (manual mode)" << std::endl;
            }
        } else {
            // Default exposure if not set
            bool success = setCameraProperty(cap, CAP_PROP_EXPOSURE, -6.0, "exposure");
            if (success) {
                std::cout << "Set camera exposure to default: -6.0 (manual mode)" << std::endl;
            }
        }
    } else {
        // Enable auto exposure initially
        bool success = setCameraProperty(cap, CAP_PROP_AUTO_EXPOSURE, 0.75, "auto exposure");
        if (success) {
            std::cout << "Auto exposure enabled (slider will switch to manual when adjusted)" << std::endl;
        }
    }
    
    if (config.cameraBrightness >= 0) {
        bool success = setCameraProperty(cap, CAP_PROP_BRIGHTNESS, config.cameraBrightness, "brightness");
        if (success) {
            std::cout << "Set camera brightness to: " << config.cameraBrightness << std::endl;
        }
    }
    
    // Try to set other camera properties for better image (may not be supported)
    setCameraProperty(cap, CAP_PROP_AUTOFOCUS, 1, "autofocus");
    setCameraProperty(cap, CAP_PROP_AUTO_WB, 1, "auto white balance");
    
    std::cout << "Camera opened successfully" << std::endl;
    std::cout << "Camera settings applied:" << std::endl;
    std::cout << "  Brightness multiplier: " << config.brightness << std::endl;
    std::cout << "  Contrast multiplier: " << config.contrast << std::endl;
    std::cout << "  Auto exposure: " << (config.autoExposure ? "enabled" : "disabled") << std::endl;
    std::cout << "Starting face tracking..." << std::endl;
    
    // Set up trackbars in preview window (will be done after first frame is captured)
    if (config.showPreview) {
        state.cap = &cap;
        
        // Initialize trackbar positions based on config values
        state.brightnessSlider = static_cast<int>(config.brightness * 33.33f);  // 0.0-3.0 -> 0-100
        if (state.brightnessSlider > 100) state.brightnessSlider = 100;
        if (state.brightnessSlider < 0) state.brightnessSlider = 0;
        
        state.contrastSlider = static_cast<int>(config.contrast * 33.33f);  // 0.0-3.0 -> 0-100
        if (state.contrastSlider > 100) state.contrastSlider = 100;
        if (state.contrastSlider < 0) state.contrastSlider = 0;
        
        // Initialize exposure slider based on config (or default to middle)
        if (config.cameraExposure >= -13 && config.cameraExposure <= 1) {
            // Map exposure (-13 to 1) to slider (0 to 100)
            state.exposureSlider = static_cast<int>(((config.cameraExposure + 13.0) / 14.0) * 100.0);
        } else {
            state.exposureSlider = 50;  // Default to middle
        }
        if (state.exposureSlider > 100) state.exposureSlider = 100;
        if (state.exposureSlider < 0) state.exposureSlider = 0;
        
        std::cout << "Interactive controls:" << std::endl;
        std::cout << "  - Use sliders in preview window to adjust brightness/contrast/exposure" << std::endl;
        std::cout << "  - Use the 'Quit' button in the config section to exit" << std::endl;
        std::cout << "  - Settings will be saved to config on exit" << std::endl;
    }
    
    // Initialize smoothed values to center
    state.smoothedPan = 0.0f;
    state.smoothedTilt = 0.0f;
    
    // Start tracking
    try {
        trackFace(cap, state);
    } catch (const std::exception& e) {
        std::cerr << "Error during tracking: " << e.what() << std::endl;
    }
    
    // Cleanup
    cap.release();
    if (config.showPreview) {
        destroyAllWindows();
    }
    curl_global_cleanup();
    
#ifdef _WIN32
    // Cleanup Winsock
    WSACleanup();
#endif
    
    std::cout << "Face tracker stopped. Goodbye!" << std::endl;
    return 0;
}

