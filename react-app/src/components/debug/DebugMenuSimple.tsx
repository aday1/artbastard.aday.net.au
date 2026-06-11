import React from 'react';

interface DebugMenuProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ position = 'top-right' }) => {
  return (
    <div style={{
      position: 'fixed',
      top: position.includes('top') ? '10px' : 'auto',
      bottom: position.includes('bottom') ? '10px' : 'auto',
      left: position.includes('left') ? '10px' : 'auto',
      right: position.includes('right') ? '10px' : 'auto',
      zIndex: 9997,
      background: '#333',
      color: 'white',
      padding: '0.5rem',
      borderRadius: '4px',
      fontSize: '0.8rem'
    }}>
      🔧 Debug Menu (Temporarily Disabled)
    </div>
  );
};

export default DebugMenu;
