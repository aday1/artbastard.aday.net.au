import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useStore } from '../store';

/** Reload shared appearance when another client saves theme settings. */
export function useAppearanceSync(): void {
  const { socket } = useSocket();
  const loadAppearanceFromServer = useStore((s) => s.loadAppearanceFromServer);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => {
      void loadAppearanceFromServer();
    };
    socket.on('appearanceUpdated', onUpdate);
    return () => {
      socket.off('appearanceUpdated', onUpdate);
    };
  }, [socket, loadAppearanceFromServer]);
}
