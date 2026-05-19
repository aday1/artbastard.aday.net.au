"use client";

import React, { useEffect, ReactNode } from 'react';
import { useSocketStore } from '../store/socketStore';

interface SocketProviderProps {
  children: ReactNode;
}

const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const connectSocket = useSocketStore(state => state.connect);
  const disconnectSocket = useSocketStore(state => state.disconnect);
  const isConnected = useSocketStore(state => state.isConnected);
  const socket = useSocketStore(state => state.socket);

  useEffect(() => {
    if (!socket || !isConnected) {
        connectSocket();
    }

    // Cleanup on component unmount
    return () => {
      // Consider if global socket should disconnect on main layout unmount
      // For a SPA-like experience, you might want the socket to persist
      // across page navigations. Disconnecting here would mean it
      // reconnects on every layout mount.
      // If disconnect is desired:
      // disconnectSocket();
    };
  }, [connectSocket, disconnectSocket, isConnected, socket]);

  return <>{children}</>;
};

export default SocketProvider;
