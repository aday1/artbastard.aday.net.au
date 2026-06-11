import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './NodeBasedActEditor.module.scss';

interface ActNode {
  id: string;
  type: 'scene' | 'transition' | 'wait' | 'condition' | 'tracker';
  name: string;
  position: { x: number; y: number };
  data: {
    sceneId?: string;
    duration?: number;
    transitionType?: 'fade' | 'crossfade' | 'cut' | 'wipe';
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    mutedFixtures?: string[];
    conditions?: ActCondition[];
    waitTime?: number;
    // Tracker specific data
    trackerMode?: 'bounce' | 'pingpong' | 'random' | 'once';
    trackerSpeed?: number;
    trackerNodes?: string[]; // Array of node IDs to track between
    currentDirection?: 'forward' | 'backward';
    currentIndex?: number;
  };
  connections: string[];
  color: string;
}

interface ActConnection {
  id: string;
  from: string;
  to: string;
  type: 'default' | 'conditional' | 'timeout';
  condition?: string;
  timeout?: number;
}

interface ActCondition {
  id: string;
  type: 'time' | 'midi' | 'osc' | 'dmx';
  value: any;
  operator: 'equals' | 'greater' | 'less' | 'between';
}

interface Act {
  id: string;
  name: string;
  description?: string;
  nodes: ActNode[];
  connections: ActConnection[];
  startNodeId?: string;
  isPlaying: boolean;
  currentNodeId?: string;
  playbackProgress: number;
  // Trigger settings
  triggers: {
    osc?: {
      address: string;
      enabled: boolean;
    };
    midi?: {
      channel: number;
      note: number;
      enabled: boolean;
    };
  };
  createdAt: number;
  updatedAt: number;
}

interface NodeBasedActEditorProps {
  isOpen: boolean;
  onClose: () => void;
  act?: Act;
  onSave?: (act: Act) => void;
}

export const NodeBasedActEditor: React.FC<NodeBasedActEditorProps> = ({
  isOpen,
  onClose,
  act,
  onSave
}) => {
  const {
    scenes,
    fixtures,
    dmxChannels,
    setDmxChannelValue,
    addNotification
  } = useStore();

  const [currentAct, setCurrentAct] = useState<Act>(act || {
    id: `act_${Date.now()}`,
    name: 'New Act',
    nodes: [],
    connections: [],
    isPlaying: false,
    playbackProgress: 0,
    triggers: {
      osc: {
        address: `/act/${Date.now()}`,
        enabled: false
      },
      midi: {
        channel: 1,
        note: 60,
        enabled: false
      }
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const [selectedNode, setSelectedNode] = useState<ActNode | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ActConnection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [connectionPreview, setConnectionPreview] = useState<{ x: number; y: number } | null>(null);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [selectedTool, setSelectedTool] = useState<'select' | 'connect' | 'pan'>('select');
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);

  const GRID_SIZE = 20;
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 120;

  const nodeTypes = [
    { type: 'scene', name: 'Scene', icon: 'Film', color: '#3b82f6' },
    { type: 'transition', name: 'Transition', icon: 'ArrowRight', color: '#10b981' },
    { type: 'wait', name: 'Wait', icon: 'Clock', color: '#f59e0b' },
    { type: 'condition', name: 'Condition', icon: 'GitBranch', color: '#8b5cf6' },
    { type: 'tracker', name: 'Tracker', icon: 'Zap', color: '#f97316' }
  ];

  const createNode = (type: ActNode['type'], position: { x: number; y: number }) => {
    const nodeType = nodeTypes.find(nt => nt.type === type);
    if (!nodeType) return;

    const newNode: ActNode = {
      id: `node_${Date.now()}`,
      type,
      name: `${nodeType.name} ${currentAct.nodes.length + 1}`,
      position: snapToGrid ? snapToGridPosition(position) : position,
      data: {
        duration: 1000,
        transitionType: 'fade',
        easing: 'ease-in-out',
        mutedFixtures: [],
        conditions: [],
        waitTime: 3000,
        // Tracker defaults
        trackerMode: 'bounce',
        trackerSpeed: 2000,
        trackerNodes: [],
        currentDirection: 'forward',
        currentIndex: 0
      },
      connections: [],
      color: nodeType.color
    };

    setCurrentAct(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      updatedAt: Date.now()
    }));

    setSelectedNode(newNode);
  };

  const snapToGridPosition = (pos: { x: number; y: number }) => {
    if (!snapToGrid) return pos;
    return {
      x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE
    };
  };

  const updateNode = (nodeId: string, updates: Partial<ActNode>) => {
    setCurrentAct(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      ),
      updatedAt: Date.now()
    }));
  };

  const deleteNode = (nodeId: string) => {
    setCurrentAct(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      connections: prev.connections.filter(conn => 
        conn.from !== nodeId && conn.to !== nodeId
      ),
      updatedAt: Date.now()
    }));

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const createConnection = (fromId: string, toId: string) => {
    if (fromId === toId) return;

    const newConnection: ActConnection = {
      id: `conn_${Date.now()}`,
      from: fromId,
      to: toId,
      type: 'default'
    };

    setCurrentAct(prev => ({
      ...prev,
      connections: [...prev.connections, newConnection],
      nodes: prev.nodes.map(node => 
        node.id === fromId 
          ? { ...node, connections: [...node.connections, newConnection.id] }
          : node
      ),
      updatedAt: Date.now()
    }));
  };

  const deleteConnection = (connectionId: string) => {
    setCurrentAct(prev => ({
      ...prev,
      connections: prev.connections.filter(conn => conn.id !== connectionId),
      nodes: prev.nodes.map(node => ({
        ...node,
        connections: node.connections.filter(connId => connId !== connectionId)
      })),
      updatedAt: Date.now()
    }));

    if (selectedConnection?.id === connectionId) {
      setSelectedConnection(null);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (event.target === canvasRef.current) {
      setSelectedNode(null);
      setSelectedConnection(null);
    }
  };

  const handleNodeMouseDown = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (selectedTool === 'connect') {
      if (!connectionStart) {
        setConnectionStart(nodeId);
      } else if (connectionStart !== nodeId) {
        createConnection(connectionStart, nodeId);
        setConnectionStart(null);
      }
    } else {
      const node = currentAct.nodes.find(n => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        setSelectedConnection(null);
        
        if (selectedTool === 'select') {
          setIsDragging(true);
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setDragOffset({
              x: event.clientX - rect.left - node.position.x,
              y: event.clientY - rect.top - node.position.y
            });
          }
        }
      }
    }
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging && selectedNode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const newPosition = {
          x: event.clientX - rect.left - dragOffset.x,
          y: event.clientY - rect.top - dragOffset.y
        };
        
        updateNode(selectedNode.id, {
          position: snapToGridPosition(newPosition)
        });
      }
    }

    if (isConnecting && connectionStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setConnectionPreview({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      }
    }
  }, [isDragging, selectedNode, dragOffset, isConnecting, connectionStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsConnecting(false);
    setConnectionPreview(null);
  }, []);

  useEffect(() => {
    if (isDragging || isConnecting) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isConnecting, handleMouseMove, handleMouseUp]);

  const startPlayback = () => {
    if (currentAct.nodes.length === 0) return;

    const startNode = currentAct.startNodeId 
      ? currentAct.nodes.find(n => n.id === currentAct.startNodeId)
      : currentAct.nodes[0];

    if (!startNode) return;

    setCurrentAct(prev => ({
      ...prev,
      isPlaying: true,
      currentNodeId: startNode.id,
      playbackProgress: 0
    }));

    executeNode(startNode);
  };

  const stopPlayback = () => {
    setCurrentAct(prev => ({
      ...prev,
      isPlaying: false,
      currentNodeId: undefined,
      playbackProgress: 0
    }));
  };

  const executeNode = (node: ActNode) => {
    switch (node.type) {
      case 'scene':
        if (node.data.sceneId) {
          const scene = scenes.find(s => s.name === node.data.sceneId);
          if (scene) {
            // Apply scene with muted fixtures
            scene.channelValues.forEach((value, channelIndex) => {
              const fixture = fixtures.find(f => 
                f.startAddress <= channelIndex + 1 && 
                channelIndex + 1 < f.startAddress + f.channels.length
              );
              
              if (!fixture || !node.data.mutedFixtures?.includes(fixture.id)) {
                setDmxChannelValue(channelIndex, value);
              }
            });
          }
        }
        break;
        
      case 'wait':
        setTimeout(() => {
          proceedToNextNode(node);
        }, node.data.waitTime || 3000);
        return;
        
      case 'transition':
        // Handle transition logic
        setTimeout(() => {
          proceedToNextNode(node);
        }, node.data.duration || 1000);
        return;
        
      case 'tracker':
        executeTrackerNode(node);
        return;
    }

    // For scene nodes, proceed immediately
    proceedToNextNode(node);
  };

  const executeTrackerNode = (trackerNode: ActNode) => {
    const { trackerNodes, trackerMode, trackerSpeed, currentIndex, currentDirection } = trackerNode.data;
    
    if (!trackerNodes || trackerNodes.length === 0) {
      proceedToNextNode(trackerNode);
      return;
    }

    const targetNodeId = trackerNodes[currentIndex || 0];
    const targetNode = currentAct.nodes.find(n => n.id === targetNodeId);
    
    if (!targetNode) {
      proceedToNextNode(trackerNode);
      return;
    }

    // Execute the target node
    executeNode(targetNode);

    // Calculate next index based on mode
    let nextIndex = currentIndex || 0;
    let nextDirection = currentDirection || 'forward';

    switch (trackerMode) {
      case 'bounce':
        if (nextDirection === 'forward') {
          if (nextIndex >= trackerNodes.length - 1) {
            nextDirection = 'backward';
            nextIndex = trackerNodes.length - 2;
          } else {
            nextIndex++;
          }
        } else {
          if (nextIndex <= 0) {
            nextDirection = 'forward';
            nextIndex = 1;
          } else {
            nextIndex--;
          }
        }
        break;
        
      case 'pingpong':
        if (nextDirection === 'forward') {
          if (nextIndex >= trackerNodes.length - 1) {
            nextDirection = 'backward';
            nextIndex = trackerNodes.length - 2;
          } else {
            nextIndex++;
          }
        } else {
          if (nextIndex <= 0) {
            nextDirection = 'forward';
            nextIndex = 1;
          } else {
            nextIndex--;
          }
        }
        break;
        
      case 'random':
        nextIndex = Math.floor(Math.random() * trackerNodes.length);
        break;
        
      case 'once':
        if (nextIndex >= trackerNodes.length - 1) {
          // End of sequence, proceed to next node
          proceedToNextNode(trackerNode);
          return;
        } else {
          nextIndex++;
        }
        break;
    }

    // Update tracker node state
    updateNode(trackerNode.id, {
      data: {
        ...trackerNode.data,
        currentIndex: nextIndex,
        currentDirection: nextDirection
      }
    });

    // Schedule next tracker execution
    setTimeout(() => {
      if (currentAct.isPlaying) {
        executeTrackerNode({
          ...trackerNode,
          data: {
            ...trackerNode.data,
            currentIndex: nextIndex,
            currentDirection: nextDirection
          }
        });
      }
    }, trackerSpeed || 2000);
  };

  const proceedToNextNode = (currentNode: ActNode) => {
    const outgoingConnections = currentAct.connections.filter(
      conn => conn.from === currentNode.id
    );

    if (outgoingConnections.length === 0) {
      stopPlayback();
      return;
    }

    // For now, take the first connection
    // TODO: Implement conditional logic
    const nextConnection = outgoingConnections[0];
    const nextNode = currentAct.nodes.find(n => n.id === nextConnection.to);

    if (nextNode) {
      setCurrentAct(prev => ({
        ...prev,
        currentNodeId: nextNode.id
      }));
      executeNode(nextNode);
    } else {
      stopPlayback();
    }
  };

  const saveAct = () => {
    if (onSave) {
      onSave(currentAct);
    }
    
    // Save to localStorage
    const savedActs = JSON.parse(localStorage.getItem('acts') || '[]');
    const existingIndex = savedActs.findIndex((a: Act) => a.id === currentAct.id);
    
    if (existingIndex >= 0) {
      savedActs[existingIndex] = currentAct;
    } else {
      savedActs.push(currentAct);
    }
    
    localStorage.setItem('acts', JSON.stringify(savedActs));
    
    addNotification({
      message: `Act "${currentAct.name}" saved`,
      type: 'success'
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.editor} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <LucideIcon name="Workflow" className={styles.titleIcon} />
            <h2>Node-Based Act Editor</h2>
            <input
              type="text"
              value={currentAct.name}
              onChange={(e) => setCurrentAct(prev => ({ ...prev, name: e.target.value }))}
              className={styles.actNameInput}
            />
          </div>
          <div className={styles.headerControls}>
            <div className={styles.triggerControls}>
              <button
                className={`${styles.triggerButton} ${currentAct.triggers.osc?.enabled ? styles.active : ''}`}
                title="OSC Trigger"
              >
                <LucideIcon name="Radio" />
                OSC
              </button>
              <button
                className={`${styles.triggerButton} ${currentAct.triggers.midi?.enabled ? styles.active : ''}`}
                title="MIDI Trigger"
              >
                <LucideIcon name="Music" />
                MIDI
              </button>
            </div>
            <button onClick={saveAct} className={styles.saveButton}>
              <LucideIcon name="Save" />
              Save
            </button>
            <button onClick={onClose} className={styles.closeButton}>
              <LucideIcon name="X" />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolGroup}>
              <div className={styles.toolButtons}>
                <button
                  className={`${styles.toolButton} ${selectedTool === 'select' ? styles.active : ''}`}
                  onClick={() => setSelectedTool('select')}
                  title="Select Tool"
                >
                  <LucideIcon name="MousePointer" />
                </button>
                <button
                  className={`${styles.toolButton} ${selectedTool === 'connect' ? styles.active : ''}`}
                  onClick={() => setSelectedTool('connect')}
                  title="Connect Tool"
                >
                  <LucideIcon name="Link" />
                </button>
                <button
                  className={`${styles.toolButton} ${selectedTool === 'pan' ? styles.active : ''}`}
                  onClick={() => setSelectedTool('pan')}
                  title="Pan Tool"
                >
                  <LucideIcon name="Move" />
                </button>
              </div>
            </div>

            <div className={styles.toolGroup}>
              <div className={styles.viewControls}>
                <button
                  className={`${styles.toggleButton} ${showGrid ? styles.active : ''}`}
                  onClick={() => setShowGrid(!showGrid)}
                  title="Toggle Grid"
                >
                  <LucideIcon name="Grid3x3" />
                </button>
                <button
                  className={`${styles.toggleButton} ${snapToGrid ? styles.active : ''}`}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  title="Snap to Grid"
                >
                  <LucideIcon name="Magnet" />
                </button>
              </div>
            </div>

            <div className={styles.toolGroup}>
              <div className={styles.zoomControls}>
                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}>
                  <LucideIcon name="ZoomOut" />
                </button>
                <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
                  <LucideIcon name="ZoomIn" />
                </button>
              </div>
            </div>

            <div className={styles.toolGroup}>
              <button
                className={`${styles.toggleButton} ${showNodePalette ? styles.active : ''}`}
                onClick={() => setShowNodePalette(!showNodePalette)}
                title="Node Palette"
              >
                <LucideIcon name="Package" />
              </button>
              <button
                className={`${styles.toggleButton} ${showProperties ? styles.active : ''}`}
                onClick={() => setShowProperties(!showProperties)}
                title="Properties Panel"
              >
                <LucideIcon name="Settings" />
              </button>
            </div>
          </div>

          <div className={styles.mainContent}>
            {/* Node Palette */}
            {showNodePalette && (
              <div className={styles.nodePalette}>
                <h4>Node Types</h4>
                {nodeTypes.map(nodeType => (
                  <div
                    key={nodeType.type}
                    className={styles.nodeType}
                    onClick={() => {
                      const rect = canvasRef.current?.getBoundingClientRect();
                      if (rect) {
                        createNode(nodeType.type as ActNode['type'], {
                          x: (rect.width / 2) / zoom - viewOffset.x,
                          y: (rect.height / 2) / zoom - viewOffset.y
                        });
                      }
                    }}
                  >
                    <div 
                      className={styles.nodeTypeIcon}
                      style={{ backgroundColor: nodeType.color }}
                    >
                      <LucideIcon name={nodeType.icon as any} />
                    </div>
                    <span>{nodeType.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Canvas */}
            <div className={styles.canvasContainer}>
              <div
                ref={canvasRef}
                className={styles.canvas}
                onClick={handleCanvasClick}
                style={{
                  transform: `scale(${zoom}) translate(${viewOffset.x}px, ${viewOffset.y}px)`,
                  transformOrigin: 'top left'
                }}
              >
                {/* Grid */}
                {showGrid && (
                  <div className={styles.grid}>
                    <svg width="100%" height="100%">
                      <defs>
                        <pattern
                          id="grid"
                          width={GRID_SIZE}
                          height={GRID_SIZE}
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                  </div>
                )}

                {/* Connections */}
                <svg className={styles.connectionsLayer}>
                  {currentAct.connections.map(connection => {
                    const fromNode = currentAct.nodes.find(n => n.id === connection.from);
                    const toNode = currentAct.nodes.find(n => n.id === connection.to);
                    
                    if (!fromNode || !toNode) return null;

                    const fromX = fromNode.position.x + NODE_WIDTH;
                    const fromY = fromNode.position.y + NODE_HEIGHT / 2;
                    const toX = toNode.position.x;
                    const toY = toNode.position.y + NODE_HEIGHT / 2;

                    return (
                      <g key={connection.id}>
                        <path
                          d={`M ${fromX} ${fromY} Q ${(fromX + toX) / 2} ${fromY} ${toX} ${toY}`}
                          stroke={connection.id === selectedConnection?.id ? "#00d4ff" : "#666"}
                          strokeWidth="2"
                          fill="none"
                          markerEnd="url(#arrowhead)"
                          className={styles.connection}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConnection(connection);
                            setSelectedNode(null);
                          }}
                        />
                      </g>
                    );
                  })}
                  
                  {/* Connection Preview */}
                  {connectionPreview && connectionStart && (
                    <path
                      d={`M ${currentAct.nodes.find(n => n.id === connectionStart)?.position.x + NODE_WIDTH} ${currentAct.nodes.find(n => n.id === connectionStart)?.position.y + NODE_HEIGHT / 2} L ${connectionPreview.x / zoom - viewOffset.x} ${connectionPreview.y / zoom - viewOffset.y}`}
                      stroke="#00d4ff"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5,5"
                    />
                  )}
                  
                  {/* Arrow marker */}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill="#666"
                      />
                    </marker>
                  </defs>
                </svg>

                {/* Nodes */}
                {currentAct.nodes.map(node => (
                  <div
                    key={node.id}
                    className={`${styles.node} ${selectedNode?.id === node.id ? styles.selected : ''} ${currentAct.currentNodeId === node.id ? styles.current : ''}`}
                    style={{
                      left: node.position.x,
                      top: node.position.y,
                      borderColor: node.color
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  >
                    <div className={styles.nodeHeader}>
                      <div className={styles.nodeIcon} style={{ backgroundColor: node.color }}>
                        <LucideIcon name={nodeTypes.find(nt => nt.type === node.type)?.icon as any} />
                      </div>
                      <input
                        type="text"
                        value={node.name}
                        onChange={(e) => updateNode(node.id, { name: e.target.value })}
                        className={styles.nodeNameInput}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                        className={styles.deleteNodeButton}
                      >
                        <LucideIcon name="X" />
                      </button>
                    </div>

                    <div className={styles.nodeContent}>
                      {node.type === 'scene' && (
                        <select
                          value={node.data.sceneId || ''}
                          onChange={(e) => updateNode(node.id, {
                            data: { ...node.data, sceneId: e.target.value }
                          })}
                          className={styles.sceneSelect}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Select Scene</option>
                          {scenes.map(scene => (
                            <option key={scene.name} value={scene.name}>
                              {scene.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {node.type === 'wait' && (
                        <div className={styles.waitControl}>
                          <label>Wait Time (ms):</label>
                          <input
                            type="number"
                            value={node.data.waitTime || 3000}
                            onChange={(e) => updateNode(node.id, {
                              data: { ...node.data, waitTime: parseInt(e.target.value) }
                            })}
                            className={styles.waitInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}

                      {node.type === 'transition' && (
                        <div className={styles.transitionControls}>
                          <select
                            value={node.data.transitionType || 'fade'}
                            onChange={(e) => updateNode(node.id, {
                              data: { ...node.data, transitionType: e.target.value as any }
                            })}
                            className={styles.transitionSelect}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="fade">Fade</option>
                            <option value="crossfade">Crossfade</option>
                            <option value="cut">Cut</option>
                            <option value="wipe">Wipe</option>
                          </select>
                          <input
                            type="number"
                            value={node.data.duration || 1000}
                            onChange={(e) => updateNode(node.id, {
                              data: { ...node.data, duration: parseInt(e.target.value) }
                            })}
                            className={styles.durationInput}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Duration (ms)"
                          />
                        </div>
                      )}

                      {node.type === 'tracker' && (
                        <div className={styles.trackerControls}>
                          <select
                            value={node.data.trackerMode || 'bounce'}
                            onChange={(e) => updateNode(node.id, {
                              data: { ...node.data, trackerMode: e.target.value as any }
                            })}
                            className={styles.trackerModeSelect}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="bounce">Bounce</option>
                            <option value="pingpong">Ping Pong</option>
                            <option value="random">Random</option>
                            <option value="once">Once</option>
                          </select>
                          <input
                            type="number"
                            value={node.data.trackerSpeed || 2000}
                            onChange={(e) => updateNode(node.id, {
                              data: { ...node.data, trackerSpeed: parseInt(e.target.value) }
                            })}
                            className={styles.speedInput}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Speed (ms)"
                          />
                        </div>
                      )}
                    </div>

                    {/* Connection Points */}
                    <div className={styles.connectionPoints}>
                      <div className={styles.inputPoint} />
                      <div className={styles.outputPoint} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Properties Panel */}
            {showProperties && selectedNode && (
              <div className={styles.propertiesPanel} ref={propertiesRef}>
                <h4>Node Properties</h4>
                
                <div className={styles.propertyGroup}>
                  <label>Node Name</label>
                  <input
                    type="text"
                    value={selectedNode.name}
                    onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
                    className={styles.propertyInput}
                  />
                </div>

                {selectedNode.type === 'scene' && (
                  <>
                    <div className={styles.propertyGroup}>
                      <label>Scene</label>
                      <select
                        value={selectedNode.data.sceneId || ''}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: { ...selectedNode.data, sceneId: e.target.value }
                        })}
                        className={styles.propertySelect}
                      >
                        <option value="">Select Scene</option>
                        {scenes.map(scene => (
                          <option key={scene.name} value={scene.name}>
                            {scene.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.propertyGroup}>
                      <label>Muted Fixtures</label>
                      <div className={styles.mutedFixtures}>
                        {fixtures.map(fixture => (
                          <label key={fixture.id} className={styles.fixtureCheckbox}>
                            <input
                              type="checkbox"
                              checked={selectedNode.data.mutedFixtures?.includes(fixture.id) || false}
                              onChange={(e) => {
                                const mutedFixtures = selectedNode.data.mutedFixtures || [];
                                const updated = e.target.checked
                                  ? [...mutedFixtures, fixture.id]
                                  : mutedFixtures.filter(id => id !== fixture.id);
                                
                                updateNode(selectedNode.id, {
                                  data: { ...selectedNode.data, mutedFixtures: updated }
                                });
                              }}
                            />
                            <span>{fixture.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedNode.type === 'wait' && (
                  <div className={styles.propertyGroup}>
                    <label>Wait Time (ms)</label>
                    <input
                      type="number"
                      value={selectedNode.data.waitTime || 3000}
                      onChange={(e) => updateNode(selectedNode.id, {
                        data: { ...selectedNode.data, waitTime: parseInt(e.target.value) }
                      })}
                      className={styles.propertyInput}
                    />
                  </div>
                )}

                {selectedNode.type === 'transition' && (
                  <>
                    <div className={styles.propertyGroup}>
                      <label>Transition Type</label>
                      <select
                        value={selectedNode.data.transitionType || 'fade'}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: { ...selectedNode.data, transitionType: e.target.value as any }
                        })}
                        className={styles.propertySelect}
                      >
                        <option value="fade">Fade</option>
                        <option value="crossfade">Crossfade</option>
                        <option value="cut">Cut</option>
                        <option value="wipe">Wipe</option>
                      </select>
                    </div>

                    <div className={styles.propertyGroup}>
                      <label>Duration (ms)</label>
                      <input
                        type="number"
                        value={selectedNode.data.duration || 1000}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: { ...selectedNode.data, duration: parseInt(e.target.value) }
                        })}
                        className={styles.propertyInput}
                      />
                    </div>

                    <div className={styles.propertyGroup}>
                      <label>Easing</label>
                      <select
                        value={selectedNode.data.easing || 'ease-in-out'}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: { ...selectedNode.data, easing: e.target.value as any }
                        })}
                        className={styles.propertySelect}
                      >
                        <option value="linear">Linear</option>
                        <option value="ease-in">Ease In</option>
                        <option value="ease-out">Ease Out</option>
                        <option value="ease-in-out">Ease In Out</option>
                      </select>
                    </div>
                  </>
                )}

                {selectedNode.type === 'tracker' && (
                  <>
                    <div className={styles.propertyGroup}>
                      <label>Tracker Mode</label>
                      <select
                        value={selectedNode.data.trackerMode || 'bounce'}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: { ...selectedNode.data, trackerMode: e.target.value as any }
                        })}
                        className={styles.propertySelect}
                      >
                        <option value="bounce">Bounce</option>
                        <option value="pingpong">Ping Pong</option>
                        <option value="random">Random</option>
                        <option value="once">Once</option>
                      </select>
                    </div>

                    <div className={styles.propertyGroup}>
                      <label>Speed (ms)</label>
                      <input
                        type="number"
                        value={selectedNode.data.trackerSpeed || 2000}
                        onChange={(e) => updateNode(selectedNode.id, {
                          data: { ...selectedNode.data, trackerSpeed: parseInt(e.target.value) }
                        })}
                        className={styles.propertyInput}
                      />
                    </div>

                    <div className={styles.propertyGroup}>
                      <label>Tracked Nodes</label>
                      <div className={styles.trackedNodes}>
                        {currentAct.nodes
                          .filter(n => n.type === 'scene')
                          .map(node => (
                            <label key={node.id} className={styles.nodeCheckbox}>
                              <input
                                type="checkbox"
                                checked={selectedNode.data.trackerNodes?.includes(node.id) || false}
                                onChange={(e) => {
                                  const trackerNodes = selectedNode.data.trackerNodes || [];
                                  const updated = e.target.checked
                                    ? [...trackerNodes, node.id]
                                    : trackerNodes.filter(id => id !== node.id);
                                  
                                  updateNode(selectedNode.id, {
                                    data: { ...selectedNode.data, trackerNodes: updated }
                                  });
                                }}
                              />
                              <span>{node.name}</span>
                            </label>
                          ))}
                      </div>
                    </div>

                    <div className={styles.propertyGroup}>
                      <label>Current State</label>
                      <div className={styles.trackerState}>
                        <div>Index: {selectedNode.data.currentIndex || 0}</div>
                        <div>Direction: {selectedNode.data.currentDirection || 'forward'}</div>
                        <div>Mode: {selectedNode.data.trackerMode || 'bounce'}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeBasedActEditor;
