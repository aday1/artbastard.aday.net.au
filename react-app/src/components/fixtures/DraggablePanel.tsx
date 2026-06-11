import React, { useState, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './SuperControl.module.scss';

interface DraggablePanelProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  initialPosition?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  onMinimize?: () => void;
  onClose?: () => void;
  isMinimized?: boolean;
  className?: string;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  title,
  icon,
  children,
  initialPosition = { x: 0, y: 0 },
  onPositionChange,
  onMinimize,
  onClose,
  isMinimized = false,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(initialPosition);
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleDrag = (e: DraggableEvent, data: DraggableData) => {
    const newPosition = { x: data.x, y: data.y };
    setPosition(newPosition);
    onPositionChange?.(newPosition);
  };

  const handleStart = () => {
    setIsDragging(true);
  };

  const handleStop = () => {
    setIsDragging(false);
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onDrag={handleDrag}
      onStart={handleStart}
      onStop={handleStop}
      handle=".panel-header"
      bounds="parent"
    >
      <div
        ref={nodeRef}
        className={`${styles.draggablePanel} ${isDragging ? styles.dragging : ''} ${className}`}
      >
        <div className={`${styles.panelHeader} panel-header`}>
          <h4>
            {icon && <LucideIcon name={icon as any} />}
            {title}
          </h4>
          
          <div className={styles.panelControls}>
            {onMinimize && (
              <button
                onClick={onMinimize}
                title={isMinimized ? 'Restore' : 'Minimize'}
              >
                <LucideIcon name={isMinimized ? "Maximize2" : "Minimize2"} />
              </button>
            )}
            
            {onClose && (
              <button
                onClick={onClose}
                title="Close"
                style={{ color: '#ff6b6b' }}
              >
                <LucideIcon name="X" />
              </button>
            )}
          </div>
        </div>
        
        {!isMinimized && (
          <div className={styles.panelContent}>
            {children}
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default DraggablePanel;
