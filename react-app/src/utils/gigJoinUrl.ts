export function normalizeGigSessionId(sessionId: string): string {
  return sessionId.trim().slice(0, 64) || 'default';
}

/** Scan to open ArtBastard on this show session (sets session via query param). */
export function buildArtbastardGigJoinUrl(sessionId: string): string {
  const sid = encodeURIComponent(normalizeGigSessionId(sessionId));
  return `${window.location.origin}/?sessionId=${sid}`;
}

export function readSessionIdFromUrl(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('sessionId');
    if (fromUrl && fromUrl.trim()) return normalizeGigSessionId(fromUrl);
  } catch {
    /* ignore */
  }
  return null;
}

export function persistSessionIdFromUrl(): string | null {
  const sid = readSessionIdFromUrl();
  if (!sid) return null;
  try {
    localStorage.setItem('artbastard-session-id', sid);
  } catch {
    /* ignore */
  }
  return sid;
}
