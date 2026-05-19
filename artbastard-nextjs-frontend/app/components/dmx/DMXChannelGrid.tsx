"use client";

import React, { useEffect } from 'react';
import { useDmxStore } from '../../store/dmxStore';
import ChannelFader from './ChannelFader';
import styles from './DMXChannelGrid.module.scss';
import { useSocketStore } from '../../store/socketStore'; // To trigger initial state load

const DMXChannelGrid: React.FC = () => {
  const { dmxValues, channelNames, fixtures, loadInitialState } = useDmxStore(state => ({
    dmxValues: state.dmxValues,
    channelNames: state.channelNames,
    fixtures: state.fixtures,
    loadInitialState: state.loadInitialState,
  }));

  const socket = useSocketStore(state => state.socket);

  useEffect(() => {
    // Fetch initial state when component mounts
    const fetchInitialState = async () => {
      try {
        const response = await fetch('/api/state');
        if (!response.ok) {
          throw new Error(`Failed to fetch initial state: ${response.status}`);
        }
        const data = await response.json();
        // Assuming data structure from /api/state matches what dmxStore needs
        // console.log("Fetched initial state:", data);
        loadInitialState({
          dmxValues: data.dmxChannels, // Ensure field names match
          channelNames: data.channelNames,
          fixtures: data.fixtures,
          // selectedChannels: data.selectedChannels // if available
        });
      } catch (error) {
        console.error("Error fetching initial state:", error);
      }
    };

    fetchInitialState();

    // Setup Socket.IO listener for DMX updates from server (if any)
    // This is important if other clients can change DMX values
    // Or if backend processes (like scenes, autopilot) change values
    if (socket) {
      const handleDmxBroadcast = (updatedChannels: Record<number, number>) => {
        // console.log('Received DMX broadcast from server:', updatedChannels);
        for (const chStr in updatedChannels) {
          const channelIndex = parseInt(chStr, 10);
          const value = updatedChannels[chStr];
          // Update store without sending back to server to avoid loops
          useDmxStore.getState().setDmxValue(channelIndex, value, false);
        }
      };

      // Example event name, adjust to actual server event
      socket.on('dmxUpdateBatch', handleDmxBroadcast);
      // Or if individual updates:
      // socket.on('dmxUpdateSingle', ({ channel, value }) => { ... });

      return () => {
        socket.off('dmxUpdateBatch', handleDmxBroadcast);
        // socket.off('dmxUpdateSingle');
      };
    }

  }, [loadInitialState, socket]);

  if (!dmxValues || dmxValues.length === 0) {
    return <p className={styles.loadingMessage}>Loading DMX channels...</p>;
  }

  // For now, display all 512 channels. Pagination/filtering later.
  // Create a range of 0-511 for channel indices
  const channelIndices = Array.from({ length: 512 }, (_, i) => i);

  return (
    <div className={styles.dmxChannelGrid}>
      {channelIndices.map((index) => (
        <ChannelFader key={`channel-${index}`} channelIndex={index} />
      ))}
    </div>
  );
};

export default DMXChannelGrid;
