export function sceneNameToOscPath(name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '_');
  return `/scene/${slug || 'new'}`;
}

export const captureChannelValues = (
  getDmxChannelValue: (channel: number) => number,
  channelCount: number = 512
): number[] => {
  const channelValues = new Array(channelCount).fill(0);

  for (let i = 0; i < channelCount; i++) {
    const value = getDmxChannelValue(i);
    if (value > 0) {
      channelValues[i] = value;
    }
  }

  return channelValues;
};
