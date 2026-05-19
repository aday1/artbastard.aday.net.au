import React from 'react';
import { useStore } from '../../store';
import { DmxFaderRow } from '../ui/controls';
import styles from './SelectedChannelsFaderStrip.module.scss';

interface SelectedChannelsFaderStripProps {
  maxVisible?: number;
}

export const SelectedChannelsFaderStrip: React.FC<SelectedChannelsFaderStripProps> = ({
  maxVisible = 8,
}) => {
  const selectedChannels = useStore((s) => s.selectedChannels);
  const getDmxChannelValue = useStore((s) => s.getDmxChannelValue);
  const setDmxChannelValue = useStore((s) => s.setDmxChannelValue);
  const channelNames = useStore((s) => s.channelNames);
  const getChannelInfo = useStore((s) => s.getChannelInfo);

  if (selectedChannels.length === 0) {
    return (
      <div className={styles.strip}>
        <p className={styles.hint}>
          Pin channels from DMX Control (pin icon on a channel), or switch to Fixtures and tap fixtures to
          control them here.
        </p>
      </div>
    );
  }

  const visible = selectedChannels.slice(0, maxVisible);
  const overflow = selectedChannels.length - visible.length;

  return (
    <div className={styles.strip}>
      <div className={styles.header}>
        <span className={styles.title}>Pinned channels</span>
        {overflow > 0 && <span className={styles.overflow}>+{overflow} more on DMX page</span>}
      </div>
      <div className={styles.faders}>
        {visible.map((ch) => {
          const info = getChannelInfo(ch);
          const label =
            channelNames[ch] && channelNames[ch] !== `CH ${ch + 1}`
              ? channelNames[ch]
              : info?.channelName || `CH ${ch + 1}`;
          return (
            <div key={ch} className={styles.faderCell}>
              <DmxFaderRow
                compact
                className={styles.pinnedFader}
                label={label}
                controlName={`super-touch-ch-${ch}`}
                value={getDmxChannelValue(ch)}
                showOsc={false}
                showMidi={false}
                onChange={(v) => setDmxChannelValue(ch, Math.round(v))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectedChannelsFaderStrip;
