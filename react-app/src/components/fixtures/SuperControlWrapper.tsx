import React from 'react';
import SuperControlTidyClean from './SuperControlTidyClean';
import SuperControlFallback from './SuperControlFallback';

interface SuperControlProps {
  isDockable?: boolean;
}

// Use the cleaner implementation as the primary component
const SuperControlMain = SuperControlTidyClean;
const hasMainComponentError = false;

const SuperControlWrapper: React.FC<SuperControlProps> = (props) => {
  // Check if user wants to force fallback mode
  const forceFallback = localStorage.getItem('supercontrol-force-fallback') === 'true';
  
  if (hasMainComponentError || forceFallback) {
    if (SuperControlFallback) {
      return <SuperControlFallback {...props} />;
    } else {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#d63031' }}>
          <h3>SuperControl Unavailable</h3>
          <p>Both main and fallback components failed to load. Please refresh the page.</p>
        </div>
      );
    }
  }
  
  if (SuperControlMain) {
    return <SuperControlMain {...props} />;
  }
  
  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#d63031' }}>
      <h3>SuperControl Loading Error</h3>
      <p>Component failed to load. Please refresh the page.</p>
    </div>
  );
};

export default SuperControlWrapper;
