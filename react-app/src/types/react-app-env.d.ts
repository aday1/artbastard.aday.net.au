/// <reference types="react" />
/// <reference types="react-dom" />

// Ensure react-dom/client is properly typed
declare module 'react-dom/client' {
  import * as React from 'react';
  
  export interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  
  export function createRoot(
    container: Element | DocumentFragment,
    options?: { hydrate?: boolean }
  ): Root;
}

// Add proper types for our context hooks
declare module '../../context/ThemeContext' {
  type Theme = 'artsnob' | 'standard' | 'minimal';

  export interface ThemeContextType {
    theme: Theme;
    darkMode: boolean;
    toggleTheme: (theme: Theme) => void;
    toggleDarkMode: () => void;
  }

  export const useTheme: () => ThemeContextType;
  export const ThemeProvider: React.FC<{ children: React.ReactNode }>;
}

declare module '../../context/SocketContext' {
  import { Socket } from 'socket.io-client';

  export interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
  }

  export const useSocket: () => SocketContextType;
  export const SocketProvider: React.FC<{ children: React.ReactNode }>;
}