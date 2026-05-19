import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from '../pages/DmxChannelControlPage.module.scss';

interface DmxActiveChannelsSummaryProps {
  dmxChannels: number[];
  channelColors: Record<number, string>;
  channelNames: string[];
  onScrollToChannel: (channelIndex: number) => void;
  onChannelContextMenu?: (event: React.MouseEvent, channelIndex: number) => void;
}

export const DmxActiveChannelsSummary: React.FC<DmxActiveChannelsSummaryProps> = ({
  dmxChannels,
  channelColors,
  channelNames,
  onScrollToChannel,
  onChannelContextMenu,
}) => {
  const activeChannels = Array.from({ length: 512 }, (_, i) => i).filter(i => (dmxChannels[i] || 0) > 0);
  const activeChannelsSet = new Set(activeChannels);

  return (
    <div className={styles.sceneSection}>
      <h3 className={styles.sectionTitle}>
        <LucideIcon name="Zap" />
        Active Channels
        <span className={styles.activeCount}>({activeChannels.length})</span>
      </h3>
      <div className={styles.activeChannelsContainer}>
        <div className={styles.channelsGrid}>
          {Array.from({ length: 512 }, (_, i) => {
            const isActive = activeChannelsSet.has(i);
            const value = dmxChannels[i] || 0;
            const intensity = value / 255;
            const channelColor = channelColors[i] || '';
            const hasName = !!(channelNames[i] &&
              channelNames[i] !== `CH ${i + 1}` &&
              channelNames[i] !== `Channel ${i + 1}` &&
              channelNames[i].trim() !== '');

            const backgroundColor = channelColor
              ? channelColor
              : (isActive ? `hsl(${(i * 137.5) % 360}, 70%, ${50 + (intensity * 30)}%)` : 'transparent');

            return (
              <div
                key={i}
                className={`${styles.channelCell} ${isActive ? styles.active : ''} ${hasName ? styles.hasName : ''}`}
                style={{
                  opacity: isActive ? 0.3 + (intensity * 0.7) : (channelColor ? 0.2 : 0.1),
                  backgroundColor,
                  borderColor: hasName ? channelColor || '#10b981' : undefined,
                  borderWidth: hasName ? '2px' : undefined,
                }}
                title={`Channel ${i + 1}: ${value > 0 ? `${value} (${Math.round(intensity * 100)}%)` : 'Inactive'}${hasName ? ` - ${channelNames[i]}` : ''}`}
                onClick={() => onScrollToChannel(i)}
                onContextMenu={
                  onChannelContextMenu
                    ? (e) => onChannelContextMenu(e, i)
                    : undefined
                }
              >
                {isActive && (
                  <span className={styles.channelNumber}>{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        {activeChannels.length > 0 && (
          <div className={styles.channelsList}>
            <div className={styles.listHeader}>
              <span>Active Channel Numbers:</span>
              <span className={styles.channelCount}>{activeChannels.length} channels</span>
            </div>
            <div className={styles.channelTags}>
              {activeChannels.map((i) => {
                const value = dmxChannels[i] || 0;
                const intensity = value / 255;
                return (
                  <span
                    key={i}
                    className={styles.channelTag}
                    style={{
                      opacity: 0.7 + (intensity * 0.3),
                      backgroundColor: `hsl(${(i * 137.5) % 360}, 70%, ${50 + (intensity * 20)}%)`,
                      cursor: 'pointer'
                    }}
                    title={`CH ${i + 1}: ${value} (${Math.round(intensity * 100)}%) - Click to scroll to slider`}
                    onClick={() => onScrollToChannel(i)}
                  >
                    CH {i + 1}
                    <span className={styles.channelValue}>{value}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {activeChannels.length === 0 && (
          <div className={styles.noActiveChannels}>No active channels (Idle)</div>
        )}
      </div>
    </div>
  );
};
