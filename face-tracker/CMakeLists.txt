cmake_minimum_required(VERSION 3.12)
project(ArtBastardFaceTracker)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Set vcpkg toolchain if available
if(EXISTS "C:/vcpkg/scripts/buildsystems/vcpkg.cmake")
    set(CMAKE_TOOLCHAIN_FILE "C:/vcpkg/scripts/buildsystems/vcpkg.cmake" CACHE STRING "")
endif()

# Find required packages
find_package(OpenCV REQUIRED)
find_package(CURL REQUIRED)
# PkgConfig is not needed on Windows and may not be available
# find_package(PkgConfig REQUIRED)

# Find nlohmann_json (header-only)
# Try to find it in standard locations
find_path(JSON_INCLUDE_DIR nlohmann/json.hpp
    PATHS
        /usr/include
        /usr/local/include
        /opt/homebrew/include
        ${CMAKE_SOURCE_DIR}/third_party
    NO_DEFAULT_PATH
)

# If not found, try with default paths
if(NOT JSON_INCLUDE_DIR)
    find_path(JSON_INCLUDE_DIR nlohmann/json.hpp)
endif()

# Check if found
if(NOT JSON_INCLUDE_DIR)
    message(FATAL_ERROR "nlohmann/json.hpp not found. Please install it via package manager:\n"
        "  Ubuntu/Debian: sudo apt-get install nlohmann-json3-dev\n"
        "  Arch/CachyOS: sudo pacman -S nlohmann-json\n"
        "  macOS: brew install nlohmann-json")
else()
    message(STATUS "Found nlohmann/json at: ${JSON_INCLUDE_DIR}")
endif()

# Include directories
include_directories(
    ${OpenCV_INCLUDE_DIRS}
    ${CURL_INCLUDE_DIRS}
    ${JSON_INCLUDE_DIR}
)

# Source files
set(SOURCES
    main.cpp
)

# Executable
add_executable(face-tracker ${SOURCES})

# Link libraries
# Filter out optional OpenCV modules that may have missing dependencies (viz, hdf)
# We only need core face tracking modules for face detection
set(FILTERED_OPENCV_LIBS "")
foreach(lib ${OpenCV_LIBS})
    # Exclude modules that require external dependencies we don't need
    if(NOT lib MATCHES "opencv_viz" 
       AND NOT lib MATCHES "opencv_hdf")
        list(APPEND FILTERED_OPENCV_LIBS ${lib})
    endif()
endforeach()

# Check if OpenCV face module is available (from contrib modules)
find_library(OPENCV_FACE_LIB 
    NAMES opencv_face
    PATHS ${OpenCV_LIB_DIR} ${OpenCV_LIB_DIRS}
    NO_DEFAULT_PATH
)

# If not found in explicit paths, try default paths
if(NOT OPENCV_FACE_LIB)
    find_library(OPENCV_FACE_LIB NAMES opencv_face)
endif()

if(OPENCV_FACE_LIB)
    message(STATUS "Found OpenCV face module: ${OPENCV_FACE_LIB}")
    add_definitions(-DHAVE_OPENCV_FACE)
else()
    message(STATUS "OpenCV face module not found - will use basic face center tracking")
    message(STATUS "To enable facial landmark tracking, install OpenCV with contrib modules")
endif()

# Use only essential OpenCV modules for face tracking
# Explicitly link only what we need to avoid dependency issues
target_link_libraries(face-tracker
    opencv_core
    opencv_imgproc
    opencv_imgcodecs
    opencv_highgui
    opencv_videoio
    opencv_objdetect
    ${CURL_LIBRARIES}
)

# Link face module if available
if(OPENCV_FACE_LIB)
    target_link_libraries(face-tracker ${OPENCV_FACE_LIB})
endif()

# Compiler options - use compiler-specific flags
target_compile_options(face-tracker PRIVATE
    # MSVC flags
    $<$<CXX_COMPILER_ID:MSVC>:/W4 /O2>
    # GCC/Clang flags
    $<$<OR:$<CXX_COMPILER_ID:GNU>,$<CXX_COMPILER_ID:Clang>,$<CXX_COMPILER_ID:AppleClang>>:-Wall -Wextra -O3>
)

# Output directory
set_target_properties(face-tracker PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

message(STATUS "OpenCV version: ${OpenCV_VERSION}")
message(STATUS "OpenCV include dirs: ${OpenCV_INCLUDE_DIRS}")
message(STATUS "OpenCV libraries: ${OpenCV_LIBS}")
message(STATUS "CURL libraries: ${CURL_LIBRARIES}")

