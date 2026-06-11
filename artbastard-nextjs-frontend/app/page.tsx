"use client";

import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface HealthData {
  serverStatus?: string;
  socketConnections?: number;
  uptime?: number;
  [key: string]: any;
}

interface ClockState {
  bpm: number;
  source: string;
  playing: boolean;
  beat: number;
  bar: number;
  [key: string]: any;
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [lastClockUpdate, setLastClockUpdate] = useState<ClockState | null>(null);
  const [midiInterfaces, setMidiInterfaces] = useState<any[]>([]);

  useEffect(() => {
    // Test API proxy
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API request failed with status ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then(setHealth)
      .catch((err) => {
        console.error("API fetch error:", err);
        setError(err.message);
      });

    // Test Socket.IO proxy
    // Ensure this path matches the server-side path if it's custom
    const socket: Socket = io({ path: '/socket.io/' });

    socket.on('connect', () => {
      setSocketConnected(true);
      setSocketId(socket.id || 'N/A');
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setSocketConnected(false);
      setSocketId(null);
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setError(`Socket connection error: ${err.message}`);
    });

    socket.on('masterClockUpdate', (data: ClockState) => {
      console.log('Received masterClockUpdate:', data);
      setLastClockUpdate(data);
    });

    socket.on('midiInterfaces', (data: any[]) => {
      console.log('Received midiInterfaces:', data);
      setMidiInterfaces(data);
    });

    // Example: request MIDI interfaces explicitly if needed
    // socket.emit('getMidiInterfaces');

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>ArtBastard NEXT - Test Page</h1>

      <h2>API Health Check (/api/health)</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {health ? (
        <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      ) : (
        <p>Loading health data...</p>
      )}

      <h2>Socket.IO Connection</h2>
      <p>Status: {socketConnected ? `Connected (ID: ${socketId})` : 'Disconnected'}</p>

      <h3>Last Master Clock Update:</h3>
      {lastClockUpdate ? (
        <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
          {JSON.stringify(lastClockUpdate, null, 2)}
        </pre>
      ) : (
        <p>Waiting for clock update...</p>
      )}

      <h3>Detected MIDI Interfaces:</h3>
      {midiInterfaces.length > 0 ? (
        <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
          {JSON.stringify(midiInterfaces, null, 2)}
        </pre>
      ) : (
        <p>No MIDI interfaces reported or waiting for data...</p>
      )}
    </div>
  );
}
