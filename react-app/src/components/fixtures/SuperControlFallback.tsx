import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { exportSuperControlToToscFile } from '../../utils/touchoscExporter';

interface SuperControlProps {
  isDockable?: boolean;
}

const SuperControlFallback: React.FC<SuperControlProps> = ({ isDockable = false }) => {
  return (
    <div style={{ padding: '20px', textAlign: 'center', border: '2px solid #ff6b6b', borderRadius: '8px', backgroundColor: '#fff5f5' }}>
      <h3 style={{ color: '#d63031', marginBottom: '16px' }}>
        <LucideIcon name="AlertTriangle" />
        SuperControl Temporarily Unavailable
      </h3>
      <p style={{ marginBottom: '16px', color: '#636e72' }}>
        The SuperControl component is undergoing maintenance. Basic functionality is available below.
      </p>
      
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button 
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#0984e3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={async () => {
            const result = await exportSuperControlToToscFile({
              resolution: 'tablet_portrait',
              includeBasicControls: true,
              includePanTilt: true,
              includeColorWheel: true,
              includeXYPad: true,
              includeEffects: true,
              includeAutopilot: true,
              includeQuickActions: true,
              includeSceneControls: true,
              includeNavigation: true,
            });
            alert(result.success ? 'TouchOSC export successful!' : `Export failed: ${result.message}`);
          }}
        >
          <LucideIcon name="Download" />
          Export TouchOSC
        </button>
        
        <button 
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#6c5ce7', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          onClick={() => {
            const helpButton = document.querySelector('[title*="Show ArtBastard Help"]') as HTMLElement;
            if (helpButton) {
              helpButton.click();
            } else {
              alert('Press Ctrl+H to open Help and see OSC address reference in OSC Control tab');
            }
          }}
        >
          <LucideIcon name="HelpCircle" />
          View OSC Addresses
        </button>
      </div>
      
      <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#e8f4f8', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#2d3436' }}>
          <strong>Quick Access:</strong> OSC addresses are displayed next to each control. 
          Press <kbd>Ctrl+H</kbd> to view complete OSC reference in Help → OSC Control tab.
        </p>
      </div>
    </div>
  );
};

export default SuperControlFallback;
