import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  connect: () => {
    if (get().socket?.connected) return;

    // Ensure this path matches the server-side path and next.config.mjs proxy
    const newSocket = io({ path: '/socket.io/' });

    newSocket.on('connect', () => {
      console.log('Socket connected via store:', newSocket.id);
      set({ isConnected: true, socket: newSocket });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected via store:', reason);
      set({ isConnected: false, socket: null });
      // Optional: attempt to reconnect or notify user
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error via store:', err);
      set({ isConnected: false, socket: null });
      // Optional: attempt to reconnect or notify user
    });

    // Add any globally relevant listeners here if needed
    // For example, if the server can push a full state refresh:
    // newSocket.on('fullDmxState', (stateData) => {
    //   useDmxStore.getState().loadInitialState(stateData);
    // });

    set({ socket: newSocket }); // Set socket instance immediately
  },
  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, isConnected: false });
  },
}));
