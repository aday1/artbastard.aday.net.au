import { useRef, useCallback } from 'react';

/**
 * Hook for generating waveform data from audio files
 */
export const useAudioWaveform = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const generateWaveform = useCallback(async (audioFile: File, samples: number = 200): Promise<number[]> => {
    try {
      // Create audio context if not exists
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;

      // Read file as array buffer
      const arrayBuffer = await audioFile.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Get channel data (use first channel)
      const channelData = audioBuffer.getChannelData(0);
      const dataLength = channelData.length;
      const blockSize = Math.floor(dataLength / samples);
      
      // Sample the audio data
      const waveform: number[] = [];
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        const start = i * blockSize;
        const end = Math.min(start + blockSize, dataLength);
        
        for (let j = start; j < end; j++) {
          sum += Math.abs(channelData[j]);
        }
        
        // Normalize to 0-1
        const average = sum / (end - start);
        waveform.push(average);
      }
      
      return waveform;
    } catch (error) {
      console.error('Error generating waveform:', error);
      // Return empty waveform on error
      return new Array(samples).fill(0);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  }, []);

  return { generateWaveform, cleanup };
};
