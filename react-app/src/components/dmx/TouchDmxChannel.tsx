import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';

export interface TouchDmxChannelProps {
  index: number;
  value: number;
  onValueChange: (index: number, value: number) => void;
  isSelected: boolean;
  onToggleSelection: (index: number) => void;
  name?: string;
}

export const TouchDmxChannel: React.FC<TouchDmxChannelProps> = ({
  index,
  value,
  onValueChange,
  isSelected,
  onToggleSelection,
  name
}) => {
  const { getChannelInfo, getFixtureColor, isChannelAssigned } = useStore();
  const [localValue, setLocalValue] = useState(value);
  
  // Get fixture info using store helper functions
  const fixtureInfo = getChannelInfo(index);
  const hasFixtureAssignment = isChannelAssigned(index);
  const fixtureColor = fixtureInfo ? getFixtureColor(fixtureInfo.fixtureId) : '#64748b';

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    setLocalValue(newValue);
    onValueChange(index, newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(255, localValue + 1);
    setLocalValue(newValue);
    onValueChange(index, newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(0, localValue - 1);
    setLocalValue(newValue);
    onValueChange(index, newValue);
  };

  const handleBigIncrement = () => {
    const newValue = Math.min(255, localValue + 10);
    setLocalValue(newValue);
    onValueChange(index, newValue);
  };

  const handleBigDecrement = () => {
    const newValue = Math.max(0, localValue - 10);
    setLocalValue(newValue);
    onValueChange(index, newValue);
  };

  const channelName = name || `Ch ${index + 1}`;
  const intensity = (localValue / 255) * 100;
  
  // Determine border color based on fixture assignment
  const borderColor = hasFixtureAssignment 
    ? fixtureColor 
    : (isSelected ? 'rgba(78, 205, 196, 0.6)' : 'rgba(255, 255, 255, 0.15)');
  
  return (
    <div
      className="card card-interactive"
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(78, 205, 196, 0.08))'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
        border: `2px solid ${borderColor}`,
        borderLeftWidth: hasFixtureAssignment ? '4px' : '2px',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        minHeight: '200px',
        minWidth: '140px',
        position: 'relative',
        transition: 'all var(--transition-normal)',
        touchAction: 'manipulation',
        color: 'var(--color-text-primary)',
        backdropFilter: 'blur(15px)',
        boxShadow: isSelected
          ? '0 8px 32px rgba(78, 205, 196, 0.25)'
          : '0 4px 16px rgba(0, 0, 0, 0.1)'
      }}
    >      {/* Channel Header */}
      <div
        className="touch-target"
        onClick={() => onToggleSelection(index)}
        style={{
          width: '100%',
          textAlign: 'center',
          cursor: 'pointer',
          padding: 'var(--space-sm)',
          borderRadius: 'var(--radius-md)',
          background: isSelected ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          border: `1px solid ${isSelected ? 'rgba(78, 205, 196, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
          touchAction: 'manipulation',
          transition: 'all var(--transition-fast)'
        }}
      >
        {hasFixtureAssignment && (
          <div style={{
            fontSize: '9px',
            fontWeight: '700',
            padding: '2px 6px',
            borderRadius: '3px',
            backgroundColor: fixtureColor,
            color: 'white',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
            display: 'inline-block'
          }}>
            {fixtureInfo?.fixtureName}
          </div>
        )}
        <div style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--font-semibold)',
          color: isSelected ? 'var(--color-dmx-selected)' : 'var(--color-text-primary)',
          marginBottom: 'var(--space-xs)'
        }}>
          {hasFixtureAssignment ? fixtureInfo?.channelName : channelName}
        </div>
        {hasFixtureAssignment && (
          <div style={{
            fontSize: '8px',
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            {fixtureInfo?.channelType}
          </div>
        )}
        <div style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-bold)',
          color: localValue > 0 ? 'var(--color-dmx-value)' : 'var(--color-text-disabled)'
        }}>
          {localValue}
        </div>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-tertiary)'
        }}>
          {intensity.toFixed(1)}%
        </div>
      </div>

      {/* Fine Control Buttons (+10 / -10) */}
      <div className="grid grid-cols-2 gap-sm" style={{ width: '100%' }}>
        <button
          className="btn btn-danger touch-target"
          onMouseDown={handleBigDecrement}
          onTouchStart={handleBigDecrement}
          style={{
            background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(231, 76, 60, 0.3))',
            border: '2px solid rgba(231, 76, 60, 0.4)',
            color: 'var(--color-error-500)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
            touchAction: 'manipulation',
            transition: 'all var(--transition-fast)'
          }}
        >
          -10
        </button>
        <button
          className="btn btn-success touch-target"
          onMouseDown={handleBigIncrement}
          onTouchStart={handleBigIncrement}
          style={{
            background: 'linear-gradient(135deg, rgba(46, 213, 115, 0.2), rgba(46, 213, 115, 0.3))',
            border: '2px solid rgba(46, 213, 115, 0.4)',
            color: 'var(--color-success-500)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
            touchAction: 'manipulation',
            transition: 'all var(--transition-fast)'
          }}
        >
          +10
        </button>
      </div>

      {/* Main Slider */}
      <div className="flex flex-col items-center justify-center gap-sm" style={{
        flex: 1,
        width: '100%'
      }}>
        <input
          type="range"
          min="0"
          max="255"
          value={localValue}
          onChange={handleSliderChange}
          className="slider slider-touch"
          style={{
            width: '100%',
            background: `linear-gradient(to right, var(--color-dmx-value) 0%, var(--color-dmx-value) ${(localValue / 255) * 100}%, var(--color-border) ${(localValue / 255) * 100}%, var(--color-border) 100%)`,
            outline: 'none',
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitAppearance: 'none',
            appearance: 'none',
            borderRadius: 'var(--radius-full)',
            border: '2px solid var(--color-border)'
          }}
        />
      </div>

      {/* Precise Control Buttons (+1 / -1) */}
      <div className="grid grid-cols-2 gap-sm" style={{ width: '100%' }}>
        <button
          className="btn btn-secondary btn-sm touch-target"
          onMouseDown={handleDecrement}
          onTouchStart={handleDecrement}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(255, 193, 7, 0.3))',
            border: '2px solid rgba(255, 193, 7, 0.4)',
            color: 'var(--color-warning-500)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
            touchAction: 'manipulation',
            transition: 'all var(--transition-fast)'
          }}
        >
          -1
        </button>
        <button
          className="btn btn-secondary btn-sm touch-target"
          onMouseDown={handleIncrement}
          onTouchStart={handleIncrement}
          style={{
            background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.3))',
            border: '2px solid rgba(78, 205, 196, 0.4)',
            color: 'var(--color-dmx-value)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-bold)',
            touchAction: 'manipulation',
            transition: 'all var(--transition-fast)'
          }}
        >
          +1
        </button>
      </div>
    </div>
  );
};

// Basic CSS for .touch-dmx-slider (can be moved to a global CSS file or <style> tag)
// This is a minimal example; more specific styling might be needed.
/*
.touch-dmx-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 30px;
  height: 60px;
  background: #4ecdc4;
  cursor: pointer;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.5);
}

.touch-dmx-slider::-moz-range-thumb {
  width: 30px;
  height: 56px; // Firefox might need slightly different height due to border
  background: #4ecdc4;
  cursor: pointer;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.5);
}

.touch-dmx-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 20px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.3);
}

.touch-dmx-slider::-moz-range-track {
 width: 100%;
  height: 20px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.3);
}
*/
