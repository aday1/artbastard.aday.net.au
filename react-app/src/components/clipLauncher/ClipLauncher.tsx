import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { useClipLauncherStore, ClipCell } from '../../store/clipLauncherStore';
import { ClipCell as ClipCellComponent } from './ClipCell';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ClipLauncher.module.scss';

export const ClipLauncher: React.FC = () => {
  const { scenes, saveScene, loadScene } = useStore();
  const {
    gridSize,
    clips,
    playingClips,
    queuedClips,
    recordingClip,
    setGridSize,
    setClip,
    clearClip,
    launchClip,
    stopClip,
    stopAllClips,
    toggleLoop,
    setRecordingClip,
    queueClip
  } = useClipLauncherStore();

  const [selectedCell, setSelectedCell] = useState<{ row: number; column: number } | null>(null);
  const [showSceneSelector, setShowSceneSelector] = useState(false);

  // Initialize grid on mount
  useEffect(() => {
    if (clips.length === 0) {
      setGridSize({ rows: 4, columns: 4 });
    }
  }, []);

  // Keyboard shortcuts for clip launching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Space: Stop all clips
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        stopAllClips();
        return;
      }

      // Number keys 1-9: Launch clips in first row (1-9) or use row/column mapping
      // For 4x4 grid: 1-4 = row 0, 5-8 = row 1, etc.
      // For 8x8 grid: 1-8 = row 0, etc.
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
        const keyNum = parseInt(e.key, 10) - 1; // 0-8
        const row = Math.floor(keyNum / gridSize.columns);
        const column = keyNum % gridSize.columns;
        
        if (row < gridSize.rows && column < gridSize.columns) {
          e.preventDefault();
          const clip = clips[row]?.[column];
          if (clip?.sceneName) {
            launchClip(row, column);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridSize, clips, launchClip, stopAllClips]);

  // Sync clips with scenes
  useEffect(() => {
    const updatedClips = clips.map(row =>
      row.map(cell => {
        if (cell.sceneName) {
          const scene = scenes.find(s => s.name === cell.sceneName);
          if (scene) {
            return { ...cell, scene };
          }
        }
        return cell;
      })
    );
    // Only update if there are changes
    if (JSON.stringify(updatedClips) !== JSON.stringify(clips)) {
      // This would need a bulk update method, for now we'll handle it per-cell
    }
  }, [scenes, clips]);

  const handleCellClick = (row: number, column: number) => {
    const clip = clips[row]?.[column];
    if (!clip) return;

    if (clip.sceneName) {
      launchClip(row, column);
    } else {
      // Show scene selector for empty cell
      setSelectedCell({ row, column });
      setShowSceneSelector(true);
    }
  };

  const handleCellDoubleClick = (row: number, column: number) => {
    const clip = clips[row]?.[column];
    if (clip?.sceneName) {
      // Load scene for editing
      loadScene(clip.sceneName);
    }
  };

  const handleRecord = (row: number, column: number) => {
    const clip = clips[row]?.[column];
    if (!clip) return;

    // If clip already has a scene, update it; otherwise create new
    const sceneName = clip.sceneName || `Scene ${row + 1}-${column + 1}`;
    const oscAddress = `/scene/${sceneName.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Save current DMX state as scene
    saveScene(sceneName, oscAddress);
    
    // Update clip with new scene
    const updatedScene = scenes.find(s => s.name === sceneName) || { name: sceneName, channelValues: [], oscAddress };
    setClip(row, column, {
      sceneName,
      scene: updatedScene as any,
      color: getScenePreview(sceneName).color
    });
    
    setRecordingClip(null);
  };

  const handleAssignScene = (sceneName: string) => {
    if (selectedCell) {
      const scene = scenes.find(s => s.name === sceneName);
      setClip(selectedCell.row, selectedCell.column, {
        sceneName,
        scene: scene || null,
        color: scene ? '#3b82f6' : '#64748b'
      });
      setShowSceneSelector(false);
      setSelectedCell(null);
    }
  };

  const getScenePreview = (sceneName: string) => {
    const scene = scenes.find(s => s.name === sceneName);
    if (!scene) return { color: '#64748b' };

    // Generate color from scene's channel values
    // Simple heuristic: average RGB values if available
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < Math.min(scene.channelValues.length, 512); i += 3) {
      if (i + 2 < scene.channelValues.length) {
        r += scene.channelValues[i] || 0;
        g += scene.channelValues[i + 1] || 0;
        b += scene.channelValues[i + 2] || 0;
        count++;
      }
    }
    if (count > 0) {
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      return { color: `rgb(${r}, ${g}, ${b})` };
    }

    return { color: '#3b82f6' };
  };

  return (
    <div className={styles.clipLauncher}>
      <div className={styles.launcherHeader}>
        <h3>
          <LucideIcon name="Grid" />
          Clip Launcher
        </h3>
        <div className={styles.headerControls}>
          <button
            className={styles.stopAllButton}
            onClick={stopAllClips}
            title="Stop All (Space)"
          >
            <LucideIcon name="Square" size={16} />
            Stop All
          </button>
          <div className={styles.gridSizeControl}>
            <label>
              Grid:
              <select
                value={`${gridSize.rows}x${gridSize.columns}`}
                onChange={(e) => {
                  const [rows, cols] = e.target.value.split('x').map(Number);
                  setGridSize({ rows, columns: cols });
                }}
              >
                <option value="4x4">4x4</option>
                <option value="4x8">4x8</option>
                <option value="8x4">8x4</option>
                <option value="8x8">8x8</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className={styles.clipGrid}>
        {Array.from({ length: gridSize.rows }).map((_, row) => (
          <div key={row} className={styles.clipRow} data-columns={gridSize.columns}>
            {Array.from({ length: gridSize.columns }).map((_, column) => {
              const clip = clips[row]?.[column] || {
                id: `clip-${row}-${column}`,
                sceneName: null,
                scene: null,
                loop: false,
                followAction: 'stop' as const,
                color: '#64748b',
                row,
                column
              };

              return (
                <ClipCellComponent
                  key={clip.id}
                  clip={clip}
                  isPlaying={playingClips.has(clip.id)}
                  isQueued={queuedClips.has(clip.id)}
                  isRecording={recordingClip === clip.id}
                  onLaunch={() => handleCellClick(row, column)}
                  onStop={() => stopClip(row, column)}
                  onRecord={() => handleRecord(row, column)}
                  onToggleLoop={() => toggleLoop(row, column)}
                  onDoubleClick={() => handleCellDoubleClick(row, column)}
                  getScenePreview={getScenePreview}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Scene Selector Modal */}
      {showSceneSelector && (
        <div className={styles.sceneSelectorOverlay} onClick={() => setShowSceneSelector(false)}>
          <div className={styles.sceneSelector} onClick={(e) => e.stopPropagation()}>
            <h4>Select Scene</h4>
            <div className={styles.sceneList}>
              {scenes.map(scene => (
                <button
                  key={scene.name}
                  className={styles.sceneOption}
                  onClick={() => handleAssignScene(scene.name)}
                >
                  {scene.name}
                </button>
              ))}
              <button
                className={styles.sceneOption}
                onClick={() => {
                  if (selectedCell) {
                    const sceneName = prompt('Enter scene name:');
                    if (sceneName) {
                      const oscAddress = `/scene/${sceneName.toLowerCase().replace(/\s+/g, '_')}`;
                      saveScene(sceneName, oscAddress);
                      handleAssignScene(sceneName);
                    }
                  }
                }}
              >
                + Create New Scene
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

