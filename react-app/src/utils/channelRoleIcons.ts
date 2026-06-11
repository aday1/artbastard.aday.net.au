import type { TrackerLaneId } from './trackerFixtureRoles';

/** Lucide icon names for DMX channel roles (fixture channel types). */
export type ChannelRoleIconName =
  | 'Move'
  | 'MoveVertical'
  | 'Sun'
  | 'SunDim'
  | 'Palette'
  | 'Disc'
  | 'RotateCw'
  | 'Zap'
  | 'Aperture'
  | 'Scan'
  | 'Crosshair'
  | 'Sparkles'
  | 'CloudFog'
  | 'Gauge'
  | 'Wand2'
  | 'Fan'
  | 'Monitor'
  | 'Settings2'
  | 'CircleDot'
  | 'Lightbulb'
  | 'Target'
  | 'Minus'
  | 'Cloud'
  | 'Flashlight';

function normType(channelType: string): string {
  return channelType.trim().toLowerCase().replace(/\s+/g, '_');
}

export function getChannelRoleIconName(channelType?: string): ChannelRoleIconName {
  if (!channelType) return 'CircleDot';
  const t = normType(channelType);
  if (t.includes('pan')) return 'Move';
  if (t.includes('tilt')) return 'MoveVertical';
  if (t === 'red' || t === 'green' || t === 'blue' || t === 'white' || t === 'amber' || t === 'uv' || t === 'lime' || t === 'cyan' || t === 'magenta') {
    return 'Palette';
  }
  if (t.includes('color_wheel') || t === 'color' || t.includes('cto') || t.includes('ctb') || t.includes('color_temperature')) {
    return 'Palette';
  }
  if (t.includes('gobo')) return t.includes('rot') ? 'RotateCw' : 'Disc';
  if (t === 'dimmer' || t === 'intensity' || t === 'master') return 'SunDim';
  if (t === 'strobe') return 'Zap';
  if (t === 'shutter') return 'Aperture';
  if (t === 'zoom') return 'Scan';
  if (t === 'focus' || t === 'iris') return 'Crosshair';
  if (t === 'prism') return 'Sparkles';
  if (t === 'frost' || t === 'diffusion') return 'CloudFog';
  if (t === 'speed' || t === 'animation_speed') return 'Gauge';
  if (t === 'macro' || t === 'effect' || t === 'animation') return 'Wand2';
  if (t === 'fan_control') return 'Fan';
  if (t === 'lamp_control') return 'Lightbulb';
  if (t === 'display') return 'Monitor';
  if (t === 'reset' || t === 'function') return 'Settings2';
  return 'CircleDot';
}

/** Accent color for RGB / role icons on dark UI. */
export function getChannelRoleIconColor(channelType?: string): string | undefined {
  if (!channelType) return undefined;
  const t = normType(channelType);
  if (t === 'red') return '#f87171';
  if (t === 'green') return '#4ade80';
  if (t === 'blue') return '#60a5fa';
  if (t === 'amber' || t === 'uv') return '#fbbf24';
  if (t === 'white') return '#f1f5f9';
  if (t.includes('pan') || t.includes('tilt')) return '#38bdf8';
  if (t.includes('gobo')) return '#fbbf24';
  if (t === 'dimmer' || t === 'intensity') return '#fde68a';
  if (t === 'strobe') return '#f472b6';
  if (t.includes('color')) return '#c084fc';
  return undefined;
}

const LANE_ICONS: Record<TrackerLaneId, ChannelRoleIconName> = {
  pan_tilt: 'Move',
  color_rgb: 'Palette',
  color_wheel: 'Palette',
  gobo: 'Disc',
  dimmer: 'SunDim',
  beam: 'Scan',
  fx: 'Zap',
  moving_head_all: 'Target',
};

export function getTrackerLaneIconName(laneId: TrackerLaneId): ChannelRoleIconName {
  return LANE_ICONS[laneId];
}
