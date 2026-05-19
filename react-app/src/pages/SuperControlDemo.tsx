import React, { useState } from 'react';
import DockableSuperControl from '../components/fixtures/DockableSuperControl';
import TouchSuperControl from '../components/fixtures/TouchSuperControl';
import SuperControlTidyClean from '../components/fixtures/SuperControlTidyClean';
import { LucideIcon } from '../components/ui/LucideIcon';

/**
 * SuperControlDemo - Example showing how to integrate SuperControl variants
 * 
 * DockableSuperControl is perfect for:
 * - Main UI panels that can be docked to edges
 * - Desktop/mouse interactions
 * - Multi-window setups
 * - Collapsible panel interfaces
 * 
 * TouchSuperControl is perfect for:
 * - Touchscreen interfaces
 * - Tablet/phone control surfaces
 * - Fullscreen touch experiences
 * - Simplified, gesture-based control
 * 
 * SuperControlTidyClean is perfect for:
 * - Organized, professional control interface
 * - Complete DMX channel visibility
 * - Full MIDI Learn/OSC integration
 * - Touch-optimized with all controls
 */

const SuperControlDemo: React.FC = () => {
  const [showDockable, setShowDockable] = useState(true);
  const [showTouch, setShowTouch] = useState(false);
  const [showTidy, setShowTidy] = useState(true);
  const [touchSelectionCount, setTouchSelectionCount] = useState(0);

  const handleTouchSelectionChange = (count: number) => {
    setTouchSelectionCount(count);
  };

  return (
    <div style={{ 
      padding: '20px', 
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      minHeight: '100vh',
      color: '#ffffff'
    }}>
      <h1 style={{ 
        color: '#00d4ff', 
        textAlign: 'center', 
        marginBottom: '30px',
        fontSize: '2.5rem'
      }}>
        Super Control Demo
      </h1>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '30px',
        marginBottom: '40px'
      }}>
        
        {/* Dockable Control Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(0, 212, 255, 0.3)'
        }}>
          <h2 style={{ color: '#00d4ff', marginBottom: '16px' }}>
            <LucideIcon name="Layout" style={{ marginRight: '8px' }} />
            Dockable Super Control
          </h2>
          <p style={{ marginBottom: '20px', opacity: 0.8 }}>
            Traditional desktop control interface with dockable panels. Perfect for main application 
            window with collapsible sections and clean organization.
          </p>
          
          <h3 style={{ color: '#00d4ff', fontSize: '1.1rem', marginBottom: '12px' }}>Features:</h3>
          <ul style={{ marginBottom: '20px', opacity: 0.8 }}>
            <li>• Dockable to window edges</li>
            <li>• Collapsible control sections</li>
            <li>• Desktop-optimized interactions</li>
            <li>• Compact for multi-window setups</li>
          </ul>

          <button
            onClick={() => setShowDockable(!showDockable)}
            style={{
              padding: '12px 24px',
              background: showDockable ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            <LucideIcon name={showDockable ? "EyeOff" : "Eye"} style={{ marginRight: '8px' }} />
            {showDockable ? 'Hide' : 'Show'} Dockable Control
          </button>
        </div>

        {/* Touch Control Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(255, 193, 7, 0.3)'
        }}>
          <h2 style={{ color: '#ffc107', marginBottom: '16px' }}>
            <LucideIcon name="Smartphone" style={{ marginRight: '8px' }} />
            Touch Super Control
          </h2>
          <p style={{ marginBottom: '20px', opacity: 0.8 }}>
            Full-screen touch interface optimized for touch screens and tablets. 
            Features gesture controls and large touch targets.
          </p>
          
          <h3 style={{ color: '#ffc107', fontSize: '1.1rem', marginBottom: '12px' }}>Features:</h3>
          <ul style={{ marginBottom: '20px', opacity: 0.8 }}>
            <li>• Full-screen touch interface</li>
            <li>• Gesture-based controls</li>
            <li>• Haptic feedback support</li>
            <li>• Auto-hiding interface</li>
            <li>• Real-time selection count: {touchSelectionCount}</li>
          </ul>

          <button
            onClick={() => setShowTouch(!showTouch)}
            style={{
              padding: '12px 24px',
              background: showTouch ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            <LucideIcon name={showTouch ? "EyeOff" : "Eye"} style={{ marginRight: '8px' }} />
            {showTouch ? 'Hide' : 'Show'} Touch Control
          </button>
        </div>

        {/* Tidy SuperControl Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid rgba(0, 255, 136, 0.3)'
        }}>
          <h2 style={{ color: '#00ff88', marginBottom: '16px' }}>
            <LucideIcon name="Grid3X3" style={{ marginRight: '8px' }} />
            Tidy SuperControl
          </h2>
          <p style={{ marginBottom: '20px', opacity: 0.8 }}>
            Clean, organized control interface with all missing controls added. Features comprehensive 
            DMX channel display, complete MIDI/OSC integration, and improved UI organization.
          </p>
          
          <h3 style={{ color: '#00ff88', fontSize: '1.1rem', marginBottom: '12px' }}>New Features:</h3>
          <ul style={{ marginBottom: '20px', opacity: 0.8 }}>
            <li>✅ All missing controls: Frost, Macro, Speed, Gobo Rotation</li>
            <li>✅ DMX channel display for every slider</li>
            <li>✅ Organized panels: Basic, Pan/Tilt, Color, Beam, Effects</li>
            <li>✅ Extended color channels: Red, Green, Blue, White, Amber, UV</li>
            <li>✅ Complete MIDI Learn/Forget on all controls</li>
            <li>✅ OSC address configuration for all sliders</li>
            <li>✅ Touch-optimized interface with large sliders</li>
            <li>✅ Panel visibility toggles and layout switching</li>
          </ul>

          <button
            onClick={() => setShowTidy(!showTidy)}
            style={{
              padding: '12px 24px',
              background: showTidy ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            <LucideIcon name={showTidy ? "EyeOff" : "Eye"} style={{ marginRight: '8px' }} />
            {showTidy ? 'Hide' : 'Show'} Tidy SuperControl
          </button>
        </div>
      </div>

      {/* Usage Examples */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        marginBottom: '30px'
      }}>
        <h2 style={{ color: '#00d4ff', marginBottom: '20px' }}>
          <LucideIcon name="Code" style={{ marginRight: '8px' }} />
          Usage Examples
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#00d4ff', marginBottom: '12px' }}>DockableSuperControl</h3>
            <pre style={{ 
              background: 'rgba(0, 0, 0, 0.3)', 
              padding: '16px', 
              borderRadius: '8px',
              fontSize: '0.8rem',
              overflow: 'auto'
            }}>
{`<DockableSuperControl
  initialDockSide="right"
  enableGridMode={true}
  showVolumeControl={true}
  enableAutopilot={true}
/>`}
            </pre>
          </div>

          <div>
            <h3 style={{ color: '#ffc107', marginBottom: '12px' }}>TouchSuperControl</h3>
            <pre style={{ 
              background: 'rgba(0, 0, 0, 0.3)', 
              padding: '16px', 
              borderRadius: '8px',
              fontSize: '0.8rem',
              overflow: 'auto'
            }}>
{`<TouchSuperControl
  isFullscreen={true}
  enableHapticFeedback={true}
  autoHideInterface={false}
  onSelectionChange={handleChange}
/>`}
            </pre>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ color: '#00ff88', marginBottom: '12px' }}>SuperControlTidyClean</h3>
          <pre style={{ 
            background: 'rgba(0, 0, 0, 0.3)', 
            padding: '16px', 
            borderRadius: '8px',
            fontSize: '0.8rem',
            overflow: 'auto'
          }}>
{`<SuperControlTidyClean
  isDockable={false}
  // Features all controls with DMX channel display
  // Complete MIDI Learn and OSC address support
  // Touch-optimized with organized panel layout
/>`}
          </pre>
        </div>
      </div>

      {/* Integration Notes */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        marginBottom: '30px'
      }}>
        <h2 style={{ color: '#00d4ff', marginBottom: '20px' }}>
          <LucideIcon name="Info" style={{ marginRight: '8px' }} />
          Integration Notes
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h3 style={{ color: '#00d4ff', marginBottom: '12px' }}>Best Practices</h3>
            <ul style={{ opacity: 0.8 }}>
              <li>• Use DockableSuperControl for main application windows</li>
              <li>• Use TouchSuperControl for external touch displays</li>
              <li>• Use SuperControlTidyClean for professional lighting control</li>
              <li>• All components share the same store state</li>
              <li>• Can be used simultaneously without conflicts</li>
            </ul>
          </div>

          <div>
            <h3 style={{ color: '#00d4ff', marginBottom: '12px' }}>State Management</h3>
            <ul style={{ opacity: 0.8 }}>
              <li>• All controls use the same Zustand store</li>
              <li>• Real-time synchronization between interfaces</li>
              <li>• Fixture selection is shared across components</li>
              <li>• DMX values update in real-time</li>
              <li>• MIDI and OSC mappings are persistent</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Component Renders */}      {showDockable && (
        <DockableSuperControl
          initialPosition={{ zone: 'right-center' }}
          isCollapsed={false}
          showMinimizeButton={true}
        />
      )}

      {showTouch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.95)'
        }}>
          <button
            onClick={() => setShowTouch(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 1001,
              background: 'rgba(220, 53, 69, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            <LucideIcon name="X" />
          </button>
          <TouchSuperControl
            isFullscreen={true}
            enableHapticFeedback={true}
            autoHideInterface={false}
            onSelectionChange={handleTouchSelectionChange}
          />
        </div>
      )}

      {showTidy && (
        <SuperControlTidyClean
          isDockable={false}
        />
      )}
    </div>
  );
};

export default SuperControlDemo;
