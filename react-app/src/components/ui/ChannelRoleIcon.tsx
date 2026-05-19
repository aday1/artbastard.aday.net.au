import React from 'react';
import type { Fixture } from '../../store';
import { getFixtureInfoForChannel, getFixtureTypeIcon } from '../../utils/fixturePresentation';
import * as Icons from 'lucide-react';
import {
  getChannelRoleIconColor,
  getChannelRoleIconName,
} from '../../utils/channelRoleIcons';
import { LucideIcon } from './LucideIcon';
import styles from './ChannelRoleIcon.module.scss';

export interface ChannelRoleIconProps {
  channelIndex?: number;
  fixtures?: Fixture[];
  channelType?: string;
  fixtureType?: string;
  size?: number;
  /** Show a second icon for fixture profile (moving head, par, etc.). */
  showFixtureType?: boolean;
  className?: string;
  title?: string;
}

export const ChannelRoleIcon: React.FC<ChannelRoleIconProps> = ({
  channelIndex,
  fixtures,
  channelType: channelTypeProp,
  fixtureType: fixtureTypeProp,
  size = 14,
  showFixtureType = false,
  className,
  title,
}) => {
  const info =
    channelIndex !== undefined && fixtures
      ? getFixtureInfoForChannel(channelIndex, fixtures)
      : null;

  const channelType = channelTypeProp ?? info?.channelType;
  const fixtureType = fixtureTypeProp ?? info?.fixtureType;
  const roleIcon = info?.roleIcon ?? getChannelRoleIconName(channelType);
  const fixtureIcon =
    info?.fixtureTypeIcon ?? (fixtureType ? getFixtureTypeIcon(fixtureType) : undefined);
  const roleKey = roleIcon as keyof typeof Icons;
  const fixtureKey = fixtureIcon as keyof typeof Icons | undefined;
  const color = getChannelRoleIconColor(channelType);
  const tip =
    title ??
    (info
      ? `${info.fixtureName} - ${info.channelFunction}`
      : channelType
        ? `Channel role: ${channelType}`
        : 'Unassigned DMX channel');

  return (
    <span className={`${styles.wrap} ${className ?? ''}`} title={tip} aria-hidden>
      {showFixtureType && fixtureKey && fixtureKey !== roleKey && Icons[fixtureKey] && (
        <LucideIcon name={fixtureKey} size={size - 2} className={styles.fixture} />
      )}
      <LucideIcon name={roleKey} size={size} color={color} className={styles.role} />
    </span>
  );
};
