import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import smx from './SmxSuperPanel.module.scss';

interface DmxSceneControlsProps {
  scenes: Array<{ name: string }>;
  onSaveScene: () => void;
  onLoadScene: (sceneName: string) => void;
}

export const DmxSceneControls: React.FC<DmxSceneControlsProps> = ({
  scenes,
  onSaveScene,
  onLoadScene,
}) => {
  return (
    <div className={smx.rackFrame}>
      <div className={smx.rackFaceplate}>
        <span className={`${smx.screw} ${smx.screwTl}`} />
        <span className={`${smx.screw} ${smx.screwTr}`} />
        <span className={`${smx.screw} ${smx.screwBl}`} />
        <span className={`${smx.screw} ${smx.screwBr}`} />

        <div className={smx.rackHeader}>
          <h3 className={smx.rackTitle}>
            <LucideIcon name="Camera" />
            Scene memory
          </h3>
          <div className={smx.ledRow}>
            <span className={smx.ledLabel}>Store</span>
            <div className={smx.ledCluster}>
              <span
                className={`${smx.led} ${scenes.length > 0 ? smx.ledOn : ''}`}
                title="Saved scenes in project"
              />
            </div>
          </div>
        </div>

        <div className={smx.sceneBody}>
          <button
            type="button"
            className={smx.sceneActuator}
            onClick={onSaveScene}
            title="Capture current DMX values as a new scene"
          >
            <LucideIcon name="Save" />
            Save scene
          </button>

          {scenes.length > 0 && (
            <div className={smx.recallGrid}>
              <div className={smx.recallLabel}>Recall</div>
              <div className={smx.recallButtons}>
                {scenes.map((scene, index) => (
                  <button
                    key={`${scene.name}-${index}`}
                    type="button"
                    className={smx.recallButton}
                    onClick={() => onLoadScene(scene.name)}
                    title={`Recall ${scene.name}`}
                  >
                    <LucideIcon name="Play" />
                    {scene.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={smx.privacyNote}>
            Scene snapshots are kept in your project / browser storage flow only. No external API
            calls are required for scene save and recall.
          </p>
        </div>
      </div>
    </div>
  );
};
