/**
 * OpenCV Visage Tracker Expérimental (WIP) - Œuvre Incomplète
 * 
 * ⚠️ AVERTISSEMENT / WARNING: Ceci est un travail en cours (Work In Progress)
 * Cette implémentation est hautement expérimentale et incomplète.
 * 
 * Features: Camera + OpenCV + face detection + advanced tracking settings
 * Status: Experimental / Incomplete / Work In Progress
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useStore } from '../../store';
import { Fixture3DModel } from './Fixture3DModel';

interface DebugState {
  isRunning: boolean;
  opencvReady: boolean;
  cameraReady: boolean;
  faceDetected: boolean;
  pan: number;
  tilt: number;
  loopIterations: number;
  detections: number;
  error: string | null;
  lastDmxMessage: { channel: number; value: number }[] | null;
  lastOscMessage: string | null;
}

interface FeatureFlags {
  enableFaceTracking: boolean; // Basic pan/tilt face tracking
}

export const OpenCVVisageTrackerExperimental: React.FC = () => {
  const { socket, connected } = useSocket();
  const { fixtures } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const opencvRef = useRef<any>(null);
  const cascadeRef = useRef<any>(null);
  const rafIdRef = useRef<number | undefined>(undefined);
  const loopCountRef = useRef<number>(0);
  const detectionCountRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  const [state, setState] = useState<DebugState>({
    isRunning: false,
    opencvReady: false,
    cameraReady: false,
    faceDetected: false,
    pan: 128,
    tilt: 128,
    loopIterations: 0,
    detections: 0,
    error: null,
    lastDmxMessage: null,
    lastOscMessage: null
  });

  const [hz, setHz] = useState<number>(10);
  const hzRef = useRef<number>(10); // Ref to track current Hz for the loop

  // OpenCV detection parameters
  const [opencvParams, setOpencvParams] = useState({
    scaleFactor: 1.1, // How much to scale image at each step (1.1 = 10% reduction)
    minNeighbors: 3,  // Minimum neighbors required for detection
    minSize: 30,      // Minimum face size in pixels
  });
  const opencvParamsRef = useRef(opencvParams);

  // Feature flags - face tracking enabled by default (core feature)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    enableFaceTracking: true, // Basic pan/tilt - ENABLED by default (core feature)
  });

  // DMX channel configuration
  const [dmxChannels, setDmxChannels] = useState({
    pan: 0,
    tilt: 1,
  });

  // Tracking settings (advanced configuration)
  const [settings, setSettings] = useState({
    panSensitivity: 1.0,
    tiltSensitivity: 1.0,
    smoothingFactor: 0.85,
    cutoff: 0.02,
    panMin: 0,
    panMax: 255,
    tiltMin: 0,
    tiltMax: 255,
    flipPan: false,
    flipTilt: false,
    panOffset: 128,
    tiltOffset: 128,
    maxVelocity: 5.0,
  });

  // Refs for smoothed values (for setToCenter function)
  const smoothedPanRef = useRef<number>(0);
  const smoothedTiltRef = useRef<number>(0);

  // Ref to track feature flags for the detection loop (avoid stale closures)
  const featureFlagsRef = useRef<FeatureFlags>(featureFlags);

  // Ref to track DMX channels for the detection loop (avoid stale closures)
  const dmxChannelsRef = useRef(dmxChannels);

  // Ref to track settings for the detection loop (avoid stale closures)
  const settingsRef = useRef(settings);

  // Keep featureFlagsRef in sync
  useEffect(() => {
    featureFlagsRef.current = featureFlags;
    console.log('[DEBUG] 🔄 Feature flags updated:', featureFlags);
  }, [featureFlags]);

  // Keep dmxChannelsRef in sync
  useEffect(() => {
    dmxChannelsRef.current = dmxChannels;
    console.log('[DEBUG] 🔄 DMX channels updated:', dmxChannels);
  }, [dmxChannels]);

  // Keep settingsRef in sync
  useEffect(() => {
    settingsRef.current = settings;
    console.log('[DEBUG] 🔄 Settings updated:', settings);
  }, [settings]);

  // Keep hzRef in sync with hz state
  useEffect(() => {
    hzRef.current = hz;
    console.log('[DEBUG] 🔄 Hz ref synced to:', hz);
  }, [hz]);

  // Keep opencvParamsRef in sync
  useEffect(() => {
    opencvParamsRef.current = opencvParams;
    console.log('[DEBUG] 🔄 OpenCV params updated:', opencvParams);
  }, [opencvParams]);

  // Initialize OpenCV - COMPLETELY REBUILT
  useEffect(() => {
    console.log('[DEBUG] 🔵 [REBUILD] Starting OpenCV initialization from scratch...');

    const loadOpenCV = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.cv && window.cv.Mat) {
          console.log('[DEBUG] ✅ [REBUILD] OpenCV already available');
          resolve();
          return;
        }

        // Check if script is already in DOM
        const existingScript = document.querySelector('script[src*="opencv"]');
        if (existingScript) {
          console.log('[DEBUG] ⏳ [REBUILD] OpenCV script already in DOM, waiting for load...');
        } else {
          // Dynamically load OpenCV.js
          console.log('[DEBUG] 📥 [REBUILD] Loading OpenCV.js script...');
          const script = document.createElement('script');
          script.src = 'https://docs.opencv.org/4.x/opencv.js';
          script.async = true;
          script.type = 'text/javascript';

          script.onload = () => {
            console.log('[DEBUG] ✅ [REBUILD] OpenCV.js script loaded, waiting for cv object...');
            // Wait for cv to be available (it loads asynchronously)
            const checkCv = setInterval(() => {
              if (window.cv && window.cv.Mat) {
                clearInterval(checkCv);
                console.log('[DEBUG] ✅ [REBUILD] OpenCV cv object available!');
                resolve();
              }
            }, 50);

            // Timeout after 30 seconds
            setTimeout(() => {
              clearInterval(checkCv);
              reject(new Error('OpenCV cv object timeout after script load'));
            }, 30000);
          };

          script.onerror = () => {
            console.error('[DEBUG] ❌ [REBUILD] Failed to load OpenCV.js script');
            reject(new Error('Failed to load OpenCV.js script'));
          };

          document.head.appendChild(script);
        }

        // Poll for cv object (in case script was already loaded)
        let attempts = 0;
        const maxAttempts = 600; // 30 seconds at 50ms intervals
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.cv && window.cv.Mat) {
            clearInterval(checkInterval);
            console.log('[DEBUG] ✅ [REBUILD] OpenCV cv object found after', attempts, 'attempts');
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            reject(new Error(`OpenCV timeout after ${attempts} attempts (${attempts * 50}ms)`));
          }
        }, 50);
      });
    };

    const initOpenCV = async () => {
      try {
        // Step 1: Load OpenCV.js
        await loadOpenCV();

        // Step 2: Store reference
        opencvRef.current = window.cv;
        console.log('[DEBUG] 📦 [REBUILD] OpenCV reference stored');

        // Step 3: Load cascade file
        console.log('[DEBUG] 📥 [REBUILD] Loading cascade file...');
        const response = await fetch('/haarcascade_frontalface_alt.xml');
        if (!response.ok) {
          throw new Error(`Cascade file not found: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        console.log('[DEBUG] 📝 [REBUILD] Cascade file loaded, size:', text.length, 'bytes');

        // Step 4: Write to OpenCV filesystem
        opencvRef.current.FS.writeFile('haarcascade_frontalface_alt.xml', text);
        console.log('[DEBUG] 💾 [REBUILD] Cascade written to OpenCV filesystem');

        // Step 5: Create and load classifier
        cascadeRef.current = new opencvRef.current.CascadeClassifier();
        const loaded = cascadeRef.current.load('haarcascade_frontalface_alt.xml');
        if (!loaded) {
          throw new Error('Failed to load cascade classifier');
        }
        console.log('[DEBUG] 🎯 [REBUILD] Cascade classifier loaded successfully');

        // Step 6: Mark as ready
        setState(prev => ({ ...prev, opencvReady: true, error: null }));
        console.log('[DEBUG] ✅ [REBUILD] OpenCV initialization COMPLETE');
      } catch (error: any) {
        console.error('[DEBUG] ❌ [REBUILD] OpenCV init error:', error);
        setState(prev => ({ ...prev, error: error.message || 'OpenCV initialization failed' }));
      }
    };

    initOpenCV();
  }, []);

  // Start camera - REBUILT
  const startCamera = useCallback(async () => {
    console.log('[DEBUG] 🎥 [REBUILD] Starting camera...');

    // Stop existing stream if any
    if (streamRef.current) {
      console.log('[DEBUG] 🛑 [REBUILD] Stopping existing camera stream');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      // Request camera with constraints
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front-facing camera
        }
      };

      console.log('[DEBUG] 📹 [REBUILD] Requesting camera with constraints:', constraints);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser or connection (HTTPS required)');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[DEBUG] ✅ [REBUILD] Camera stream obtained');

      // Store stream reference
      streamRef.current = stream;

      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not available'));
            return;
          }

          const video = videoRef.current!;

          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            console.log('[DEBUG] 📐 [REBUILD] Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
            resolve();
          };

          const onError = (e: Event) => {
            video.removeEventListener('error', onError);
            reject(new Error('Video playback error'));
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);

          // Start playing
          video.play().then(() => {
            console.log('[DEBUG] ▶️ [REBUILD] Video playing');
          }).catch(err => {
            console.error('[DEBUG] ❌ [REBUILD] Video play error:', err);
            reject(err);
          });
        });
      }

      setState(prev => ({ ...prev, cameraReady: true, error: null }));
      console.log('[DEBUG] ✅ [REBUILD] Camera ready');
    } catch (error: any) {
      console.error('[DEBUG] ❌ [REBUILD] Camera error:', error);
      setState(prev => ({
        ...prev,
        cameraReady: false,
        error: `Camera error: ${error.message || error.name || 'Unknown error'}`
      }));
    }
  }, []);

  // Stop camera - REBUILT
  const stopCamera = useCallback(() => {
    console.log('[DEBUG] 🛑 [REBUILD] Stopping camera...');

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[DEBUG] 🛑 [REBUILD] Stopped track:', track.kind, track.label);
      });
      streamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }

    setState(prev => ({ ...prev, cameraReady: false }));
    console.log('[DEBUG] ✅ [REBUILD] Camera stopped');
  }, []);

  // Start/stop detection loop - COMPLETELY REBUILT
  const startDetection = useCallback(() => {
    console.log('[DEBUG] 🚀 [REBUILD] Starting detection loop...', {
      hz: hzRef.current,
      opencv: !!opencvRef.current,
      cascade: !!cascadeRef.current,
      video: !!videoRef.current,
      canvas: !!canvasRef.current,
      isRunning: isRunningRef.current
    });

    // Validate prerequisites
    if (!opencvRef.current || !cascadeRef.current) {
      console.error('[DEBUG] ❌ [REBUILD] Cannot start - OpenCV not ready', {
        opencv: !!opencvRef.current,
        cascade: !!cascadeRef.current
      });
      setState(prev => ({ ...prev, error: 'OpenCV not ready' }));
      return;
    }

    if (!videoRef.current || !canvasRef.current) {
      console.error('[DEBUG] ❌ [REBUILD] Cannot start - video/canvas not ready', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current
      });
      setState(prev => ({ ...prev, error: 'Video/canvas not ready' }));
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Make sure video is playing
    if (video.paused) {
      console.log('[DEBUG] ⏸️ [REBUILD] Video paused, attempting to play...');
      video.play().catch(err => {
        console.error('[DEBUG] ❌ [REBUILD] Failed to play video:', err);
        setState(prev => ({ ...prev, error: `Video play error: ${err.message}` }));
        return;
      });
    }

    // Cancel any existing loop
    if (rafIdRef.current !== undefined) {
      console.log('[DEBUG] 🛑 [REBUILD] Cancelling existing detection loop');
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }

    // Reset counters
    loopCountRef.current = 0;
    detectionCountRef.current = 0;
    lastDetectionTimeRef.current = 0;

    // Sync ref with current state
    hzRef.current = hz;
    console.log('[DEBUG] ✅ [REBUILD] All refs ready, starting RAF loop, Hz:', hzRef.current);

    const detectLoop = () => {
      loopCountRef.current++;
      const iteration = loopCountRef.current;

      // 🔑 SCHEDULE NEXT FRAME FIRST
      rafIdRef.current = requestAnimationFrame(detectLoop);

      // Log every 60 frames
      if (iteration % 60 === 0) {
        console.log(`[DEBUG] 🔄 Loop iteration #${iteration}, isRunning: ${isRunningRef.current}`);
      }

      // Check if we should run
      if (!isRunningRef.current) {
        if (iteration % 60 === 0) {
          console.log('[DEBUG] ⏸️ Paused - isRunning is false');
        }
        return;
      }

      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        if (iteration % 60 === 0) {
          console.log('[DEBUG] ⏸️ Video not ready, readyState:', video.readyState);
        }
        return;
      }

      // Throttle based on Hz (use ref to get current value, not closure)
      const currentHz = hzRef.current;
      const now = Date.now();
      const interval = 1000 / currentHz;
      if (now - lastDetectionTimeRef.current < interval) {
        return; // Throttled
      }
      lastDetectionTimeRef.current = now;

      console.log(`[DEBUG] 🔍 RUNNING DETECTION (iteration #${iteration}, Hz: ${currentHz})`);

      try {
        // Resize canvas if needed
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          console.log('[DEBUG] 📐 Canvas resized:', canvas.width, 'x', canvas.height);
        }

        // Draw video
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        // Create detection canvas (smaller for speed)
        const detCanvas = document.createElement('canvas');
        const detWidth = 320;
        const detHeight = Math.round((video.videoHeight / video.videoWidth) * detWidth);
        detCanvas.width = detWidth;
        detCanvas.height = detHeight;

        const detCtx = detCanvas.getContext('2d')!;
        detCtx.drawImage(video, 0, 0, detWidth, detHeight);

        // OpenCV detection
        const src = opencvRef.current.imread(detCanvas);
        const gray = new opencvRef.current.Mat();
        opencvRef.current.cvtColor(src, gray, opencvRef.current.COLOR_RGBA2GRAY);

        const faces = new opencvRef.current.RectVector();
        const currentParams = opencvParamsRef.current;
        const minSize = new opencvRef.current.Size(currentParams.minSize, currentParams.minSize);

        cascadeRef.current.detectMultiScale(
          gray,
          faces,
          currentParams.scaleFactor,
          currentParams.minNeighbors,
          0, // flags (0 = default)
          minSize
        );

        const faceCount = faces.size();
        console.log(`[DEBUG] 👤 Faces found: ${faceCount}`);

        if (faceCount > 0) {
          detectionCountRef.current++;

          const face = faces.get(0);
          const scaleX = video.videoWidth / detWidth;
          const scaleY = video.videoHeight / detHeight;

          const faceCenterX = (face.x + face.width / 2) * scaleX;
          const faceCenterY = (face.y + face.height / 2) * scaleY;
          const imageCenterX = video.videoWidth / 2;
          const imageCenterY = video.videoHeight / 2;

          // Face tracking (pan/tilt) - only if enabled (use ref to avoid stale closure)
          let panValue = 128;
          let tiltValue = 128;
          const currentFlags = featureFlagsRef.current;

          if (currentFlags.enableFaceTracking) {
            const currentSettings = settingsRef.current;

            // Calculate raw pan/tilt (-1 to 1)
            const panRaw = (faceCenterX - imageCenterX) / imageCenterX;
            const tiltRaw = -(faceCenterY - imageCenterY) / imageCenterY;

            // Apply cutoff (dead zone)
            const panAbs = Math.abs(panRaw);
            const tiltAbs = Math.abs(tiltRaw);
            const targetPan = panAbs > currentSettings.cutoff ? panRaw : 0;
            const targetTilt = tiltAbs > currentSettings.cutoff ? tiltRaw : 0;

            // Apply smoothing
            const smoothingRate = 1 - currentSettings.smoothingFactor;
            let newPan = smoothedPanRef.current * currentSettings.smoothingFactor + targetPan * smoothingRate;
            let newTilt = smoothedTiltRef.current * currentSettings.smoothingFactor + targetTilt * smoothingRate;

            // Apply velocity limiting
            const maxChange = currentSettings.maxVelocity / 100;
            const panChange = newPan - smoothedPanRef.current;
            const tiltChange = newTilt - smoothedTiltRef.current;

            if (Math.abs(panChange) > maxChange) {
              newPan = smoothedPanRef.current + Math.sign(panChange) * maxChange;
            }
            if (Math.abs(tiltChange) > maxChange) {
              newTilt = smoothedTiltRef.current + Math.sign(tiltChange) * maxChange;
            }

            smoothedPanRef.current = newPan;
            smoothedTiltRef.current = newTilt;

            // Map to DMX values with sensitivity, flip, and offset
            const panDirection = currentSettings.flipPan ? -1 : 1;
            const tiltDirection = currentSettings.flipTilt ? -1 : 1;
            const panScaled = newPan * panDirection * currentSettings.panSensitivity * 127;
            const tiltScaled = newTilt * tiltDirection * currentSettings.tiltSensitivity * 127;

            panValue = Math.round(
              Math.max(currentSettings.panMin, Math.min(currentSettings.panMax,
                panScaled + currentSettings.panOffset
              ))
            );
            tiltValue = Math.round(
              Math.max(currentSettings.tiltMin, Math.min(currentSettings.tiltMax,
                tiltScaled + currentSettings.tiltOffset
              ))
            );

            console.log(`[DEBUG] ✅ Face at (${faceCenterX.toFixed(0)}, ${faceCenterY.toFixed(0)}), Pan: ${panValue}, Tilt: ${tiltValue}, Raw: pan=${panRaw.toFixed(3)}, tilt=${tiltRaw.toFixed(3)}, Smoothed: pan=${newPan.toFixed(3)}, tilt=${newTilt.toFixed(3)}`);
          } else {
            console.log(`[DEBUG] 👁️ Face detected but tracking disabled (enableFaceTracking: false)`);
            // Still calculate pan/tilt for display even if tracking is disabled
            const panRaw = (faceCenterX - imageCenterX) / imageCenterX;
            const tiltRaw = -(faceCenterY - imageCenterY) / imageCenterY;
            panValue = Math.round(Math.max(0, Math.min(255, panRaw * 127 + 128)));
            tiltValue = Math.round(Math.max(0, Math.min(255, tiltRaw * 127 + 128)));
          }


          setState(prev => ({
            ...prev,
            faceDetected: true,
            pan: panValue,
            tilt: tiltValue,
            loopIterations: iteration,
            detections: detectionCountRef.current
          }));

          // Draw face box (always draw if face detected)
          ctx.strokeStyle = 'lime';
          ctx.lineWidth = 2;
          ctx.strokeRect(face.x * scaleX, face.y * scaleY, face.width * scaleX, face.height * scaleY);
          ctx.fillStyle = 'yellow';
          ctx.beginPath();
          ctx.arc(faceCenterX, faceCenterY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Send DMX (only if face tracking enabled)
          if (currentFlags.enableFaceTracking && socket && connected) {
            const currentDmxChannels = dmxChannelsRef.current; // Use ref to avoid stale closure
            const dmxData: { [key: number]: number } = {};
            const dmxMessage: { channel: number; value: number }[] = [];

            // Pan channel
            if (currentDmxChannels.pan >= 0 && currentDmxChannels.pan <= 511) {
              dmxData[currentDmxChannels.pan] = panValue;
              dmxMessage.push({ channel: currentDmxChannels.pan, value: panValue });
            }

            // Tilt channel
            if (currentDmxChannels.tilt >= 0 && currentDmxChannels.tilt <= 511) {
              dmxData[currentDmxChannels.tilt] = tiltValue;
              dmxMessage.push({ channel: currentDmxChannels.tilt, value: tiltValue });
            }


            if (Object.keys(dmxData).length > 0) {
              (socket as any).emit('dmx:batch', dmxData);

              // Update state with last DMX message for display
              setState(prev => ({
                ...prev,
                lastDmxMessage: dmxMessage,
                lastOscMessage: null // No OSC in debug version yet
              }));
              console.log(`[DEBUG] 📤 DMX sent:`, dmxMessage);
            }
          } else if (currentFlags.enableFaceTracking && (!socket || !connected)) {
            console.log(`[DEBUG] ⚠️ Face tracking enabled but socket not connected (socket: ${!!socket}, connected: ${connected})`);
          }
        } else {
          // No face detected - keep last pan/tilt values but mark face as not detected
          setState(prev => ({
            ...prev,
            faceDetected: false,
            loopIterations: iteration
            // Don't reset pan/tilt - keep last known values
          }));
        }

        // Cleanup
        src.delete();
        gray.delete();
        faces.delete();
        minSize.delete();

      } catch (error: any) {
        console.error('[DEBUG] ❌ Detection error:', error);
      }
    };

    console.log('[DEBUG] 🎬 Starting RAF loop with Hz:', hzRef.current);
    detectLoop();
  }, [socket, connected]); // Removed hz from deps - using ref instead so loop doesn't restart

  const stopDetection = useCallback(() => {
    console.log('[DEBUG] 🛑 Stopping detection loop');
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = undefined;
    }
    loopCountRef.current = 0;
    detectionCountRef.current = 0;
  }, []);

  // Auto-start detection when OpenCV becomes ready and camera is running
  useEffect(() => {
    if (state.opencvReady && state.isRunning && state.cameraReady && opencvRef.current && cascadeRef.current) {
      console.log('[DEBUG] 🔄 OpenCV ready while running, starting detection');
      startDetection();
    }
  }, [state.opencvReady, state.isRunning, state.cameraReady, startDetection]);

  // Handle start/stop
  const handleToggle = async () => {
    const newRunning = !state.isRunning;
    console.log('[DEBUG] 🔘 Toggle:', newRunning, 'OpenCV ready:', opencvRef.current && cascadeRef.current);

    isRunningRef.current = newRunning;
    setState(prev => ({ ...prev, isRunning: newRunning }));

    if (newRunning) {
      // Always start camera, even if OpenCV isn't ready
      await startCamera();

      // Wait a bit for camera to be ready, then start detection
      setTimeout(() => {
        if (!isRunningRef.current) return; // User stopped already

        // Check if OpenCV is ready
        if (opencvRef.current && cascadeRef.current && videoRef.current && canvasRef.current) {
          console.log('[DEBUG] ✅ All ready, starting detection immediately');
          startDetection();
        } else {
          console.log('[DEBUG] ⏳ Waiting for OpenCV/camera to be ready...');
          // Poll for readiness
          const checkReady = setInterval(() => {
            if (!isRunningRef.current) {
              clearInterval(checkReady);
              return;
            }

            // Check both state and refs - use video readyState directly
            const video = videoRef.current;
            const videoReady = video && (video.readyState >= video.HAVE_METADATA || state.cameraReady);

            if (opencvRef.current && cascadeRef.current && video && canvasRef.current && videoReady) {
              clearInterval(checkReady);
              console.log('[DEBUG] ✅ All ready now, starting detection');
              startDetection();
            } else if (loopCountRef.current % 10 === 0) {
              // Log every 10 checks to avoid spam
              console.log('[DEBUG] ⏳ Still waiting...', {
                opencv: !!opencvRef.current,
                cascade: !!cascadeRef.current,
                video: !!video,
                canvas: !!canvasRef.current,
                videoReady: videoReady,
                videoReadyState: video?.readyState
              });
            }
          }, 100);

          // Timeout after 15 seconds
          setTimeout(() => {
            clearInterval(checkReady);
            if (isRunningRef.current && (!opencvRef.current || !cascadeRef.current)) {
              console.error('[DEBUG] ❌ Timeout waiting for OpenCV');
              setState(prev => ({ ...prev, error: 'OpenCV initialization timeout' }));
            }
          }, 15000);
        }
      }, 500);
    } else {
      stopDetection();
      stopCamera();
    }
  };

  // Set to center function
  const setToCenter = () => {
    if (!state.isRunning || !state.faceDetected) {
      alert('Face Tracker must be running and detecting your face to set center position. Please start tracking and ensure your face is visible.');
      return;
    }

    const currentPan = smoothedPanRef.current;
    const currentTilt = smoothedTiltRef.current;
    const panCenter = (settings.panMin + settings.panMax) / 2;
    const tiltCenter = (settings.tiltMin + settings.tiltMax) / 2;
    const panDirection = settings.flipPan ? -1 : 1;
    const tiltDirection = settings.flipTilt ? -1 : 1;
    const panScaled = currentPan * panDirection * settings.panSensitivity * 127;
    const tiltScaled = currentTilt * tiltDirection * settings.tiltSensitivity * 127;
    const newPanOffset = Math.round(panCenter - panScaled);
    const newTiltOffset = Math.round(tiltCenter - tiltScaled);
    const clampedPanOffset = Math.max(0, Math.min(255, newPanOffset));
    const clampedTiltOffset = Math.max(0, Math.min(255, newTiltOffset));

    setSettings(prev => ({
      ...prev,
      panOffset: clampedPanOffset,
      tiltOffset: clampedTiltOffset
    }));

    alert(`Center position set!\nPan Offset: ${clampedPanOffset}\nTilt Offset: ${clampedTiltOffset}\n\nYour current face position is now the center.`);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{
        padding: '1rem',
        background: 'rgba(255, 165, 0, 0.2)',
        border: '3px solid #ff9800',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <h1 style={{ color: '#ff9800', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
          ⚠️ OpenCV Visage Tracker Expérimental (WIP) - Œuvre Incomplète
        </h1>
        <p style={{ color: '#ffcc80', fontSize: '0.9rem', margin: 0 }}>
          <strong>AVERTISSEMENT / WARNING:</strong> Ceci est un travail en cours (Work In Progress).
          Cette implémentation est hautement expérimentale et incomplète.
          <em>Use at your own risk, mon ami.</em>
        </p>
      </div>

      <div style={{
        padding: '1rem',
        background: 'rgba(255, 165, 0, 0.1)',
        border: '2px solid #ff9800',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff9800' }}>Purpose</h3>
        <p style={{ margin: 0 }}>
          Minimal face tracking implementation from scratch. No complex features, just core detection.
          If this works, the issue is in the main FaceTracker's added features.
          If this doesn't work, the issue is environmental (OpenCV, camera, browser).
        </p>
      </div>

      {state.error && (
        <div style={{
          padding: '1rem',
          background: 'rgba(255, 0, 0, 0.2)',
          border: '2px solid red',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: 'red'
        }}>
          ❌ Error: {state.error}
        </div>
      )}

      {/* Status Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>OpenCV</div>
          <div style={{ fontSize: '1.5rem', color: state.opencvReady ? 'lime' : 'orange' }}>
            {state.opencvReady ? '✅' : '⏳'}
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Camera</div>
          <div style={{ fontSize: '1.5rem', color: state.cameraReady ? 'lime' : 'orange' }}>
            {state.cameraReady ? '✅' : '⏳'}
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Running</div>
          <div style={{ fontSize: '1.5rem', color: state.isRunning ? 'lime' : 'red' }}>
            {state.isRunning ? '🟢' : '🔴'}
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Face Detected</div>
          <div style={{ fontSize: '1.5rem', color: state.faceDetected ? 'lime' : 'gray' }}>
            {state.faceDetected ? '✅' : '❌'}
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Loop Iterations</div>
          <div style={{ fontSize: '1.2rem', color: '#00d4ff' }}>
            {state.loopIterations}
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Detections Run</div>
          <div style={{ fontSize: '1.2rem', color: '#00d4ff' }}>
            {state.detections}
          </div>
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Pan</div>
          <div style={{ fontSize: '1.2rem', color: state.faceDetected ? '#4caf50' : '#888', fontWeight: 'bold' }}>
            {state.pan}
          </div>
          {state.faceDetected && (
            <div style={{ fontSize: '0.7rem', color: '#4caf50', marginTop: '0.25rem' }}>
              🟢 Tracking
            </div>
          )}
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Tilt</div>
          <div style={{ fontSize: '1.2rem', color: state.faceDetected ? '#4caf50' : '#888', fontWeight: 'bold' }}>
            {state.tilt}
          </div>
          {state.faceDetected && (
            <div style={{ fontSize: '0.7rem', color: '#4caf50', marginTop: '0.25rem' }}>
              🟢 Tracking
            </div>
          )}
        </div>
        <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.8rem', color: '#888' }}>Socket</div>
          <div style={{ fontSize: '1.5rem', color: connected ? 'lime' : 'red' }}>
            {connected ? '✅' : '❌'}
          </div>
        </div>
      </div>

      {/* DMX/OSC Output Display */}
      <div style={{
        border: '2px solid #00d4ff',
        borderRadius: '8px',
        padding: '1rem',
        background: 'rgba(0, 212, 255, 0.1)',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#00d4ff', fontSize: '1.1rem', fontWeight: 'bold' }}>
          📤 DMX/OSC Output
        </h3>
        {state.lastDmxMessage ? (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#00d4ff', marginBottom: '0.25rem' }}>Last DMX Message:</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px' }}>
              {state.lastDmxMessage.map((msg, idx) => (
                <div key={idx} style={{ color: '#fff' }}>
                  Channel {msg.channel}: {msg.value}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              Pan: {state.pan} | Tilt: {state.tilt}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
            No DMX messages sent yet. {!featureFlags.enableFaceTracking && '(Face tracking disabled)'}
            {featureFlags.enableFaceTracking && !connected && ' (Socket not connected)'}
          </div>
        )}
        {state.lastOscMessage && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.9rem', color: '#00d4ff', marginBottom: '0.25rem' }}>Last OSC Message:</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', color: '#fff' }}>
              {state.lastOscMessage}
            </div>
          </div>
        )}
      </div>

      {/* Controls - Moved above camera preview */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        marginBottom: '1rem',
        padding: '1rem',
        background: 'rgba(0, 212, 255, 0.1)',
        borderRadius: '8px',
        border: '2px solid #00d4ff'
      }}>
        <button
          onClick={handleToggle}
          style={{
            padding: '1rem 2rem',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            background: state.isRunning ? '#f44336' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            opacity: 1
          }}
        >
          {state.isRunning ? '🛑 STOP' : '▶️ START'}
        </button>
        {!state.opencvReady && !state.isRunning && (
          <span style={{ color: '#ff9800', fontSize: '0.9rem' }}>
            ⚠️ OpenCV loading... Camera will start, detection will begin when ready
          </span>
        )}
        {state.isRunning && !state.faceDetected && (
          <span style={{ color: '#ff9800', fontSize: '0.9rem' }}>
            ⚠️ Waiting for face detection...
          </span>
        )}
        {state.isRunning && state.faceDetected && (
          <span style={{ color: '#4caf50', fontSize: '0.9rem', fontWeight: 'bold' }}>
            ✅ Face tracking active
          </span>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <span>Detection Rate (Hz):</span>
          <input
            type="range"
            min="0.1"
            max="120"
            step="0.1"
            value={hz}
            onChange={(e) => {
              const newHz = parseFloat(e.target.value);
              console.log('[DEBUG] 🎛️ Hz slider changed to:', newHz);
              hzRef.current = newHz; // Update ref immediately so loop uses new value
              setHz(newHz);
            }}
            style={{ width: '200px' }}
          />
          <input
            type="number"
            min="0.1"
            max="120"
            step="0.1"
            value={hz}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value >= 0.1 && value <= 120) {
                console.log('[DEBUG] 🎛️ Hz input changed to:', value);
                hzRef.current = value; // Update ref immediately so loop uses new value
                setHz(value);
              }
            }}
            style={{ width: '60px' }}
          />
          <span>{hz.toFixed(1)} Hz</span>
        </label>
      </div>

      {/* Camera Preview and 3D Fixture */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* Camera Preview */}
        <div style={{
          border: '2px solid #00d4ff',
          borderRadius: '8px',
          padding: '0.5rem',
          background: 'rgba(0, 212, 255, 0.1)'
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#00d4ff' }}>
            Camera Preview
          </div>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000', borderRadius: '4px', overflow: 'hidden' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            />
          </div>
        </div>

        {/* 3D Fixture Model */}
        <div style={{
          border: '2px solid #9b59b6',
          borderRadius: '8px',
          padding: '0.5rem',
          background: 'rgba(155, 89, 182, 0.1)'
        }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#9b59b6' }}>
            3D Fixture Model
          </div>
          {state.isRunning ? (
            <div style={{ width: '100%', aspectRatio: '1/1', minHeight: '300px' }}>
              <Fixture3DModel
                panValue={state.pan}
                tiltValue={state.tilt}
                rgbColor={{ r: 255, g: 200, b: 100 }}
                width={400}
                height={400}
              />
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              aspectRatio: '1/1',
              minHeight: '300px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
              color: '#888'
            }}>
              <span>3D fixture model will appear when Face Tracker is enabled</span>
            </div>
          )}
        </div>
      </div>

      {/* DMX Channel Configuration */}
      <div style={{
        border: '2px solid #00d4ff',
        borderRadius: '8px',
        padding: '1rem',
        background: 'rgba(0, 212, 255, 0.1)',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#00d4ff', fontSize: '1.1rem', fontWeight: 'bold' }}>
          📡 DMX Channel Configuration
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#00d4ff' }}>
          Configure which DMX channels to send values to (0-511). Uncheck to disable a channel.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {/* Pan Channel */}
          <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dmxChannels.pan >= 0}
                onChange={(e) => setDmxChannels(prev => ({ ...prev, pan: e.target.checked ? prev.pan >= 0 ? prev.pan : 0 : -1 }))}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Pan Channel</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="range"
                min="0"
                max="511"
                value={dmxChannels.pan >= 0 ? dmxChannels.pan : 0}
                onChange={(e) => setDmxChannels(prev => ({ ...prev, pan: parseInt(e.target.value) }))}
                disabled={dmxChannels.pan < 0}
                style={{ flex: 1, cursor: dmxChannels.pan >= 0 ? 'pointer' : 'not-allowed', opacity: dmxChannels.pan >= 0 ? 1 : 0.5 }}
              />
              <span style={{
                fontSize: '0.9rem',
                color: dmxChannels.pan >= 0 ? '#00d4ff' : '#888',
                minWidth: '45px',
                textAlign: 'right',
                fontFamily: 'monospace'
              }}>
                {dmxChannels.pan >= 0 ? dmxChannels.pan : 'OFF'}
              </span>
            </div>
          </div>

          {/* Tilt Channel */}
          <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dmxChannels.tilt >= 0}
                onChange={(e) => setDmxChannels(prev => ({ ...prev, tilt: e.target.checked ? prev.tilt >= 0 ? prev.tilt : 1 : -1 }))}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Tilt Channel</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="range"
                min="0"
                max="511"
                value={dmxChannels.tilt >= 0 ? dmxChannels.tilt : 0}
                onChange={(e) => setDmxChannels(prev => ({ ...prev, tilt: parseInt(e.target.value) }))}
                disabled={dmxChannels.tilt < 0}
                style={{ flex: 1, cursor: dmxChannels.tilt >= 0 ? 'pointer' : 'not-allowed', opacity: dmxChannels.tilt >= 0 ? 1 : 0.5 }}
              />
              <span style={{
                fontSize: '0.9rem',
                color: dmxChannels.tilt >= 0 ? '#00d4ff' : '#888',
                minWidth: '45px',
                textAlign: 'right',
                fontFamily: 'monospace'
              }}>
                {dmxChannels.tilt >= 0 ? dmxChannels.tilt : 'OFF'}
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Feature Flags - Debug Section */}
      <div style={{
        border: '2px solid #ff6b6b',
        borderRadius: '8px',
        padding: '1rem',
        background: 'rgba(255, 107, 107, 0.1)',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b', fontSize: '1.1rem', fontWeight: 'bold' }}>
          🔧 Feature Flags (Debug Mode)
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#ff6b6b' }}>
          Enable features one by one to isolate crashes. Start with all disabled, then enable one at a time.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={featureFlags.enableFaceTracking}
              onChange={(e) => {
                const newValue = e.target.checked;
                console.log('[DEBUG] 🔄 Face tracking feature flag changed to:', newValue);
                setFeatureFlags(prev => ({ ...prev, enableFaceTracking: newValue }));
              }}
              title="Enable basic face tracking (pan/tilt). This is the core feature."
            />
            <span style={{ fontWeight: featureFlags.enableFaceTracking ? 'bold' : 'normal', color: featureFlags.enableFaceTracking ? '#fff' : '#888' }}>
              Enable Face Tracking (Pan/Tilt) {featureFlags.enableFaceTracking ? '✅' : '❌'}
            </span>
          </label>
          {!featureFlags.enableFaceTracking && (
            <div style={{ fontSize: '0.85rem', color: '#ff9800', padding: '0.5rem', background: 'rgba(255, 152, 0, 0.1)', borderRadius: '4px' }}>
              ⚠️ Face tracking is DISABLED. Pan/tilt values will not be calculated or sent to DMX.
            </div>
          )}
        </div>
      </div>

      {/* Tracking Settings Section */}
      <div style={{
        border: '2px solid #00d4ff',
        borderRadius: '8px',
        padding: '1rem',
        background: 'rgba(0, 212, 255, 0.1)',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#00d4ff', fontSize: '1.1rem', fontWeight: 'bold' }}>
          🎯 Tracking Settings
        </h3>

        {/* Pan Sensitivity */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            Pan Sensitivity: {settings.panSensitivity.toFixed(1)}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.panSensitivity}
              onChange={(e) => setSettings(prev => ({ ...prev, panSensitivity: parseFloat(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={settings.panSensitivity.toFixed(1)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) setSettings(prev => ({ ...prev, panSensitivity: value }));
              }}
              style={{ width: '60px' }}
            />
          </div>
        </div>

        {/* Tilt Sensitivity */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            Tilt Sensitivity: {settings.tiltSensitivity.toFixed(1)}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.tiltSensitivity}
              onChange={(e) => setSettings(prev => ({ ...prev, tiltSensitivity: parseFloat(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={settings.tiltSensitivity.toFixed(1)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) setSettings(prev => ({ ...prev, tiltSensitivity: value }));
              }}
              style={{ width: '60px' }}
            />
          </div>
        </div>

        {/* Smoothing Factor */}
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#00d4ff', fontSize: '0.9rem', fontWeight: 'bold' }}>
            🌊 Smoothing Factor: {settings.smoothingFactor.toFixed(2)}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.smoothingFactor}
              onChange={(e) => setSettings(prev => ({ ...prev, smoothingFactor: parseFloat(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={settings.smoothingFactor.toFixed(2)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) setSettings(prev => ({ ...prev, smoothingFactor: value }));
              }}
              style={{ width: '60px' }}
            />
          </div>
        </div>

        {/* Cutoff */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            Cutoff (Dead Zone): {settings.cutoff.toFixed(2)}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.cutoff}
              onChange={(e) => setSettings(prev => ({ ...prev, cutoff: parseFloat(e.target.value) }))}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.cutoff.toFixed(2)}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) setSettings(prev => ({ ...prev, cutoff: value }));
              }}
              style={{ width: '60px' }}
            />
          </div>
        </div>

        {/* Flip Pan/Tilt */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.flipPan}
              onChange={(e) => setSettings(prev => ({ ...prev, flipPan: e.target.checked }))}
            />
            <span style={{ fontSize: '0.9rem' }}>Flip Pan Direction</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.flipTilt}
              onChange={(e) => setSettings(prev => ({ ...prev, flipTilt: e.target.checked }))}
            />
            <span style={{ fontSize: '0.9rem' }}>Flip Tilt Direction</span>
          </label>
        </div>

        {/* Set to Center Button */}
        <button
          onClick={setToCenter}
          disabled={!state.isRunning || !state.faceDetected}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            background: (!state.isRunning || !state.faceDetected) ? '#666' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (!state.isRunning || !state.faceDetected) ? 'not-allowed' : 'pointer',
            opacity: (!state.isRunning || !state.faceDetected) ? 0.5 : 1
          }}
        >
          🎯 SET TO CENTER
        </button>
      </div>

      {/* Range Limits Section */}
      <div style={{
        border: '2px solid #9b59b6',
        borderRadius: '8px',
        padding: '1rem',
        background: 'rgba(155, 89, 182, 0.1)',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#9b59b6', fontSize: '1.1rem', fontWeight: 'bold' }}>
          📊 Range Limits
        </h3>

        {/* Pan Min/Max */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            Pan Range: {settings.panMin} - {settings.panMax}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Min: {settings.panMin}</label>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={settings.panMin}
                onChange={(e) => setSettings(prev => ({ ...prev, panMin: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Max: {settings.panMax}</label>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={settings.panMax}
                onChange={(e) => setSettings(prev => ({ ...prev, panMax: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Tilt Min/Max */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#fff', fontSize: '0.9rem' }}>
            Tilt Range: {settings.tiltMin} - {settings.tiltMax}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Min: {settings.tiltMin}</label>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={settings.tiltMin}
                onChange={(e) => setSettings(prev => ({ ...prev, tiltMin: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#aaa' }}>Max: {settings.tiltMax}</label>
              <input
                type="range"
                min="0"
                max="255"
                step="1"
                value={settings.tiltMax}
                onChange={(e) => setSettings(prev => ({ ...prev, tiltMax: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>



      {/* Debug Info */}
      <div style={{
        padding: '1rem',
        background: 'rgba(0,0,0,0.5)',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '0.9rem'
      }}>
        <h3 style={{ marginTop: 0, color: '#00d4ff' }}>Debug Info</h3>
        <div>isRunning (state): {state.isRunning ? 'true' : 'false'}</div>
        <div>isRunning (ref): {isRunningRef.current ? 'true' : 'false'}</div>
        <div>RAF ID: {rafIdRef.current || 'none'}</div>
        <div>Loop Count (ref): {loopCountRef.current}</div>
        <div>Loop Count (state): {state.loopIterations}</div>
        <div>Detection Count: {detectionCountRef.current}</div>
        <div>Socket Connected: {connected ? 'true' : 'false'}</div>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,212,255,0.1)', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, color: '#00d4ff' }}>What to Look For:</h3>
        <ul style={{ margin: 0 }}>
          <li>✅ "Loop Iterations" should be increasing continuously (updates every second)</li>
          <li>✅ Console should show "🔄 Loop iteration #60, #120, #180..." every second</li>
          <li>✅ Console should show "🔍 RUNNING DETECTION" at your Hz rate</li>
          <li>✅ "Detections Run" should increase when faces are found</li>
          <li>❌ If "Loop Iterations" is 0 or not increasing = RAF loop not running</li>
          <li>❌ If isRunning keeps toggling = something is changing state repeatedly</li>
        </ul>
      </div>
    </div>
  );
};

// Backward compatibility export alias
export const FaceTrackerDebug = OpenCVVisageTrackerExperimental;

declare global {
  interface Window {
    cv: any;
  }
}

