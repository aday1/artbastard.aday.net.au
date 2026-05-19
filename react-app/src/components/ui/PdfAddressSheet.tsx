import React, { useState, useEffect } from 'react';
import styles from './PdfAddressSheet.module.scss';
import { useStore } from '../../store';
import useStoreUtils from '../../store/storeUtils';
import { LucideIcon } from './LucideIcon';

interface FixtureEntry {
  id: string;
  name: string;
  type: string;
  startAddress: number;
  channelCount: number;
  endAddress: number;
  notes: string;
  manufacturer?: string;
}

interface AddressConflict {
  fixture1: string;
  fixture2: string;
  range1: string;
  range2: string;
}

export const PdfAddressSheet: React.FC = () => {
  const [fixtures, setFixtures] = useState<FixtureEntry[]>([]);
  const [conflicts, setConflicts] = useState<AddressConflict[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateNameToSave, setTemplateNameToSave] = useState('');
  
  // Get store data and actions
  const { fixtures: storeFixtures, fixtureTemplates, addFixtureTemplate } = useStore(state => ({
    fixtures: state.fixtures,
    fixtureTemplates: state.fixtureTemplates,
    addFixtureTemplate: state.addFixtureTemplate
  }));

  // Manufacturer dropdown options (same as FixtureSetup)
  const [manufacturers, setManufacturers] = useState<string[]>(() => {
    const stored = localStorage.getItem('fixtureManufacturers');
    return stored ? JSON.parse(stored) : ['uKing', 'Chauvet', 'Martin', 'Clay Paky', 'Elation', 'American DJ', 'ADJ'];
  });

  // Get fixture types from library templates
  const getFixtureTypesFromLibrary = () => {
    const types = new Map<string, { channels: number; description: string }>();
    
    // Add library templates
    fixtureTemplates.forEach(template => {
      const channelCount = template.modes?.[0]?.channels || template.channels?.length || 1;
      if (!types.has(template.templateName)) {
        types.set(template.templateName, {
          channels: channelCount,
          description: template.type || template.templateName
        });
      }
    });
    
    // Add basic types
    types.set('Custom', { channels: 1, description: 'Custom fixture definition' });
    
    return Array.from(types.entries()).map(([name, data]) => ({
      name,
      channels: data.channels,
      description: data.description
    }));
  };

  const fixtureTypes = getFixtureTypesFromLibrary();
  // Initialize with existing fixtures from the store and sync when store changes
  useEffect(() => {
    const existingFixtures: FixtureEntry[] = storeFixtures.map((fixture, index) => ({
      id: fixture.id || `existing-${index}`,
      name: fixture.name || `Fixture ${index + 1}`,
      type: fixture.type || 'Custom',
      startAddress: fixture.startAddress || 1,
      channelCount: fixture.channels.length,
      endAddress: (fixture.startAddress || 1) + fixture.channels.length - 1,
      notes: fixture.notes || '',
      manufacturer: fixture.manufacturer || ''
    }));
    setFixtures(existingFixtures);
  }, [storeFixtures]);

  // Check for address conflicts
  useEffect(() => {
    const newConflicts: AddressConflict[] = [];
    
    for (let i = 0; i < fixtures.length; i++) {
      for (let j = i + 1; j < fixtures.length; j++) {
        const fixture1 = fixtures[i];
        const fixture2 = fixtures[j];
        
        // Check if address ranges overlap
        const f1Start = fixture1.startAddress;
        const f1End = fixture1.endAddress;
        const f2Start = fixture2.startAddress;
        const f2End = fixture2.endAddress;
        
        if ((f1Start <= f2End && f1End >= f2Start)) {
          newConflicts.push({
            fixture1: fixture1.name,
            fixture2: fixture2.name,
            range1: `${f1Start}-${f1End}`,
            range2: `${f2Start}-${f2End}`
          });
        }
      }
    }
    
    setConflicts(newConflicts);
  }, [fixtures]);

  const addFixture = () => {
    // Calculate next available address
    const maxEndAddress = fixtures.reduce((max, fixture) => 
      Math.max(max, fixture.endAddress), 0);
    
    const newFixture: FixtureEntry = {
      id: `fixture-${Date.now()}`,
      name: `Fixture ${fixtures.length + 1}`,
      type: 'RGB PAR',
      startAddress: maxEndAddress + 1,
      channelCount: 3,
      endAddress: maxEndAddress + 3,
      notes: ''
    };
    
    setFixtures([...fixtures, newFixture]);
  };

  const updateFixture = (id: string, updates: Partial<FixtureEntry>) => {
    setFixtures(fixtures.map(fixture => {
      if (fixture.id === id) {
        const updated = { ...fixture, ...updates };
        // Recalculate end address when start address or channel count changes
        if (updates.startAddress !== undefined || updates.channelCount !== undefined) {
          updated.endAddress = updated.startAddress + updated.channelCount - 1;
        }
        return updated;
      }
      return fixture;
    }));
  };

  const deleteFixture = (id: string) => {
    setFixtures(fixtures.filter(fixture => fixture.id !== id));
  };

  const applyTemplate = (id: string, templateName: string, customChannelCount?: number) => {
    const template = fixtureTypes.find(t => t.name === templateName);
    if (template) {
      updateFixture(id, {
        type: template.name,
        channelCount: customChannelCount !== undefined ? customChannelCount : template.channels
      });
    } else if (templateName === 'Custom') {
      updateFixture(id, {
        type: 'Custom',
        channelCount: customChannelCount || 1
      });
    }
  };

  const addCustomManufacturer = (value: string) => {
    if (value && !manufacturers.includes(value)) {
      const updated = [...manufacturers, value];
      setManufacturers(updated);
      localStorage.setItem('fixtureManufacturers', JSON.stringify(updated));
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Type', 'Manufacturer', 'Start Address', 'End Address', 'Channel Count', 'Notes'];
    const rows = fixtures.map(f => [
      f.name,
      f.type,
      f.manufacturer || '',
      f.startAddress.toString(),
      f.endAddress.toString(),
      f.channelCount.toString(),
      f.notes
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dmx-address-sheet.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printSheet = () => {
    window.print();
  };  const syncToArtBastard = (saveAsTemplate: boolean = false, templateName?: string) => {
    // Convert our fixture entries back to store format
    const convertedFixtures = fixtures.map(fixture => {
      // Try to find matching template from library to get channel definitions
      const matchingTemplate = fixtureTemplates.find(t => 
        t.templateName === fixture.type || t.type === fixture.type
      );
      
      let channels;
      if (matchingTemplate && matchingTemplate.modes?.[0]?.channelData) {
        // Use template channel data if available
        const templateChannels = matchingTemplate.modes[0].channelData;
        channels = Array.from({ length: fixture.channelCount }, (_, index) => {
          if (index < templateChannels.length) {
            return templateChannels[index];
          }
          return { name: `Channel ${index + 1}`, type: 'dimmer' };
        });
      } else if (matchingTemplate?.channels) {
        // Use template channels array
        channels = Array.from({ length: fixture.channelCount }, (_, index) => {
          if (index < matchingTemplate.channels!.length) {
            return matchingTemplate.channels![index];
          }
          return { name: `Channel ${index + 1}`, type: 'dimmer' };
        });
      } else {
        // Default channel names
        channels = Array.from({ length: fixture.channelCount }, (_, index) => ({
          name: `Channel ${index + 1}`,
          type: 'dimmer'
        }));
      }

      return {
        id: fixture.id,
        name: fixture.name,
        type: fixture.type,
        manufacturer: fixture.manufacturer,
        startAddress: fixture.startAddress,
        channels,
        notes: fixture.notes
      };
    });

    // Update the store using storeUtils
    useStoreUtils.setState(state => ({
      fixtures: convertedFixtures
    }));

    // Save as template if requested
    if (saveAsTemplate && templateName) {
      // Create template from first fixture (or combine all)
      const firstFixture = convertedFixtures[0];
      if (firstFixture) {
        const newTemplate = {
          id: `template-${Date.now()}`,
          templateName: templateName,
          defaultNamePrefix: firstFixture.name.split(' ')[0] || 'Fixture',
          type: firstFixture.type,
          manufacturer: firstFixture.manufacturer,
          channels: firstFixture.channels,
          isBuiltIn: false,
          isCustom: true,
          isFavorite: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        addFixtureTemplate(newTemplate);
        
        useStoreUtils.getState().addNotification({
          message: `Saved "${templateName}" as fixture template`,
          type: 'success',
          priority: 'normal'
        });
      }
    }

    // Show success message
    useStoreUtils.getState().addNotification({
      message: `Synced ${fixtures.length} fixtures to ArtBastard DMX system`,
      type: 'success',
      priority: 'normal'
    });
  };

  const handleSyncWithTemplateOption = () => {
    if (fixtures.length > 0) {
      setShowSaveTemplateDialog(true);
    } else {
      syncToArtBastard();
    }
  };

  const generatePDF = () => {
    // Create a printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DMX Address Sheet - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .conflict { background-color: #ffebee; }
          .summary { margin-top: 20px; font-weight: bold; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>DMX512 Address Sheet</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Fixtures:</strong> ${fixtures.length} | <strong>Total Channels:</strong> ${fixtures.reduce((sum, f) => sum + f.channelCount, 0)} | <strong>Conflicts:</strong> ${conflicts.length}</p>
        
        <table>
          <thead>
            <tr>
              <th>Fixture Name</th>
              <th>Type</th>
              <th>Manufacturer</th>
              <th>Start Address</th>
              <th>End Address</th>
              <th>Channel Count</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${fixtures.map(fixture => {
              const isConflict = conflicts.some(c => 
                c.fixture1 === fixture.name || c.fixture2 === fixture.name
              );
              return `
                <tr${isConflict ? ' class="conflict"' : ''}>
                  <td>${fixture.name}</td>
                  <td>${fixture.type}</td>
                  <td>${fixture.manufacturer || ''}</td>
                  <td>${fixture.startAddress}</td>
                  <td>${fixture.endAddress}</td>
                  <td>${fixture.channelCount}</td>
                  <td>${fixture.notes}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        
        ${conflicts.length > 0 ? `
          <div class="summary">
            <h3>Address Conflicts:</h3>
            <ul>
              ${conflicts.map(conflict => 
                `<li><strong>${conflict.fixture1}</strong> (${conflict.range1}) overlaps with <strong>${conflict.fixture2}</strong> (${conflict.range2})</li>`
              ).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="summary">
          <p>Generated by ArtBastard DMX512 - Address Sheet Tool</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className={styles.addressSheet}>      <div className={styles.header}>
        <h3>📋 DMX Address Sheet</h3>
        <div className={styles.actions}>
          <button onClick={addFixture} className={styles.addButton}>
            ➕ Add Fixture
          </button>
          <button onClick={() => setShowConflicts(!showConflicts)} 
                  className={`${styles.conflictsButton} ${conflicts.length > 0 ? styles.hasConflicts : ''}`}>
            ⚠️ Conflicts ({conflicts.length})
          </button>
          <button onClick={exportToCSV} className={styles.exportButton}>
            📄 Export CSV
          </button>
          <button onClick={printSheet} className={styles.printButton}>
            🖨️ Print
          </button>
          <button onClick={handleSyncWithTemplateOption} className={styles.syncButton}>
            🔄 Sync ↔ ArtBastard
          </button>
          <button onClick={generatePDF} className={styles.pdfButton}>
            📄 Generate PDF
          </button>
        </div>
      </div>

      {showConflicts && conflicts.length > 0 && (
        <div className={styles.conflictPanel}>
          <h4>⚠️ Address Conflicts</h4>
          {conflicts.map((conflict, index) => (
            <div key={index} className={styles.conflict}>
              <strong>{conflict.fixture1}</strong> ({conflict.range1}) overlaps with{' '}
              <strong>{conflict.fixture2}</strong> ({conflict.range2})
            </div>
          ))}
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.fixtureTable}>
          <thead>
            <tr>
              <th>Fixture Name</th>
              <th>Type</th>
              <th>Manufacturer</th>
              <th>Start Addr</th>
              <th>End Addr</th>
              <th>Channels</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((fixture) => (
              <tr key={fixture.id} className={conflicts.some(c => 
                c.fixture1 === fixture.name || c.fixture2 === fixture.name
              ) ? styles.conflictRow : ''}>
                <td>
                  <input
                    type="text"
                    value={fixture.name}
                    onChange={(e) => updateFixture(fixture.id, { name: e.target.value })}
                    className={styles.input}
                  />
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <select
                      value={fixture.type}
                      onChange={(e) => {
                        const selectedType = e.target.value;
                        const typeData = fixtureTypes.find(t => t.name === selectedType);
                        if (typeData) {
                          applyTemplate(fixture.id, selectedType, typeData.channels);
                        } else {
                          applyTemplate(fixture.id, selectedType);
                        }
                      }}
                      className={styles.select}
                    >
                      {fixtureTypes.map(template => (
                        <option key={template.name} value={template.name}>
                          {template.name} ({template.channels}ch)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={fixture.channelCount}
                      onChange={(e) => {
                        const customCount = parseInt(e.target.value) || 1;
                        updateFixture(fixture.id, { channelCount: customCount });
                      }}
                      className={styles.numberInput}
                      style={{ width: '60px', minWidth: '60px' }}
                      min="1"
                      max="512"
                      title="Custom channel count (override template default)"
                    />
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <select
                      value={fixture.manufacturer || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '__custom__') {
                          const customValue = prompt('Enter custom manufacturer:');
                          if (customValue) {
                            addCustomManufacturer(customValue);
                            updateFixture(fixture.id, { manufacturer: customValue });
                          }
                        } else {
                          updateFixture(fixture.id, { manufacturer: value });
                        }
                      }}
                      className={styles.select}
                    >
                      <option value="">Select manufacturer...</option>
                      {manufacturers.map(manufacturer => (
                        <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                      ))}
                      <option value="__custom__">+ Add Custom</option>
                    </select>
                    {fixture.manufacturer && !manufacturers.includes(fixture.manufacturer) && (
                      <button
                        type="button"
                        onClick={() => addCustomManufacturer(fixture.manufacturer!)}
                        title="Add to dropdown list"
                        style={{ padding: '0.25rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      >
                        <LucideIcon name="Plus" size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    value={fixture.startAddress}
                    onChange={(e) => updateFixture(fixture.id, { startAddress: parseInt(e.target.value) || 1 })}
                    className={styles.numberInput}
                    min="1"
                    max="512"
                  />
                </td>
                <td className={styles.endAddress}>
                  {fixture.endAddress}
                </td>
                <td>
                  <input
                    type="text"
                    value={fixture.notes}
                    onChange={(e) => updateFixture(fixture.id, { notes: e.target.value })}
                    className={styles.input}
                    placeholder="Notes..."
                  />
                </td>
                <td>
                  <button
                    onClick={() => deleteFixture(fixture.id)}
                    className={styles.deleteButton}
                    title="Delete fixture"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.summary}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total Fixtures:</span>
            <span className={styles.statValue}>{fixtures.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total Channels:</span>
            <span className={styles.statValue}>{fixtures.reduce((sum, f) => sum + f.channelCount, 0)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Highest Address:</span>
            <span className={styles.statValue}>{Math.max(...fixtures.map(f => f.endAddress), 0)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Conflicts:</span>
            <span className={`${styles.statValue} ${conflicts.length > 0 ? styles.error : styles.ok}`}>
              {conflicts.length}
            </span>
          </div>
        </div>
      </div>      <div className={styles.help}>
        <h4>💡 Quick Guide</h4>
        <ul>
          <li><strong>Add Fixture:</strong> Click "➕ Add Fixture" to add a new row</li>
          <li><strong>Templates:</strong> Select fixture type to auto-fill channel count</li>
          <li><strong>Addresses:</strong> Start addresses auto-calculate to avoid conflicts</li>
          <li><strong>Conflicts:</strong> Red highlighting indicates overlapping addresses</li>
          <li><strong>Sync:</strong> Use "🔄 Sync to ArtBastard" button to sync changes bidirectionally between Address Sheet and Fixture Library</li>
          <li><strong>Export:</strong> Generate CSV for documentation or external tools</li>
          <li><strong>Print:</strong> Create physical reference sheets</li>
          <li><strong>PDF:</strong> Generate and print comprehensive DMX address documentation</li>
          <li><strong>Custom Channels:</strong> Override template channel count by editing the number next to the type dropdown</li>
          <li><strong>Library Fixtures:</strong> Fixture types are loaded from your fixture library templates</li>
          <li><strong>Save as Template:</strong> When syncing, you can save fixtures as reusable templates</li>
        </ul>
      </div>

      {showSaveTemplateDialog && (
        <div className={styles.modalOverlay} onClick={() => setShowSaveTemplateDialog(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h4>Save as Template?</h4>
            <p>Would you like to save this fixture configuration as a reusable template?</p>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                Template Name:
                <input
                  type="text"
                  value={templateNameToSave}
                  onChange={(e) => setTemplateNameToSave(e.target.value)}
                  placeholder="e.g., My Custom Fixture"
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setTemplateNameToSave('');
                  syncToArtBastard(false);
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (templateNameToSave.trim()) {
                    syncToArtBastard(true, templateNameToSave.trim());
                    setShowSaveTemplateDialog(false);
                    setTemplateNameToSave('');
                  }
                }}
                disabled={!templateNameToSave.trim()}
                style={{ padding: '0.5rem 1rem', background: '#4a5cff', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
