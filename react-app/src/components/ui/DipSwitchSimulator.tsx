import React, { useState, useEffect } from 'react';
import styles from './DipSwitchSimulator.module.scss';

export const DipSwitchSimulator: React.FC = () => {
  const [dmxAddress, setDmxAddress] = useState<number>(1);
  const [binaryRepresentation, setBinaryRepresentation] = useState<string>('');
  const [dipSwitches, setDipSwitches] = useState<boolean[]>(Array(10).fill(false));

  // Calculate binary representation and DIP switch positions
  useEffect(() => {
    if (dmxAddress >= 1 && dmxAddress <= 512) {
      // DMX addresses are 1-based, but we need 0-based for binary calculation
      const zeroBasedAddress = dmxAddress - 1;
      
      // Convert to 9-bit binary (DMX addresses 1-512 require 9 bits)
      const binary = zeroBasedAddress.toString(2).padStart(9, '0');
      setBinaryRepresentation(binary);
      
      // Set DIP switches (reverse order - DIP 1 is MSB, DIP 9 is LSB)
      const newDipSwitches = Array(10).fill(false);
      for (let i = 0; i < 9; i++) {
        newDipSwitches[i] = binary[8 - i] === '1';
      }
      setDipSwitches(newDipSwitches);
    }
  }, [dmxAddress]);

  const handleDmxAddressChange = (value: number) => {
    if (value >= 1 && value <= 512) {
      setDmxAddress(value);
    }
  };

  const handleDipSwitchToggle = (index: number) => {
    const newDipSwitches = [...dipSwitches];
    newDipSwitches[index] = !newDipSwitches[index];
    setDipSwitches(newDipSwitches);

    // Calculate new DMX address from DIP switches
    let newAddress = 0;
    for (let i = 0; i < 9; i++) {
      if (newDipSwitches[i]) {
        newAddress += Math.pow(2, i);
      }
    }
    setDmxAddress(newAddress + 1); // Convert back to 1-based
  };
  const getCommonAddresses = () => [
    { address: 1, description: 'First fixture', channels: '1-12' },
    { address: 13, description: '12-channel fixture #2', channels: '13-24' },
    { address: 25, description: '12-channel fixture #3', channels: '25-36' },
    { address: 37, description: '12-channel fixture #4', channels: '37-48' },
    { address: 49, description: '12-channel fixture #5', channels: '49-60' },
    { address: 61, description: '7-channel fixture #9', channels: '61-67' },
    { address: 100, description: 'Common starting point', channels: '100+' },
    { address: 200, description: 'Mid-range address', channels: '200+' },
    { address: 300, description: 'High-range address', channels: '300+' },
    { address: 512, description: 'Last possible address', channels: '512' },
  ];

  const getFixtureCalculations = () => [
    { channels: 3, name: 'RGB PAR', description: 'Red, Green, Blue' },
    { channels: 4, name: 'RGBW PAR', description: 'Red, Green, Blue, White' },
    { channels: 5, name: 'RGBWA PAR', description: 'Red, Green, Blue, White, Amber' },
    { channels: 7, name: 'Moving Head Basic', description: 'Pan, Tilt, Dimmer, R, G, B, Strobe' },
    { channels: 12, name: 'Moving Head Advanced', description: 'Pan, Tilt, Pan Fine, Tilt Fine, Speed, Dimmer, Strobe, R, G, B, Gobo, Prism' },
    { channels: 16, name: 'LED Wash', description: 'Master, R, G, B, W, A, UV, Strobe, Pan, Tilt, Zoom, Programs, Speed, etc.' },
  ];

  const calculateNextFixtureAddress = (currentAddress: number, channels: number) => {
    return currentAddress + channels;
  };
  return (
    <div className={styles.dipSimulator}>
      <div className={styles.inputSection}>
        <div className={styles.addressInput}>
          <label htmlFor="dmx-address">🎯 DMX Address:</label>
          <input
            id="dmx-address"
            type="number"
            min="1"
            max="512"
            value={dmxAddress}
            onChange={(e) => handleDmxAddressChange(parseInt(e.target.value) || 1)}
            className={styles.addressField}
            placeholder="1-512"
          />
          <span className={styles.addressInfo}>
            (Enter 1-512)
          </span>
        </div>

        <div className={styles.binaryDisplay}>
          <label>💻 Binary (9-bit):</label>
          <code className={styles.binaryCode}>
            {binaryRepresentation.split('').map((bit, index) => (
              <span 
                key={index} 
                className={bit === '1' ? styles.bitOn : styles.bitOff}
                title={`Bit ${8-index}: ${bit === '1' ? 'ON' : 'OFF'} (2^${8-index} = ${Math.pow(2, 8-index)})`}
              >
                {bit}
              </span>
            ))}
          </code>
          <span className={styles.binaryInfo}>
            MSB → LSB (Click bits to understand!)
          </span>
        </div>
      </div>

      <div className={styles.dipSwitchPanel}>
        <h5>🔧 DIP Switch Configuration</h5>
        <p className={styles.instructions}>
          Set these <strong>DIP switches to ON</strong> for DMX address <strong className={styles.currentAddress}>{dmxAddress}</strong>:
          <br />
          <span className={styles.switchInstructions}>
            ⬆️ = ON (Red) | ⬇️ = OFF (Gray) | Click to toggle each switch
          </span>
        </p>
          <div className={styles.dipSwitchGrid}>
          {dipSwitches.slice(0, 9).map((isOn, index) => (
            <div key={index} className={styles.dipSwitchItem}>
              <div className={styles.dipSwitchLabel}>
                DIP {index + 1}
              </div>
              <button
                className={`${styles.dipSwitch} ${isOn ? styles.on : styles.off}`}
                onClick={() => handleDipSwitchToggle(index)}
                title={`DIP ${index + 1}: ${isOn ? 'ON' : 'OFF'} (2^${index} = ${Math.pow(2, index)})`}
                aria-label={`DIP switch ${index + 1}, currently ${isOn ? 'ON' : 'OFF'}`}
              >
                <div className={styles.switchHandle}></div>
                <span className={styles.switchState}>
                  {isOn ? '⬆️' : '⬇️'}
                </span>
              </button>
              <div className={styles.dipSwitchValue}>
                2^{index} = {Math.pow(2, index)}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.calculation}>
          <h6>Calculation:</h6>
          <div className={styles.calculationSteps}>
            {dipSwitches.slice(0, 9).map((isOn, index) => (
              isOn && (
                <span key={index} className={styles.calculationTerm}>
                  2^{index} ({Math.pow(2, index)})
                </span>
              )
            )).filter(Boolean).length > 0 ? (
              <div>
                {dipSwitches.slice(0, 9).map((isOn, index) => (
                  isOn && (
                    <span key={index} className={styles.calculationTerm}>
                      {Math.pow(2, index)}
                      {index < dipSwitches.slice(0, 9).filter(Boolean).length - 1 ? ' + ' : ''}
                    </span>
                  )
                ))}
                <span className={styles.calculationResult}>
                  = {dmxAddress - 1} + 1 = <strong>{dmxAddress}</strong>
                </span>
              </div>
            ) : (
              <span className={styles.calculationResult}>
                All switches OFF = Address <strong>1</strong>
              </span>
            )}
          </div>
        </div>
      </div>      <div className={styles.commonAddresses}>
        <h6>🎯 Quick Address Presets</h6>
        <div className={styles.addressGrid}>
          {getCommonAddresses().map(({ address, description, channels }) => (
            <button
              key={address}
              className={`${styles.addressButton} ${address === dmxAddress ? styles.active : ''}`}
              onClick={() => handleDmxAddressChange(address)}
              title={`Set address to ${address} (Channels: ${channels})`}
            >
              <span className={styles.addressNumber}>{address}</span>
              <span className={styles.addressDesc}>{description}</span>
              <span className={styles.addressChannels}>Ch: {channels}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.helpSection}>
        <h6>💡 How DMX DIP Switches Work</h6>
        <div className={styles.helpGrid}>
          <div className={styles.helpCard}>
            <h6>📊 Binary Math Basics</h6>
            <ul className={styles.helpList}>
              <li><strong>Each DIP switch = 1 bit</strong> - ON = 1, OFF = 0</li>
              <li><strong>DIP 1 = 2^0 = 1</strong> - Least significant bit</li>
              <li><strong>DIP 9 = 2^8 = 256</strong> - Most significant bit</li>
              <li><strong>Formula:</strong> Add values of all ON switches + 1</li>
            </ul>
          </div>

          <div className={styles.helpCard}>
            <h6>🔧 DMX Addressing Rules</h6>
            <ul className={styles.helpList}>
              <li><strong>Address 1-512:</strong> Valid DMX universe range</li>
              <li><strong>Channel Planning:</strong> Each fixture uses multiple channels</li>
              <li><strong>No Overlap:</strong> Fixtures cannot share channels</li>
              <li><strong>Termination:</strong> Last fixture needs 120Ω terminator</li>
            </ul>
          </div>

          <div className={styles.helpCard}>
            <h6>⚡ Real-World Examples</h6>
            <ul className={styles.helpList}>
              <li><strong>Address 1:</strong> All switches OFF (default)</li>
              <li><strong>Address 2:</strong> Only DIP 1 ON (2^0 = 1, +1 = 2)</li>
              <li><strong>Address 5:</strong> DIP 1 + DIP 3 ON (1+4 = 5, +1 = 6)</li>
              <li><strong>Address 256:</strong> Only DIP 9 ON (2^8 = 256, +1 = 257)</li>
            </ul>
          </div>
        </div>

        <div className={styles.tipBox}>
          <h6>🚨 Pro Installation Tips</h6>
          <div className={styles.tipGrid}>
            <div className={styles.tip}>
              <span className={styles.tipIcon}>⚡</span>
              <span>Always power off before changing DIP switches</span>
            </div>
            <div className={styles.tip}>
              <span className={styles.tipIcon}>📖</span>
              <span>Check fixture manual - some use different numbering</span>
            </div>
            <div className={styles.tip}>
              <span className={styles.tipIcon}>📋</span>
              <span>Document your addressing scheme for troubleshooting</span>
            </div>
            <div className={styles.tip}>
              <span className={styles.tipIcon}>🔌</span>
              <span>Use quality DMX cables and connectors</span>
            </div>
            <div className={styles.tip}>
              <span className={styles.tipIcon}>🎯</span>
              <span>Plan addresses to avoid conflicts during expansion</span>
            </div>
            <div className={styles.tip}>
              <span className={styles.tipIcon}>🔍</span>
              <span>Test each fixture individually before show</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DipSwitchSimulator;
