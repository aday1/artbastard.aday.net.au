import React from 'react';
import { Fixture } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { fixtureTemplates } from './fixtureTemplates';
import styles from './DraggableFixturePalette.module.scss';

interface DraggableFixturePaletteProps {
  fixtures: Fixture[];
  onFixtureDrop?: (fixtureId: string, x: number, y: number) => void;
  canvasRef: React.RefObject<HTMLDivElement>;
}

const DraggableFixturePalette: React.FC<DraggableFixturePaletteProps> = ({
  fixtures,
  onFixtureDrop,
  canvasRef,
}) => {
  const getFixtureColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'moving-head': '#ff6b6b',
      'par': '#4ecdc4',
      'strip': '#45b7d1',
      'laser': '#96ceb4',
      'strobe': '#feca57',
      'smoke': '#a55eea',
      default: '#fd79a8',
    };
    return colorMap[type.toLowerCase()] || colorMap.default;
  };

  const getFixtureIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'moving-head': 'Zap',
      'par': 'Circle',
      'strip': 'Minus',
      'laser': 'Target',
      'strobe': 'Flashlight',
      'smoke': 'Cloud',
      default: 'Lightbulb',
    };
    return iconMap[type.toLowerCase()] || iconMap.default;
  };

  const handleDragStart = (event: React.DragEvent, fixtureId: string) => {
    event.dataTransfer.setData('text/plain', fixtureId);
    event.dataTransfer.effectAllowed = 'copy';
    
    // Create drag image
    const dragElement = event.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    event.dataTransfer.setDragImage(dragElement, rect.width / 2, rect.height / 2);
  };

  const handleDragEnd = (event: React.DragEvent) => {
    // Clean up any visual feedback
    event.currentTarget.classList.remove(styles.dragging);
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    event.currentTarget.classList.add(styles.dragging);
  };

  return (
    <div className={styles.fixturePalette}>
      <div className={styles.paletteHeader}>
        <LucideIcon name="Package" />
        <h3>Fixture Library</h3>
        <span className={styles.dragHint}>Drag to Canvas</span>
      </div>
      
      <div className={styles.fixtureGrid}>
        {fixtureTemplates.map(template => (
          <div
            key={template.id}
            className={styles.paletteFixture}
            draggable
            onDragStart={(e) => handleDragStart(e, template.id)}
            onDragEnd={handleDragEnd}
            onMouseDown={handleMouseDown}
            style={{
              '--fixture-color': getFixtureColor(template.type)
            } as React.CSSProperties}
            title={`${template.name} (${template.type}) - ${template.channels?.length || 0} channels`}
          >
            <div className={styles.fixtureIcon}>
              <LucideIcon name={getFixtureIcon(template.type) as any} />
            </div>
            
            <div className={styles.fixtureInfo}>
              <div className={styles.fixtureName}>{template.name}</div>
              <div className={styles.fixtureType}>{template.type}</div>
              <div className={styles.fixtureChannels}>{template.channels?.length || 0}ch</div>
            </div>

            <div className={styles.dragHandle}>
              <LucideIcon name="GripVertical" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DraggableFixturePalette;
