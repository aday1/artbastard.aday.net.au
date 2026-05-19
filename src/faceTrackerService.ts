/**
 * Face Tracker Service - Node.js wrapper for C++ face tracker backend
 * This provides an optional faster backend using the C++ implementation
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { log } from './logger';

export interface FaceTrackerConfig {
  cameraIndex: number;
  updateRate: number;
  panSensitivity: number;
  tiltSensitivity: number;
  panOffset: number;
  tiltOffset: number;
  smoothingFactor: number;
  maxVelocity: number;
  brightness: number;
  contrast: number;
  cameraExposure: number;
  cameraBrightness: number;
  autoExposure: boolean;
  panChannel: number;
  tiltChannel: number;
  panMin: number;
  panMax: number;
  tiltMin: number;
  tiltMax: number;
}

export class FaceTrackerService {
  private process: ChildProcess | null = null;
  private configPath: string;
  private isRunning: boolean = false;
  private onFrameCallback?: (frame: Buffer) => void;
  private onFaceDetectedCallback?: (pan: number, tilt: number) => void;

  constructor() {
    this.configPath = path.join(__dirname, '..', 'face-tracker', 'face-tracker-config.json');
  }

  /**
   * Check if C++ face tracker binary exists
   */
  static isAvailable(): boolean {
    const binaryPath = path.join(__dirname, '..', 'face-tracker', 'build', 'bin', 'face-tracker');
    return fs.existsSync(binaryPath);
  }

  /**
   * Start the face tracker process
   */
  async start(config: Partial<FaceTrackerConfig> = {}): Promise<void> {
    if (this.isRunning) {
      throw new Error('Face tracker is already running');
    }

    if (!FaceTrackerService.isAvailable()) {
      throw new Error('C++ face tracker binary not found. Please build it first.');
    }

    // Update config file
    await this.updateConfig(config);

    const binaryPath = path.join(__dirname, '..', 'face-tracker', 'build', 'bin', 'face-tracker');
    const workingDir = path.dirname(binaryPath);

    this.process = spawn(binaryPath, [], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      log(`Face Tracker: ${output}`, 'FACE_TRACKER');
      
      // Parse DMX updates from output
      const dmxMatch = output.match(/Pan:\s*(\d+),\s*Tilt:\s*(\d+)/);
      if (dmxMatch && this.onFaceDetectedCallback) {
        const pan = parseInt(dmxMatch[1]);
        const tilt = parseInt(dmxMatch[2]);
        this.onFaceDetectedCallback(pan, tilt);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      log(`Face Tracker Error: ${error}`, 'ERROR');
    });

    this.process.on('exit', (code) => {
      log(`Face Tracker exited with code ${code}`, 'FACE_TRACKER');
      this.isRunning = false;
      this.process = null;
    });

    this.isRunning = true;
    log('Face Tracker service started', 'FACE_TRACKER');
  }

  /**
   * Stop the face tracker process
   */
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.isRunning = false;
      log('Face Tracker service stopped', 'FACE_TRACKER');
    }
  }

  /**
   * Update configuration file
   */
  private async updateConfig(config: Partial<FaceTrackerConfig>): Promise<void> {
    let currentConfig: any = {};
    
    if (fs.existsSync(this.configPath)) {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      currentConfig = JSON.parse(content);
    }

    // Merge with defaults
    const defaultConfig: FaceTrackerConfig = {
      cameraIndex: 0,
      updateRate: 30,
      panSensitivity: 1.0,
      tiltSensitivity: 1.0,
      panOffset: 128,
      tiltOffset: 128,
      smoothingFactor: 0.85,
      maxVelocity: 5.0,
      brightness: 1.0,
      contrast: 1.0,
      cameraExposure: -1,
      cameraBrightness: -1,
      autoExposure: true,
      panChannel: 1,
      tiltChannel: 2,
      panMin: 0,
      panMax: 255,
      tiltMin: 0,
      tiltMax: 255,
    };

    const mergedConfig = { ...defaultConfig, ...currentConfig, ...config };

    // Ensure directory exists
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write config file
    fs.writeFileSync(this.configPath, JSON.stringify(mergedConfig, null, 2));
  }

  /**
   * Set callback for face detection events
   */
  onFaceDetected(callback: (pan: number, tilt: number) => void): void {
    this.onFaceDetectedCallback = callback;
  }

  /**
   * Set callback for video frames (if supported)
   */
  onFrame(callback: (frame: Buffer) => void): void {
    this.onFrameCallback = callback;
  }

  /**
   * Get current status
   */
  getStatus(): { running: boolean; available: boolean } {
    return {
      running: this.isRunning,
      available: FaceTrackerService.isAvailable(),
    };
  }
}

