import React, { useState } from 'react';
import { DockableComponent } from '@/components/ui/DockableComponent';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './SceneQuickLaunch.module.scss';

interface SceneQuickLaunchProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  isDockable?: boolean;
}

export const SceneQuickLaunch: React.FC<SceneQuickLaunchProps> = ({
  isCollapsed = false,
  onCollapsedChange,
  isDockable = true,
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  
  // Get scenes and actions from store
  const { scenes, loadScene, saveScene, deleteScene } = useStore(state => ({
    scenes: state.scenes,
    loadScene: state.loadScene,
    saveScene: state.saveScene,
    deleteScene: state.deleteScene
  }));

  const handleSceneActivate = async (sceneName: string) => {
    try {
      loadScene(sceneName);
      setActiveSceneId(sceneName);
      useStore.getState().addNotification({
        message: `Scene "${sceneName}" activated ✨`,
        type: 'success',
        priority: 'normal'
      });
    } catch (error) {
      console.error('Failed to activate scene:', error);
    }
  };

  const handleQuickCapture = () => {
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    const quickName = `Quick_${timestamp}`;
    saveScene(quickName, `/scene/${quickName.toLowerCase()}`);
    useStore.getState().addNotification({      message: `Scene quick saved as "${quickName}" 📸`,
      type: 'success',
      priority: 'normal',
      dismissible: true
    });
  };

  const handleQuickDelete = () => {
    if (!activeSceneId) return;

    if (window.confirm(`Are you sure you want to delete scene "${activeSceneId}"?`)) {
      deleteScene(activeSceneId);
      useStore.getState().addNotification({      message: `Scene "${activeSceneId}" deleted 🗑️`,
      type: 'success',
      priority: 'normal',
      dismissible: true
      });
      setActiveSceneId(null);
    }
  };

  const handleToggleCollapsed = () => {
    const newCollapsed = !isCollapsed;
    onCollapsedChange?.(newCollapsed);
  };

  const renderContent = () => {
    if (scenes.length === 0) {
      return (
        <div className={styles.empty}>
          <p>No scenes available</p>
          <small>Create scenes in the Scene Manager</small>
        </div>
      );
    }

    return (
      <div className={styles.sceneGrid}>
        {scenes.map((scene) => (
          <button
            key={scene.name}
            className={`${styles.sceneButton} ${scene.name === activeSceneId ? styles.active : ''}`}
            onClick={() => handleSceneActivate(scene.name)}
            title={scene.oscAddress || scene.name}
          >
            <div className={styles.sceneName}>{scene.name}</div>
            {scene.name === activeSceneId && (
              <div className={styles.activeIndicator}>●</div>
            )}
          </button>
        ))}
      </div>
    );  };

  const content = (
    <>
      <div className={styles.header}>
        <h3 className={styles.title}>Quick Launch</h3>
        <div className={styles.headerControls}>
          <button 
            className={styles.quickCaptureButton}
            onClick={handleQuickCapture}
            title="Quick capture current DMX state 📸"
            aria-label="Quick capture current DMX state"
          >
            <LucideIcon name="Camera" size={16} />
          </button>
          <button 
            className={styles.quickDeleteButton}
            onClick={handleQuickDelete}
            disabled={!activeSceneId}
            title={activeSceneId ? `Delete scene "${activeSceneId}" 🗑️` : "Select a scene to delete"}
            aria-label={activeSceneId ? `Delete scene ${activeSceneId}` : "Delete scene button disabled"}
          >
            <LucideIcon name="Trash" size={16} />
          </button>
          <button 
            className={styles.collapseButton}
            onClick={handleToggleCollapsed}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <LucideIcon name={isCollapsed ? 'ChevronDown' : 'ChevronUp'} size={16} />
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className={styles.content}>
          {renderContent()}
        </div>
      )}
    </>
  );

  if (!isDockable) {
    return (
      <div className={styles.container}>
        {content}
      </div>
    );
  }

  return (
    <DockableComponent
      id="scene-quick-launch"
      title="Scene Quick Launch"
      component="midi-clock"
      defaultPosition={{ zone: 'top-right' }}
      isCollapsed={isCollapsed}
      onCollapsedChange={onCollapsedChange}
      width="280px"
      height="auto"
      className={styles.container}
      isDraggable={true}
    >
      {content}
    </DockableComponent>
  );
};
