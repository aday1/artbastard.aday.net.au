import React, { useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useStore } from '../../store';

/**
 * This component doesn't render anything but processes OSC messages
 * and converts them to DMX channel changes
 * It's global and persists across all pages
 */
export const OscDmxProcessor: React.FC = () => {
  const { socket } = useSocket();
  const { reportOscActivity } = useStore(state => ({
    reportOscActivity: state.reportOscActivity,
  }));

  useEffect(() => {
    if (!socket) return;

    const handleOscActivity = (data: { channelIndex: number; value: number }) => {
      console.log('[OscDmxProcessor] OSC activity received:', data);
      if (reportOscActivity) {
        reportOscActivity(data.channelIndex, data.value);
      }
    };

    socket.on('oscChannelActivity', handleOscActivity);

    return () => {
      socket.off('oscChannelActivity', handleOscActivity);
    };
  }, [socket, reportOscActivity]);

  return null; // This component doesn't render anything
};

export default OscDmxProcessor;
