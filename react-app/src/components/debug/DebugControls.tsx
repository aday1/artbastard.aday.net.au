import React, { useState } from 'react';
import { HorizontalFader } from '../ui/controls';

const DebugControls: React.FC = () => {
  const [frost, setFrost] = useState(0);
  const [animation, setAnimation] = useState(0);
  const [cto, setCto] = useState(127);
  const [ctb, setCtb] = useState(127);

  return (
    <div style={{
      padding: '20px',
      border: '2px solid red',
      margin: '10px',
      background: 'yellow'
    }}>
      <h3>DEBUG: Enhanced Controls Should Be Here</h3>

      <div style={{ marginTop: '10px' }}>
        <h4>Control Mode Buttons:</h4>
        <button style={{ margin: '5px', padding: '10px', background: 'blue', color: 'white' }}>
          Basic
        </button>
        <button style={{ margin: '5px', padding: '10px', background: 'green', color: 'white' }}>
          Advanced
        </button>
        <button style={{ margin: '5px', padding: '10px', background: 'purple', color: 'white' }}>
          Performance
        </button>
      </div>

      <div style={{ marginTop: '10px' }}>
        <h4>Toggle Buttons:</h4>
        <button style={{ margin: '5px', padding: '5px' }}>Color Wheel</button>
        <button style={{ margin: '5px', padding: '5px' }}>RGB Sliders</button>
        <button style={{ margin: '5px', padding: '5px' }}>Pro/Special</button>
      </div>

      <div style={{ marginTop: '10px', border: '1px solid green', padding: '10px' }}>
        <h4>Professional Controls:</h4>
        <div style={{ margin: '5px 0' }}>
          <label>Frost/Diffusion: </label>
          <HorizontalFader min={0} max={255} value={frost} onChange={(v) => setFrost(Math.round(v))} />
          <span> {frost}</span>
        </div>
        <div style={{ margin: '5px 0' }}>
          <label>Animation: </label>
          <HorizontalFader min={0} max={255} value={animation} onChange={(v) => setAnimation(Math.round(v))} />
          <span> {animation}</span>
        </div>
        <div style={{ margin: '5px 0' }}>
          <label>CTO: </label>
          <HorizontalFader min={0} max={255} value={cto} onChange={(v) => setCto(Math.round(v))} />
          <span> {cto}</span>
        </div>
        <div style={{ margin: '5px 0' }}>
          <label>CTB: </label>
          <HorizontalFader min={0} max={255} value={ctb} onChange={(v) => setCtb(Math.round(v))} />
          <span> {ctb}</span>
        </div>
        <div style={{ margin: '5px 0' }}>
          <button style={{ padding: '5px 10px', background: 'red', color: 'white' }}>
            Reset
          </button>
          <button style={{ padding: '5px 10px', background: 'orange', color: 'white', marginLeft: '5px' }}>
            Lamp OFF
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugControls;
