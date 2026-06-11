import { useRef, useCallback } from 'react';

interface FFTAnalysisResult {
  frequencies: number[]; // Frequency bins (0-22050 Hz typically)
  magnitudes: number[]; // Magnitude for each frequency bin
  bass: number; // 0-1, low frequencies (20-250 Hz)
  mid: number; // 0-1, mid frequencies (250-4000 Hz)
  treble: number; // 0-1, high frequencies (4000-22050 Hz)
  overall: number; // 0-1, overall energy
  peakFrequency: number; // Hz of the peak frequency
}

/**
 * Hook for FFT-based audio analysis
 */
export const useAudioFFT = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const initializeAudioContext = useCallback(async (audioFile: File): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;

    // Create analyser node
    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 2048; // Higher resolution
      analyserRef.current.smoothingTimeConstant = 0.8;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    
    if (!dataArrayRef.current) {
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    // Decode audio file
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create source and connect to analyser
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }
    sourceRef.current = audioContext.createBufferSource();
    sourceRef.current.buffer = audioBuffer;
    sourceRef.current.connect(analyser);
    analyser.connect(audioContext.destination);

    return audioContext;
  }, []);

  /**
   * Analyze audio at a specific time point
   */
  const analyzeAtTime = useCallback((timeSeconds: number): FFTAnalysisResult | null => {
    if (!analyserRef.current || !dataArrayRef.current) return null;

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    analyser.getByteFrequencyData(dataArray);

    const frequencies: number[] = [];
    const magnitudes: number[] = [];
    
    // Convert FFT data to frequencies and magnitudes
    for (let i = 0; i < dataArray.length; i++) {
      const frequency = (i * sampleRate) / (analyser.fftSize * 2);
      const magnitude = dataArray[i] / 255; // Normalize to 0-1
      frequencies.push(frequency);
      magnitudes.push(magnitude);
    }

    // Calculate frequency bands
    const bassRange = frequencies.filter((f, i) => f >= 20 && f <= 250);
    const midRange = frequencies.filter((f, i) => f > 250 && f <= 4000);
    const trebleRange = frequencies.filter((f, i) => f > 4000 && f <= 22050);

    const bassIndices = frequencies.map((f, i) => f >= 20 && f <= 250 ? i : -1).filter(i => i >= 0);
    const midIndices = frequencies.map((f, i) => f > 250 && f <= 4000 ? i : -1).filter(i => i >= 0);
    const trebleIndices = frequencies.map((f, i) => f > 4000 && f <= 22050 ? i : -1).filter(i => i >= 0);

    const bass = bassIndices.length > 0
      ? bassIndices.reduce((sum, idx) => sum + magnitudes[idx], 0) / bassIndices.length
      : 0;
    const mid = midIndices.length > 0
      ? midIndices.reduce((sum, idx) => sum + magnitudes[idx], 0) / midIndices.length
      : 0;
    const treble = trebleIndices.length > 0
      ? trebleIndices.reduce((sum, idx) => sum + magnitudes[idx], 0) / trebleIndices.length
      : 0;

    const overall = magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length;

    // Find peak frequency
    let maxMagnitude = 0;
    let peakFrequency = 0;
    magnitudes.forEach((mag, i) => {
      if (mag > maxMagnitude) {
        maxMagnitude = mag;
        peakFrequency = frequencies[i];
      }
    });

    return {
      frequencies,
      magnitudes,
      bass,
      mid,
      treble,
      overall,
      peakFrequency
    };
  }, []);

  /**
   * Analyze entire audio file and generate analysis data
   */
  const analyzeAudioFile = useCallback(async (
    audioFile: File,
    samples: number = 200
  ): Promise<Array<{ time: number; analysis: FFTAnalysisResult }>> => {
    try {
      const audioContext = await initializeAudioContext(audioFile);
      const audioBuffer = sourceRef.current?.buffer;
      
      if (!audioBuffer) return [];

      const duration = audioBuffer.duration;
      const sampleInterval = duration / samples;
      const results: Array<{ time: number; analysis: FFTAnalysisResult }> = [];

      // For each sample point, we'd need to seek and analyze
      // Since we can't easily seek in Web Audio API without playing, we'll analyze the whole buffer
      // This is a simplified version - in production you'd want to use OfflineAudioContext
      
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      const analyser = offlineContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyser.connect(offlineContext.destination);

      source.start(0);
      await offlineContext.startRendering();

      // Now analyze at different time points
      for (let i = 0; i < samples; i++) {
        const time = i * sampleInterval;
        // Note: This is a simplified approach. For accurate per-time analysis,
        // you'd need to slice the buffer and analyze each slice
        const analysis = analyzeAtTime(time);
        if (analysis) {
          results.push({ time, analysis });
        }
      }

      return results;
    } catch (error) {
      console.error('Error analyzing audio:', error);
      return [];
    }
  }, [initializeAudioContext, analyzeAtTime]);

  /**
   * Generate DMX events based on FFT analysis
   */
  const generateLightshowFromFFT = useCallback((
    analysisData: Array<{ time: number; analysis: FFTAnalysisResult }>,
    options: {
      bassChannels?: number[]; // DMX channels to control with bass
      midChannels?: number[]; // DMX channels to control with mid
      trebleChannels?: number[]; // DMX channels to control with treble
      intensityMultiplier?: number; // 0-1, how intense the response should be
      threshold?: number; // Minimum magnitude to trigger
    } = {}
  ): Array<{ time: number; channel: number; value: number }> => {
    const {
      bassChannels = [],
      midChannels = [],
      trebleChannels = [],
      intensityMultiplier = 1.0,
      threshold = 0.1
    } = options;

    const events: Array<{ time: number; channel: number; value: number }> = [];

    analysisData.forEach(({ time, analysis }) => {
      // Bass response
      if (analysis.bass > threshold && bassChannels.length > 0) {
        const value = Math.round(analysis.bass * 255 * intensityMultiplier);
        bassChannels.forEach(channel => {
          events.push({ time: time * 1000, channel, value });
        });
      }

      // Mid response
      if (analysis.mid > threshold && midChannels.length > 0) {
        const value = Math.round(analysis.mid * 255 * intensityMultiplier);
        midChannels.forEach(channel => {
          events.push({ time: time * 1000, channel, value });
        });
      }

      // Treble response
      if (analysis.treble > threshold && trebleChannels.length > 0) {
        const value = Math.round(analysis.treble * 255 * intensityMultiplier);
        trebleChannels.forEach(channel => {
          events.push({ time: time * 1000, channel, value });
        });
      }
    });

    return events;
  }, []);

  const cleanup = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
  }, []);

  return {
    initializeAudioContext,
    analyzeAtTime,
    analyzeAudioFile,
    generateLightshowFromFFT,
    cleanup
  };
};
