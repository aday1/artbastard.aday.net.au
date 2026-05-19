import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { useTheme } from '../../context/ThemeContext'
import { LucideIcon } from '../ui/LucideIcon'
import styles from './NodeBasedFixtureEditor.module.scss'

interface FixtureNode {
  id: string
  type: 'fixture' | 'channel' | 'dmxOutput'
  position: { x: number; y: number }
  data: {
    name: string
    value?: number
    channelType?: string
    dmxAddress?: number
    fixtureId?: string
    channelIndex?: number
  }
  connections: string[] // Array of connected node IDs
}

interface Connection {
  id: string
  from: string
  to: string
  type: 'dmx' | 'control'
}

interface NodeBasedFixtureEditorProps {
  fixtureId?: string
  onClose: () => void
}

const CHANNEL_TYPES = [
  { value: 'dimmer', label: 'Dimmer/Intensity', icon: 'Sun', color: '#fbbf24' },
  { value: 'red', label: 'Red', icon: 'Circle', color: '#ef4444' },
  { value: 'green', label: 'Green', icon: 'Circle', color: '#10b981' },
  { value: 'blue', label: 'Blue', icon: 'Circle', color: '#3b82f6' },
  { value: 'white', label: 'White', icon: 'Circle', color: '#f3f4f6' },
  { value: 'amber', label: 'Amber', icon: 'Circle', color: '#f59e0b' },
  { value: 'uv', label: 'UV', icon: 'Circle', color: '#8b5cf6' },
  { value: 'pan', label: 'Pan', icon: 'ArrowLeftRight', color: '#06b6d4' },
  { value: 'pan_fine', label: 'Pan Fine', icon: 'ArrowLeftRight', color: '#0891b2' },
  { value: 'tilt', label: 'Tilt', icon: 'ArrowUpDown', color: '#06b6d4' },
  { value: 'tilt_fine', label: 'Tilt Fine', icon: 'ArrowUpDown', color: '#0891b2' },
  { value: 'shutter', label: 'Shutter', icon: 'Camera', color: '#6b7280' },
  { value: 'strobe', label: 'Strobe', icon: 'Zap', color: '#f59e0b' },
  { value: 'zoom', label: 'Zoom', icon: 'ZoomIn', color: '#8b5cf6' },
  { value: 'focus', label: 'Focus', icon: 'Focus', color: '#8b5cf6' },
  { value: 'color_wheel', label: 'Color Wheel', icon: 'Palette', color: '#ec4899' },
  { value: 'gobo_wheel', label: 'Gobo Wheel', icon: 'Target', color: '#10b981' },
  { value: 'gobo_rotation', label: 'Gobo Rotation', icon: 'RotateCw', color: '#10b981' },
  { value: 'prism', label: 'Prism', icon: 'Triangle', color: '#a855f7' },
  { value: 'iris', label: 'Iris', icon: 'Aperture', color: '#6b7280' },
  { value: 'macro', label: 'Macro', icon: 'Settings', color: '#64748b' },
  { value: 'reset', label: 'Reset', icon: 'RotateCcw', color: '#dc2626' },
  { value: 'speed', label: 'Speed', icon: 'Gauge', color: '#059669' },
  { value: 'sound', label: 'Sound', icon: 'Volume2', color: '#0d9488' },
  { value: 'effect', label: 'Effect', icon: 'Sparkles', color: '#7c3aed' },
  { value: 'other', label: 'Other', icon: 'HelpCircle', color: '#6b7280' }
]

export const NodeBasedFixtureEditor: React.FC<NodeBasedFixtureEditorProps> = ({
  fixtureId,
  onClose
}) => {
  const { theme } = useTheme()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<FixtureNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [dragging, setDragging] = useState<{ nodeId: string; offset: { x: number; y: number } } | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [showChannelPalette, setShowChannelPalette] = useState(false)
  const { fixtures, dmxChannels, setDmxChannel, channelNames } = useStore(state => ({
    fixtures: state.fixtures,
    dmxChannels: state.dmxChannels,
    setDmxChannel: state.setDmxChannel,
    channelNames: state.channelNames
  }))

  // Helper function to update fixture
  const updateFixture = (id: string, updates: any) => {
    // This would typically use a store action, but for now we'll implement it directly
    useStore.setState(state => ({
      fixtures: state.fixtures.map(f => f.id === id ? { ...f, ...updates } : f)
    }))
  }

  // Helper function to set channel name
  const setChannelName = (channelIndex: number, name: string) => {
    useStore.setState(state => ({
      channelNames: state.channelNames.map((currentName, index) => 
        index === channelIndex ? name : currentName
      )
    }))
  }

  const currentFixture = fixtureId ? fixtures.find(f => f.id === fixtureId) : null

  // Automatic layout function - arranges nodes in a hierarchical layout
  const autoLayoutNodes = useCallback((nodesToLayout: FixtureNode[], connectionsToLayout: Connection[]) => {
    const fixtureNodes = nodesToLayout.filter(n => n.type === 'fixture')
    const channelNodes = nodesToLayout.filter(n => n.type === 'channel')
    const dmxNodes = nodesToLayout.filter(n => n.type === 'dmxOutput')

    const NODE_WIDTH = 200
    const NODE_HEIGHT = 120
    const COLUMN_SPACING = 400 // Increased spacing between columns for better visibility
    const ROW_SPACING = 200 // Increased spacing between rows
    const START_X = 150
    const START_Y = 150

    const layoutNodes: FixtureNode[] = []
    const nodeMap = new Map<string, FixtureNode>()

    // Column 1: Fixture node (left side) - centered vertically
    if (fixtureNodes.length > 0) {
      const totalHeight = Math.max(channelNodes.length, dmxNodes.length) * ROW_SPACING
      const centerY = START_Y + (totalHeight / 2) - (NODE_HEIGHT / 2)
      const fixtureNode = { ...fixtureNodes[0], position: { x: START_X, y: Math.max(START_Y, centerY) } }
      layoutNodes.push(fixtureNode)
      nodeMap.set(fixtureNode.id, fixtureNode)
    }

    // Build connection map for efficient lookup
    const channelToDmxMap = new Map<string, string>() // channelId -> dmxId
    connectionsToLayout.forEach(conn => {
      if (conn.from.startsWith('channel-') && conn.to.startsWith('dmx-')) {
        channelToDmxMap.set(conn.from, conn.to)
      }
    })

    // Sort DMX nodes by address for consistent ordering
    const sortedDmxNodes = [...dmxNodes].sort((a, b) => {
      const addrA = a.data.dmxAddress || 0
      const addrB = b.data.dmxAddress || 0
      return addrA - addrB
    })

    // Column 3: DMX Output nodes (right side) - arrange vertically first
    const dmxPositions = new Map<string, number>()
    sortedDmxNodes.forEach((node, index) => {
      const yPos = START_Y + (index * ROW_SPACING)
      dmxPositions.set(node.id, yPos)
      layoutNodes.push({
        ...node,
        position: { x: START_X + (COLUMN_SPACING * 2), y: yPos }
      })
      nodeMap.set(node.id, { ...node, position: { x: START_X + (COLUMN_SPACING * 2), y: yPos } })
    })

    // Column 2: Channel nodes (middle) - align with their connected DMX nodes
    channelNodes.forEach((node) => {
      const connectedDmxId = channelToDmxMap.get(node.id)
      let yPos = START_Y + (channelNodes.indexOf(node) * ROW_SPACING)
      
      // If connected to a DMX node, align with it
      if (connectedDmxId && dmxPositions.has(connectedDmxId)) {
        yPos = dmxPositions.get(connectedDmxId)!
      }

      layoutNodes.push({
        ...node,
        position: { x: START_X + COLUMN_SPACING, y: yPos }
      })
      nodeMap.set(node.id, { ...node, position: { x: START_X + COLUMN_SPACING, y: yPos } })
    })

    return layoutNodes
  }, [])

  // Initialize nodes from current fixture with automatic layout
  useEffect(() => {
    if (currentFixture) {
      const fixtureNode: FixtureNode = {
        id: 'fixture-main',
        type: 'fixture',
        position: { x: 100, y: 100 }, // Will be repositioned by autoLayout
        data: { name: currentFixture.name, fixtureId: currentFixture.id },
        connections: []
      }

      const channelNodes: FixtureNode[] = currentFixture.channels.map((channel, index) => ({
        id: `channel-${index}`,
        type: 'channel',
        position: { x: 0, y: 0 }, // Will be repositioned by autoLayout
        data: {
          name: channel.name,
          channelType: channel.type,
          channelIndex: index,
          fixtureId: currentFixture.id
        },
        connections: []
      }))

      const dmxNodes: FixtureNode[] = currentFixture.channels.map((channel, index) => {
        const dmxAddress = channel.dmxAddress || (currentFixture.startAddress + index)
        return {
          id: `dmx-${dmxAddress}`,
          type: 'dmxOutput',
          position: { x: 0, y: 0 }, // Will be repositioned by autoLayout
          data: {
            name: `DMX ${dmxAddress}`,
            dmxAddress: dmxAddress,
            value: dmxChannels[dmxAddress - 1] || 0
          },
          connections: []
        }
      })

      // Create connections
      const newConnections: Connection[] = currentFixture.channels.map((channel, index) => {
        const dmxAddress = channel.dmxAddress || (currentFixture.startAddress + index)
        return {
          id: `conn-${index}`,
          from: `channel-${index}`,
          to: `dmx-${dmxAddress}`,
          type: 'dmx'
        }
      })

      // Apply automatic layout
      const allNodes = [fixtureNode, ...channelNodes, ...dmxNodes]
      const laidOutNodes = autoLayoutNodes(allNodes, newConnections)

      setNodes(laidOutNodes)
      setConnections(newConnections)
    }
  }, [currentFixture, dmxChannels, autoLayoutNodes])

  const getChannelTypeInfo = (type: string) => {
    return CHANNEL_TYPES.find(ct => ct.value === type) || CHANNEL_TYPES[CHANNEL_TYPES.length - 1]
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        setDragging({
          nodeId,
          offset: {
            x: (e.clientX - rect.left) / zoom - node.position.x,
            y: (e.clientY - rect.top) / zoom - node.position.y
          }
        })
        setSelectedNode(nodeId)
        // Add dragging class to node for better visual feedback
        const nodeElement = e.currentTarget as HTMLElement
        nodeElement.classList.add('dragging')
      }
    }
  }, [nodes, zoom])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const newX = Math.max(0, (e.clientX - rect.left) / zoom - dragging.offset.x)
      const newY = Math.max(0, (e.clientY - rect.top) / zoom - dragging.offset.y)

      setNodes(prev => prev.map(node =>
        node.id === dragging.nodeId
          ? { ...node, position: { x: newX, y: newY } }
          : node
      ))
    }
  }, [dragging, zoom])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // Use global mouse events for smoother dragging
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  const addChannelNode = (channelType: string) => {
    const newIndex = nodes.filter(n => n.type === 'channel').length
    const newNode: FixtureNode = {
      id: `channel-${Date.now()}`,
      type: 'channel',
      position: { x: 0, y: 0 }, // Will be positioned by auto layout
      data: {
        name: `${getChannelTypeInfo(channelType).label} ${newIndex + 1}`,
        channelType: channelType,
        channelIndex: newIndex,
        fixtureId: currentFixture?.id
      },
      connections: []
    }

    setNodes(prev => {
      const updated = [...prev, newNode]
      // Apply auto layout after adding node
      const laidOut = autoLayoutNodes(updated, connections)
      return laidOut
    })
    setShowChannelPalette(false)
  }

  const addDmxOutputNode = (dmxAddress: number) => {
    const newNode: FixtureNode = {
      id: `dmx-${dmxAddress}`,
      type: 'dmxOutput',
      position: { x: 0, y: 0 }, // Will be positioned by auto layout
      data: {
        name: `DMX ${dmxAddress}`,
        dmxAddress: dmxAddress,
        value: dmxChannels[dmxAddress - 1] || 0
      },
      connections: []
    }

    setNodes(prev => {
      const updated = [...prev, newNode]
      // Apply auto layout after adding node
      const laidOut = autoLayoutNodes(updated, connections)
      return laidOut
    })
  }

  const handleConnection = (fromId: string, toId: string) => {
    const newConnection: Connection = {
      id: `conn-${Date.now()}`,
      from: fromId,
      to: toId,
      type: 'dmx'
    }

    setConnections(prev => [...prev, newConnection])
    setConnecting(null)
  }

  const handleNodeDoubleClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (node?.type === 'dmxOutput' && node.data.dmxAddress) {
      const newValue = prompt(`Set DMX Channel ${node.data.dmxAddress} value (0-255):`, node.data.value?.toString() || '0')
      if (newValue !== null) {
        const value = Math.max(0, Math.min(255, parseInt(newValue) || 0))
        setDmxChannel(node.data.dmxAddress - 1, value)
        
        setNodes(prev => prev.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, value } } : n
        ))
      }
    }
  }

  const saveFixtureFromNodes = () => {
    if (!currentFixture) return

    const channelNodes = nodes.filter(n => n.type === 'channel')
    const newChannels = channelNodes.map((node, index) => ({
      name: node.data.name || `Channel ${index + 1}`,
      type: node.data.channelType || 'other',
      dmxAddress: connections.find(c => c.from === node.id)?.to.replace('dmx-', '') 
        ? parseInt(connections.find(c => c.from === node.id)!.to.replace('dmx-', ''))
        : undefined
    }))

    updateFixture(currentFixture.id, {
      channels: newChannels
    })

    // Update channel names in DMX list
    connections.forEach(conn => {
      const channelNode = nodes.find(n => n.id === conn.from)
      const dmxNode = nodes.find(n => n.id === conn.to)
      
      if (channelNode && dmxNode && dmxNode.data.dmxAddress) {
        const channelName = `${currentFixture.name} - ${channelNode.data.name}`
        setChannelName(dmxNode.data.dmxAddress - 1, channelName)
      }
    })
  }

  const renderNode = (node: FixtureNode) => {
    const isSelected = selectedNode === node.id
    const typeInfo = node.data.channelType ? getChannelTypeInfo(node.data.channelType) : null

    return (
      <div
        key={node.id}
        className={`${styles.node} ${styles[node.type]} ${isSelected ? styles.selected : ''} ${dragging?.nodeId === node.id ? styles.dragging : ''}`}
        style={{
          left: node.position.x * zoom + viewOffset.x,
          top: node.position.y * zoom + viewOffset.y,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          willChange: dragging?.nodeId === node.id ? 'transform' : 'auto'
        }}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
        onDoubleClick={() => handleNodeDoubleClick(node.id)}
      >
        <div className={styles.nodeHeader}>
          {typeInfo && (
            <LucideIcon 
              name={typeInfo.icon as any} 
              className={styles.nodeIcon}
              style={{ color: typeInfo.color }}
            />
          )}
          <span className={styles.nodeName}>{node.data.name}</span>
          {node.type === 'dmxOutput' && (
            <span className={styles.dmxValue}>{node.data.value || 0}</span>
          )}
        </div>

        <div className={styles.nodeContent}>
          {node.type === 'fixture' && (
            <div className={styles.fixtureInfo}>
              <div>Channels: {nodes.filter(n => n.type === 'channel').length}</div>
              <div>Start: {currentFixture?.startAddress || 1}</div>
            </div>
          )}

          {node.type === 'channel' && (
            <div className={styles.channelInfo}>
              <div>Type: {typeInfo?.label || 'Other'}</div>
              <div>Index: {node.data.channelIndex !== undefined ? node.data.channelIndex + 1 : 'N/A'}</div>
            </div>
          )}

          {node.type === 'dmxOutput' && (
            <div className={styles.dmxInfo}>
              <div>Address: {node.data.dmxAddress}</div>
              <div className={styles.valueBar}>
                <div 
                  className={styles.valueBarFill}
                  style={{ 
                    width: `${((node.data.value || 0) / 255) * 100}%`,
                    backgroundColor: typeInfo?.color || '#4ade80'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Connection points */}
        <div className={styles.connectionPoints}>
          {node.type === 'fixture' && (
            <div className={`${styles.connectionPoint} ${styles.output}`} />
          )}
          {node.type === 'channel' && (
            <>
              <div className={`${styles.connectionPoint} ${styles.input}`} />
              <div className={`${styles.connectionPoint} ${styles.output}`} />
            </>
          )}
          {node.type === 'dmxOutput' && (
            <div className={`${styles.connectionPoint} ${styles.input}`} />
          )}
        </div>
      </div>
    )
  }

  const renderConnections = () => {
    return connections.map(conn => {
      const fromNode = nodes.find(n => n.id === conn.from)
      const toNode = nodes.find(n => n.id === conn.to)
      
      if (!fromNode || !toNode) return null

      // Calculate absolute positions
      const fromX = (fromNode.position.x + 100) * zoom + viewOffset.x
      const fromY = (fromNode.position.y + 60) * zoom + viewOffset.y // Center of node vertically
      const toX = (toNode.position.x) * zoom + viewOffset.x
      const toY = (toNode.position.y + 60) * zoom + viewOffset.y // Center of node vertically

      // Calculate SVG bounds
      const svgLeft = Math.min(fromX, toX) - 10 // Add padding
      const svgTop = Math.min(fromY, toY) - 10 // Add padding
      const svgWidth = Math.abs(toX - fromX) + 20 // Add padding
      const svgHeight = Math.abs(toY - fromY) + 20 // Add padding

      // Calculate relative coordinates within SVG
      const relFromX = fromX - svgLeft
      const relFromY = fromY - svgTop
      const relToX = toX - svgLeft
      const relToY = toY - svgTop

      // Calculate control point for bezier curve (midpoint with slight offset)
      const controlX = (relFromX + relToX) / 2
      const controlY = Math.min(relFromY, relToY) - 30 // Curve upward

      return (
        <svg
          key={conn.id}
          className={styles.connection}
          style={{
            position: 'absolute',
            left: svgLeft,
            top: svgTop,
            width: svgWidth,
            height: svgHeight,
            pointerEvents: 'none',
            zIndex: 1 // Ensure connections are behind nodes
          }}
        >
          <path
            d={`M ${relFromX} ${relFromY} Q ${controlX} ${controlY} ${relToX} ${relToY}`}
            stroke="#4ade80"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />
        </svg>
      )
    })
  }
  return (
    <div className={`${styles.editorContainer} ${selectedNode ? styles.hasDetailsPanel : ''}`}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <h2>{currentFixture?.name || 'New Fixture'} - Node Editor</h2>
        </div>
        
        <div className={styles.toolbarCenter}>
          <button
            className={styles.toolButton}
            onClick={() => {
              // Apply automatic layout to current nodes
              const laidOutNodes = autoLayoutNodes(nodes, connections)
              setNodes(laidOutNodes)
            }}
            title="Automatically arrange nodes for better visibility"
          >
            <LucideIcon name="LayoutGrid" />
            Auto Layout
          </button>
          
          <button
            className={styles.toolButton}
            onClick={() => setShowChannelPalette(!showChannelPalette)}
          >
            <LucideIcon name="Plus" />
            Add Channel
          </button>
          
          <button
            className={styles.toolButton}
            onClick={() => {
              const address = prompt('DMX Address (1-512):')
              if (address) {
                const num = parseInt(address)
                if (num >= 1 && num <= 512) {
                  addDmxOutputNode(num)
                  // Re-layout after adding node
                  setTimeout(() => {
                    const laidOutNodes = autoLayoutNodes([...nodes, {
                      id: `dmx-${num}`,
                      type: 'dmxOutput',
                      position: { x: 0, y: 0 },
                      data: {
                        name: `DMX ${num}`,
                        dmxAddress: num,
                        value: dmxChannels[num - 1] || 0
                      },
                      connections: []
                    }], connections)
                    setNodes(laidOutNodes)
                  }, 100)
                }
              }
            }}
          >
            <LucideIcon name="Radio" />
            Add DMX Output
          </button>
        </div>

        <div className={styles.toolbarRight}>
          <button className={styles.toolButton} onClick={saveFixtureFromNodes}>
            <LucideIcon name="Save" />
            Save Fixture
          </button>
          
          <button className={styles.toolButton} onClick={onClose}>
            <LucideIcon name="X" />
            Close
          </button>
        </div>
      </div>

      {/* Channel Palette */}
      {showChannelPalette && (
        <div className={styles.channelPalette}>
          <h3>Add Channel Type</h3>
          <div className={styles.channelGrid}>
            {CHANNEL_TYPES.map(type => (
              <button
                key={type.value}
                className={styles.channelTypeButton}
                style={{ borderColor: type.color }}
                onClick={() => addChannelNode(type.value)}
              >
                <LucideIcon name={type.icon as any} style={{ color: type.color }} />
                <span>{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className={styles.canvas}
      >
        {/* Render connections first so they appear behind nodes */}
        {renderConnections()}
        {/* Render nodes on top */}
        {nodes.map(renderNode)}
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className={styles.detailsPanel}>
          <h3>Node Details</h3>
          {(() => {
            const node = nodes.find(n => n.id === selectedNode)
            if (!node) return null

            return (
              <div className={styles.nodeDetails}>
                <div className={styles.detailRow}>
                  <label>Name:</label>
                  <input
                    type="text"
                    value={node.data.name}
                    onChange={(e) => {
                      setNodes(prev => prev.map(n =>
                        n.id === selectedNode
                          ? { ...n, data: { ...n.data, name: e.target.value } }
                          : n
                      ))
                    }}
                  />
                </div>

                {node.type === 'channel' && (
                  <div className={styles.detailRow}>
                    <label>Type:</label>
                    <select
                      value={node.data.channelType || 'other'}
                      onChange={(e) => {
                        setNodes(prev => prev.map(n =>
                          n.id === selectedNode
                            ? { ...n, data: { ...n.data, channelType: e.target.value } }
                            : n
                        ))
                      }}
                    >
                      {CHANNEL_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {node.type === 'dmxOutput' && (
                  <>
                    <div className={styles.detailRow}>
                      <label>DMX Address:</label>
                      <input
                        type="number"
                        min="1"
                        max="512"
                        value={node.data.dmxAddress || 1}
                        onChange={(e) => {
                          const newAddress = parseInt(e.target.value)
                          if (newAddress >= 1 && newAddress <= 512) {
                            setNodes(prev => prev.map(n =>
                              n.id === selectedNode
                                ? { 
                                    ...n, 
                                    data: { 
                                      ...n.data, 
                                      dmxAddress: newAddress,
                                      name: `DMX ${newAddress}`
                                    } 
                                  }
                                : n
                            ))
                          }
                        }}
                      />
                    </div>
                    
                    <div className={styles.detailRow}>
                      <label>Value:</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={node.data.value || 0}
                        onChange={(e) => {
                          const newValue = parseInt(e.target.value)
                          if (node.data.dmxAddress) {
                            setDmxChannel(node.data.dmxAddress - 1, newValue)
                          }
                          setNodes(prev => prev.map(n =>
                            n.id === selectedNode
                              ? { ...n, data: { ...n.data, value: newValue } }
                              : n
                          ))
                        }}
                      />
                      <span>{node.data.value || 0}</span>
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
