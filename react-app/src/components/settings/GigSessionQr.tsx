import React, { useCallback, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { buildArtbastardGigJoinUrl } from '../../utils/gigJoinUrl';
import styles from './GigSessionQr.module.scss';

interface GigSessionQrProps {
  sessionId: string;
}

export const GigSessionQr: React.FC<GigSessionQrProps> = ({ sessionId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joinUrl = buildArtbastardGigJoinUrl(sessionId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, joinUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
    }).catch(() => {});
  }, [joinUrl]);

  const copyUrl = useCallback(() => {
    navigator.clipboard?.writeText(joinUrl).catch(() => {});
  }, [joinUrl]);

  return (
    <div className={styles.gigQrBlock}>
      <span className={styles.gigQrLabel}>Scan to join this show session</span>
      <canvas ref={canvasRef} className={styles.gigQrCanvas} width={180} height={180} />
      <span className={styles.gigQrUrl}>{joinUrl}</span>
      <button type="button" className={styles.gigQrCopy} onClick={copyUrl}>
        Copy link
      </button>
    </div>
  );
};
