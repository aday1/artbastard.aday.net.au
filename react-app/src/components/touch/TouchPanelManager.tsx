import React, { useState } from 'react';
import { usePanels } from '../../context/PanelContext';

interface TouchPanelManagerProps {
  isVisible: boolean;
  onToggle: () => void;
}

export const TouchPanelManager: React.FC<TouchPanelManagerProps> = ({ 
  isVisible, 
  onToggle 
}) => {
  const { 
    layout, 
    saveLayout, 
    loadLayout, 
    getSavedLayouts, 
    addComponentToPanel,
    removeComponentFromPanel,
    updateSplitterPosition 
  } = usePanels();
  
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveLayoutName, setSaveLayoutName] = useState('');
  const [selectedPanel, setSelectedPanel] = useState<'external' | null>('external');

  const savedLayouts = getSavedLayouts();
  const externalComponents = layout.external?.components || [];

  const handleSaveLayout = () => {
    if (saveLayoutName.trim()) {
      saveLayout(saveLayoutName.trim());
      setSaveLayoutName('');
      setShowSaveDialog(false);
      alert(`Layout "${saveLayoutName}" saved successfully!`);
    }
  };

  const handleLoadLayout = (layoutName: string) => {
    if (confirm(`Load layout "${layoutName}"? This will replace current configuration.`)) {
      loadLayout(layoutName);
      alert(`Layout "${layoutName}" loaded successfully!`);
    }
  };

  const handleRemoveComponent = (componentId: string) => {
    if (selectedPanel && confirm('Remove this component?')) {
      removeComponentFromPanel(selectedPanel, componentId);
    }
  };

  const handleClearAll = () => {
    if (confirm('Remove all components from this panel?')) {
      externalComponents.forEach(comp => {
        removeComponentFromPanel('external', comp.id);
      });
    }
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(78, 205, 196, 0.8)',
          border: '2px solid rgba(78, 205, 196, 1)',
          color: '#ffffff',
          padding: '12px',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '20px',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          touchAction: 'manipulation',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
        title="Panel Manager"
      >
        ⚙️
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 999,
          touchAction: 'none'
        }}
        onClick={onToggle}
      />

      {/* Panel Manager Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '600px',
          maxHeight: '80vh',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          border: '2px solid rgba(78, 205, 196, 0.5)',
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          background: 'rgba(78, 205, 196, 0.1)',
          padding: '1rem',
          borderBottom: '1px solid rgba(78, 205, 196, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: 0,
            color: '#4ecdc4',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚙️ Touch Panel Manager
          </h2>
          <button
            onClick={onToggle}
            style={{
              background: 'transparent',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              touchAction: 'manipulation'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '1rem',
          overflow: 'auto',
          color: '#ffffff'
        }}>
          {/* Current Panel Status */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid rgba(78, 205, 196, 0.2)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#4ecdc4' }}>
              📱 Current Touch Panel
            </h3>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#cccccc' }}>
              Components: {externalComponents.length}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {externalComponents.map(comp => (
                <div
                  key={comp.id}
                  style={{
                    background: 'rgba(78, 205, 196, 0.2)',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    border: '1px solid rgba(78, 205, 196, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                >
                  {comp.title}
                  <button
                    onClick={() => handleRemoveComponent(comp.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ff6b6b',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      padding: '0',
                      touchAction: 'manipulation'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Actions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <button
              onClick={handleClearAll}
              disabled={externalComponents.length === 0}
              style={{
                background: externalComponents.length === 0 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(255, 107, 107, 0.2)',
                border: '1px solid rgba(255, 107, 107, 0.5)',
                color: externalComponents.length === 0 ? 'rgba(255, 255, 255, 0.5)' : '#ff6b6b',
                padding: '0.75rem',
                borderRadius: '6px',
                cursor: externalComponents.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                touchAction: 'manipulation'
              }}
            >
              🗑️ Clear All
            </button>

            <button
              onClick={() => setShowSaveDialog(true)}
              style={{
                background: 'rgba(78, 205, 196, 0.2)',
                border: '1px solid rgba(78, 205, 196, 0.5)',
                color: '#4ecdc4',
                padding: '0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                touchAction: 'manipulation'
              }}
            >
              💾 Save Layout
            </button>
          </div>

          {/* Save Layout Dialog */}
          {showSaveDialog && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.5)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              border: '1px solid rgba(78, 205, 196, 0.3)'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#4ecdc4' }}>Save Current Layout</h4>
              <input
                type="text"
                value={saveLayoutName}
                onChange={(e) => setSaveLayoutName(e.target.value)}
                placeholder="Enter layout name..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(78, 205, 196, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem'
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveLayout()}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleSaveLayout}
                  disabled={!saveLayoutName.trim()}
                  style={{
                    background: saveLayoutName.trim() 
                      ? 'rgba(78, 205, 196, 0.3)' 
                      : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(78, 205, 196, 0.5)',
                    color: saveLayoutName.trim() ? '#4ecdc4' : 'rgba(255, 255, 255, 0.5)',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: saveLayoutName.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.8rem',
                    touchAction: 'manipulation'
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setSaveLayoutName('');
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    touchAction: 'manipulation'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Saved Layouts */}
          {savedLayouts.length > 0 && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid rgba(78, 205, 196, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 0.75rem 0', color: '#4ecdc4' }}>
                📂 Saved Layouts
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: '0.5rem'
              }}>
                {savedLayouts.map(layoutName => (
                  <button
                    key={layoutName}
                    onClick={() => handleLoadLayout(layoutName)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      padding: '0.75rem 0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      textAlign: 'center',
                      touchAction: 'manipulation',
                      wordBreak: 'break-word'
                    }}
                  >
                    📄 {layoutName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Usage Instructions */}
          <div style={{
            background: 'rgba(46, 213, 115, 0.1)',
            padding: '1rem',
            borderRadius: '8px',
            marginTop: '1rem',
            border: '1px solid rgba(46, 213, 115, 0.3)'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#2ed573' }}>
              💡 Touch Panel Tips
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#cccccc' }}>
              <li>Drag components from main window to add to touch panel</li>
              <li>Use "Clear All" to remove all components at once</li>
              <li>Save layouts to quickly restore panel configurations</li>
              <li>Touch panel components are automatically optimized for touch</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};
