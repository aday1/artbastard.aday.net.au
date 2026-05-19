import React, { useState, useEffect } from 'react'
import { useStore, PlacedFixture, Group, FixtureTemplate } from '../../store' // Import PlacedFixture and Group
import useStoreUtils from '../../store/storeUtils'
import { useTheme } from '../../context/ThemeContext'
import axios from 'axios'
import { ColorPickerPanel } from './ColorPickerPanel'; // Added ColorPickerPanel
import { LucideIcon } from '../ui/LucideIcon'; // Added for icons
import { NodeBasedFixtureEditor } from './NodeBasedFixtureEditor'; // Import Node Editor
import { FixtureTemplateManager } from './FixtureTemplateManager'; // Import Template Manager
import SuperControlTidy from './SuperControlTidyClean'; // Import SuperControl for preview
import SuperControlEnhanced from './SuperControlEnhanced'; // Import Enhanced SuperControl for detailed view
import styles from './FixtureSetup.module.scss'

// PlacedFixtureOnSetup type is no longer needed here, will use PlacedFixture from store
import { MidiLearnButton } from '../midi/MidiLearnButton'; // Import MidiLearnButton

interface FixtureChannel {
  name: string
  type: 'dimmer' | 'red' | 'green' | 'blue' | 'white' | 'amber' | 'uv' | 'pan' | 'pan_fine' | 'tilt' | 'tilt_fine' | 'shutter' | 'zoom' | 'focus' | 'color_wheel' | 'gobo_wheel' | 'gobo_rotation' | 'prism' | 'iris' | 'macro' | 'reset' | 'speed' | 'sound' | 'strobe' | 'effect' | 'other';
  dmxAddress?: number; // Optional DMX address override
}

interface FixtureFormData {
  name: string;
  type: string;
  manufacturer: string;
  mode: string;
  startAddress: number;
  channels: FixtureChannel[];
  notes: string;
  photoUrl?: string;
  tags: string[];
}

const channelTypes = [
  { value: 'dimmer', label: 'Dimmer/Intensity' },
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'white', label: 'White' },
  { value: 'amber', label: 'Amber' },
  { value: 'uv', label: 'UV' },
  { value: 'pan', label: 'Pan' },
  { value: 'pan_fine', label: 'Pan Fine' },
  { value: 'tilt', label: 'Tilt' },
  { value: 'tilt_fine', label: 'Tilt Fine' },
  { value: 'shutter', label: 'Shutter' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'focus', label: 'Focus' },
  { value: 'color_wheel', label: 'Color Wheel' },
  { value: 'gobo_wheel', label: 'Gobo Wheel' },
  { value: 'gobo_rotation', label: 'Gobo Rotation' },
  { value: 'prism', label: 'Prism' },
  { value: 'iris', label: 'Iris' },
  { value: 'macro', label: 'Macro' },
  { value: 'reset', label: 'Reset' },
  { value: 'speed', label: 'Speed' },
  { value: 'sound', label: 'Sound' },
  { value: 'strobe', label: 'Strobe' },
  { value: 'effect', label: 'Effect' },
  { value: 'other', label: 'Other' }
]

// Templates are now managed in the store via FixtureTemplateManager

export const FixtureSetup: React.FC = () => {
  const { theme } = useTheme();
  const { 
    fixtures, 
    fixtureTemplates,
    addFixtureFlag,
    removeFixtureFlag,
    bulkAddFlag,
    bulkRemoveFlag,
    createQuickFlag,
    getFixturesByFlag,
    getFixturesByFlagCategory,
    setSelectedFixtures: setStoreSelectedFixtures,
    addFixture,
    deleteFixture,
    setFixtures,
    oscAssignments,
    setOscAssignment
  } = useStore(state => ({
    fixtures: state.fixtures,
    fixtureTemplates: state.fixtureTemplates,
    addFixtureFlag: state.addFixtureFlag,
    removeFixtureFlag: state.removeFixtureFlag,
    bulkAddFlag: state.bulkAddFlag,
    bulkRemoveFlag: state.bulkRemoveFlag,
    createQuickFlag: state.createQuickFlag,
    getFixturesByFlag: state.getFixturesByFlag,
    getFixturesByFlagCategory: state.getFixturesByFlagCategory,
    setSelectedFixtures: state.setSelectedFixtures,
    addFixture: state.addFixture,
    deleteFixture: state.deleteFixture,
    setFixtures: state.setFixtures,
    oscAssignments: state.oscAssignments,
    setOscAssignment: state.setOscAssignment
  }));
  const groups = useStore(state => state.groups)
  const [showCreateFixture, setShowCreateFixture] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [editingFixtureId, setEditingFixtureId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [showSuperControlPreview, setShowSuperControlPreview] = useState(false)
  const [fixtureForm, setFixtureForm] = useState<FixtureFormData>({
    name: '',
    type: '',
    manufacturer: '',
    mode: '',
    startAddress: 1,
    channels: [{ name: 'Intensity', type: 'dimmer' }],
    notes: '',
    photoUrl: undefined,
    tags: []
  });
    const [groupForm, setGroupForm] = useState<Partial<Group>>({
    name: '',
    fixtureIndices: [],
    lastStates: new Array(512).fill(0),
    isMuted: false,
    isSolo: false,
    masterValue: 255
  })
  // Multi-select functionality state
  const [selectedFixtures, setSelectedFixtures] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdvancedSelection, setShowAdvancedSelection] = useState(false);
  const [showFlagPanel, setShowFlagPanel] = useState(false);
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagColor, setNewFlagColor] = useState('#ff6b6b');
  const [newFlagCategory, setNewFlagCategory] = useState('');
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [nodeEditorFixtureId, setNodeEditorFixtureId] = useState<string | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<FixtureTemplate | null>(null);
  // Online fixture definition import URL
  const [onlineFixtureUrl, setOnlineFixtureUrl] = useState('');
  const [isImportingOnlineFixture, setIsImportingOnlineFixture] = useState(false);
  // Auto-patching helper state
  const [isAutoPatching, setIsAutoPatching] = useState(false);
  // Favorites filter state
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  // Dropdown options with ability to add custom
  const [manufacturers, setManufacturers] = useState<string[]>(() => {
    const stored = localStorage.getItem('fixtureManufacturers');
    return stored ? JSON.parse(stored) : ['uKing', 'Chauvet', 'Martin', 'Clay Paky', 'Elation', 'American DJ', 'ADJ'];
  });
  const [fixtureTypes, setFixtureTypes] = useState<string[]>(() => {
    const stored = localStorage.getItem('fixtureTypes');
    return stored ? JSON.parse(stored) : ['Moving Head', 'Par Can', 'Beam', 'Wash', 'Spot', 'Laser', 'Strobe', 'Dimmer', 'Other'];
  });
  // Tag options
  const availableTags = ['WASH', 'RGB', 'LED', 'LASER', 'MOVING HEAD', 'BEAM', 'SPOT', 'PAR', 'DIMMER', 'STROBE'];
  // DMX edit state - map of channel index to edit state
  const [dmxEditStates, setDmxEditStates] = useState<Record<number, { isEditing: boolean; value: string }>>({});
  // Discovery Wizard removed

  // Filter fixtures based on search term and favorites
  const filteredFixtures = fixtures.filter(fixture => {
    const matchesSearch = fixture.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFavorites = !showFavoritesOnly || fixture.isFavorite === true;
    return matchesSearch && matchesFavorites;
  });

  // Keyboard shortcuts for multi-select operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + A: Select All
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        selectAll();
        return;
      }

      // Ctrl/Cmd + D: Deselect All
      if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        deselectAll();
        return;
      }

      // Ctrl/Cmd + I: Invert Selection
      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        invertSelection();
        return;
      }

      // Escape: Clear search and close panels
      if (event.key === 'Escape') {
        setSearchTerm('');
        setShowAdvancedSelection(false);
        setShowFlagPanel(false);
        return;
      }

      // Ctrl/Cmd + F: Focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }      // Delete: Delete selected fixtures
      if (event.key === 'Delete' && selectedFixtures.length > 0) {
        event.preventDefault();
        if (window.confirm(`Delete ${selectedFixtures.length} selected fixture(s)?`)) {
          selectedFixtures.forEach(fixtureId => {
            handleDeleteFixture(fixtureId);
          });
          setSelectedFixtures([]);
          setStoreSelectedFixtures([]);
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFixtures, filteredFixtures]);

  // Multi-select functionality functions
  const selectAll = () => {
    const newSelection = filteredFixtures.map(f => f.id);
    setSelectedFixtures(newSelection);
    setStoreSelectedFixtures(newSelection);
  };

  const deselectAll = () => {
    setSelectedFixtures([]);
    setStoreSelectedFixtures([]);
  };

  const invertSelection = () => {
    const allIds = filteredFixtures.map(f => f.id);
    const newSelection = allIds.filter(id => !selectedFixtures.includes(id));
    setSelectedFixtures(newSelection);
    setStoreSelectedFixtures(newSelection);
  };

  const selectByType = (fixtureType: 'rgb' | 'movement' | 'dimmer') => {
    const typeFixtures = filteredFixtures.filter(fixture => {
      switch (fixtureType) {
        case 'rgb':
          return fixture.channels.some(ch => ch.type === 'red') &&
                 fixture.channels.some(ch => ch.type === 'green') &&
                 fixture.channels.some(ch => ch.type === 'blue');
        case 'movement':
          return fixture.channels.some(ch => ch.type === 'pan') ||
                 fixture.channels.some(ch => ch.type === 'tilt');
        case 'dimmer':
          return fixture.channels.some(ch => ch.type === 'dimmer');
        default:
          return false;
      }
    });
    const newSelection = typeFixtures.map(f => f.id);
    setSelectedFixtures(newSelection);
    setStoreSelectedFixtures(newSelection);
  };

  const selectSimilar = () => {
    if (selectedFixtures.length === 0) return;
    
    const referenceFixture = fixtures.find(f => f.id === selectedFixtures[0]);
    if (!referenceFixture) return;
    
    const referenceChannelTypes = referenceFixture.channels.map(ch => ch.type).sort();
    const similarFixtures = filteredFixtures.filter(fixture => {
      const channelTypes = fixture.channels.map(ch => ch.type).sort();
      return JSON.stringify(channelTypes) === JSON.stringify(referenceChannelTypes);
    });
    
    const newSelection = similarFixtures.map(f => f.id);
    setSelectedFixtures(newSelection);
    setStoreSelectedFixtures(newSelection);
  };

  const selectByFlag = (flagId: string) => {
    const flaggedFixtures = getFixturesByFlag(flagId);
    const newSelection = flaggedFixtures.map(f => f.id);
    setSelectedFixtures(newSelection);
    setStoreSelectedFixtures(newSelection);
  };

  const selectByFlagCategory = (category: string) => {
    const flaggedFixtures = getFixturesByFlagCategory(category);
    const newSelection = flaggedFixtures.map(f => f.id);
    setSelectedFixtures(newSelection);
    setStoreSelectedFixtures(newSelection);
  };

  const selectAllFlagged = () => {
    const flaggedFixtures = filteredFixtures.filter(f => f.isFlagged);
    setSelectedFixtures(flaggedFixtures.map(f => f.id));
  };

  // Flag management functions
  const createAndApplyFlag = () => {
    if (!newFlagName.trim() || selectedFixtures.length === 0) return;
    
    const flag = createQuickFlag(newFlagName.trim(), newFlagColor, newFlagCategory.trim() || undefined);
    bulkAddFlag(selectedFixtures, flag);
    
    // Reset form
    setNewFlagName('');
    setNewFlagColor('#ff6b6b');
    setNewFlagCategory('');
    setShowFlagPanel(false);
  };

  const getAllUniqueFlags = () => {
    const flagMap = new Map();
    fixtures.forEach(fixture => {
      if (fixture.flags) {
        fixture.flags.forEach(flag => {
          flagMap.set(flag.id, flag);
        });
      }
    });
    return Array.from(flagMap.values()).sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
  };

  // Get all unique categories
  const getAllUniqueCategories = () => {
    const categories = new Set<string>();
    fixtures.forEach(fixture => {
      if (fixture.flags) {
        fixture.flags.forEach(flag => {
          if (flag.category) {
            categories.add(flag.category);
          }
        });
      }
    });
    return Array.from(categories).sort();
  };

  // Remove all flags from selected fixtures
  const removeSelectedFixtureFlags = () => {
    selectedFixtures.forEach(fixtureId => {
      const fixture = fixtures.find(f => f.id === fixtureId);
      if (fixture && fixture.flags) {
        fixture.flags.forEach(flag => {
          removeFixtureFlag(fixtureId, flag.id);
        });
      }
  });
  };

  // Helper functions for form management
  const selectedFixtureName = () => {
    if (selectedFixtures.length === 0) return 'No fixtures selected';
    if (selectedFixtures.length === 1) {
      const fixture = fixtures.find(f => f.id === selectedFixtures[0]);
      return fixture?.name || 'Unknown';
    }
    return `${selectedFixtures.length} fixtures selected`;
  };

  const toggleFixtureSelection = (fixtureId: string) => {
    setSelectedFixtures(prevSelected => {
      const newSelection = prevSelected.includes(fixtureId)
        ? prevSelected.filter(id => id !== fixtureId)
        : [...prevSelected, fixtureId];
      setStoreSelectedFixtures(newSelection);
      return newSelection;
    });
  };

  const calculateNextStartAddress = () => {
    if (fixtures.length === 0) return 1;
    // Ensure addresses are numbers and positive before using Math.max
    const lastAddresses = fixtures.map(f => (f.startAddress || 1) + (f.channels?.length || 0));
    return Math.max(1, ...lastAddresses.map(addr => Math.max(1, addr)));
  };

  // Check for DMX address conflicts
  const checkDmxConflict = (startAddress: number, channelCount: number, excludeFixtureId?: string): string | null => {
    const endAddress = startAddress + channelCount - 1;
    
    for (const fixture of fixtures) {
      // Skip the fixture we're editing
      if (excludeFixtureId && fixture.id === excludeFixtureId) continue;
      
      const fixtureEnd = fixture.startAddress + fixture.channels.length - 1;
      
      // Check if ranges overlap
      if (!(endAddress < fixture.startAddress || startAddress > fixtureEnd)) {
        return `Conflicts with "${fixture.name}" (DMX ${fixture.startAddress}-${fixtureEnd})`;
      }
    }
    
    return null; // No conflict
  };
  
  // Get the effective DMX address for a channel (either custom or calculated from start address)
  const getEffectiveDmxAddress = (channelIndex: number): number => {
    const channel = fixtureForm.channels[channelIndex];
    if (channel.dmxAddress !== undefined && channel.dmxAddress >= 1 && channel.dmxAddress <= 512) {
      return channel.dmxAddress;
    }
    return fixtureForm.startAddress + channelIndex;
  };

  // Validate individual DMX address
  const validateDmxAddress = (channelIndex: number, newAddress: number): string | null => {
    if (newAddress < 1 || newAddress > 512) {
      return 'DMX address must be between 1 and 512';
    }

    // Check for conflicts with other channels in the same fixture
    for (let i = 0; i < fixtureForm.channels.length; i++) {
      if (i !== channelIndex) {
        const otherAddress = getEffectiveDmxAddress(i);
        if (otherAddress === newAddress) {
          return `DMX address ${newAddress} is already used by channel "${fixtureForm.channels[i].name}"`;
        }
      }
    }

    // Check for conflicts with other fixtures
    const conflict = fixtures.find(fixture => {
      if (editingFixtureId && fixture.id === editingFixtureId) {
        return false; // Skip the fixture being edited
      }
      
      return fixture.channels.some((ch, idx) => {
        const effectiveAddress = ch.dmxAddress || (fixture.startAddress + idx);
        return effectiveAddress === newAddress;
      });
    });

    if (conflict) {
      return `DMX address ${newAddress} is already used by fixture "${conflict.name}"`;
    }

    return null; // No conflict
  };

  // Handle DMX address change for individual channels
  const handleDmxAddressChange = (channelIndex: number, newAddress: string) => {
    const addressNum = parseInt(newAddress);
    if (isNaN(addressNum)) {
      return; // Invalid input, don't update
    }

    const validationError = validateDmxAddress(channelIndex, addressNum);
    if (validationError) {
      useStoreUtils.getState().addNotification({
        message: validationError,
        type: 'warning',
        priority: 'medium'
      });
      return;
    }

    handleChannelChange(channelIndex, 'dmxAddress', addressNum);
  };

  // Reset channel to use calculated address from start address
  const resetChannelToCalculated = (channelIndex: number) => {
    handleChannelChange(channelIndex, 'dmxAddress', undefined);
  };

  // Handle fixture form changes
  const handleFixtureChange = (key: keyof FixtureFormData, value: any) => {
    setFixtureForm(prev => ({ ...prev, [key]: value }))
  }
  
  // Handle channel changes
  const handleChannelChange = (index: number, key: keyof FixtureChannel, value: any) => {
    const updatedChannels = [...fixtureForm.channels]
    updatedChannels[index] = { ...updatedChannels[index], [key]: value }
    setFixtureForm(prev => ({ ...prev, channels: updatedChannels }))
  }

  // Handle DMX address override
  const handleDmxAddressOverride = (channelIndex: number, dmxAddress: number | undefined) => {
    const updatedChannels = [...fixtureForm.channels]
    updatedChannels[channelIndex] = { ...updatedChannels[channelIndex], dmxAddress }
    setFixtureForm(prev => ({ ...prev, channels: updatedChannels }))
  }

  // Add custom value to dropdown lists
  const addCustomManufacturer = (value: string) => {
    if (value && !manufacturers.includes(value)) {
      const updated = [...manufacturers, value]
      setManufacturers(updated)
      localStorage.setItem('fixtureManufacturers', JSON.stringify(updated))
    }
  }

  const addCustomType = (value: string) => {
    if (value && !fixtureTypes.includes(value)) {
      const updated = [...fixtureTypes, value]
      setFixtureTypes(updated)
      localStorage.setItem('fixtureTypes', JSON.stringify(updated))
    }
  }

  // Handle tag toggle
  const toggleTag = (tag: string) => {
    const currentTags = fixtureForm.tags || []
    if (currentTags.includes(tag)) {
      setFixtureForm(prev => ({ ...prev, tags: currentTags.filter(t => t !== tag) }))
    } else {
      setFixtureForm(prev => ({ ...prev, tags: [...currentTags, tag] }))
    }
  }
  
  // Add a new channel to the fixture
  const addChannel = () => {
    setFixtureForm(prev => ({
      ...prev,
      channels: [...prev.channels, { name: `Channel ${prev.channels.length + 1}`, type: 'other' }]
    }))
  }
  
  // Remove a channel from the fixture
  const removeChannel = (index: number) => {
    setFixtureForm(prev => ({
      ...prev,
      channels: prev.channels.filter((_, i) => i !== index)
    }))
  }

  // Save fixture to store
  const saveFixture = () => {
    if (editingFixtureId) {
      // Update existing fixture
      updateFixture()
    } else {
      // Create new fixture
      createFixture()
    }
  }

  // Create new fixture
  const createFixture = () => {
    // Validate DMX address conflict
    const conflict = checkDmxConflict(fixtureForm.startAddress, fixtureForm.channels.length);
    if (conflict) {
      useStoreUtils.getState().addNotification({
        message: `Cannot create fixture: ${conflict}`,
        type: 'error',
        priority: 'high'
      });
      return;
    }    const newFixture = {
      id: `fixture-${Date.now()}-${Math.random()}`,
      name: fixtureForm.name,
      type: fixtureForm.type,
      manufacturer: fixtureForm.manufacturer,
      mode: fixtureForm.mode,
      startAddress: fixtureForm.startAddress,
      channels: fixtureForm.channels,
      notes: fixtureForm.notes,
      photoUrl: fixtureForm.photoUrl,
      tags: fixtureForm.tags || []
    }
    
    // Use addFixture which saves to server via API
    addFixture(newFixture);
    
    resetForm()
    
    // Success message is handled by addFixture
  }

  // Update existing fixture
  const updateFixture = () => {
    if (!editingFixtureId) return

    // Validate DMX address conflict (exclude current fixture from check)
    const conflict = checkDmxConflict(fixtureForm.startAddress, fixtureForm.channels.length, editingFixtureId);
    if (conflict) {
      useStoreUtils.getState().addNotification({
        message: `Cannot update fixture: ${conflict}`,
        type: 'error',
        priority: 'high'
      });
      return;
    }    const updatedFixture = {
      id: editingFixtureId,
      name: fixtureForm.name,
      type: fixtureForm.type,
      manufacturer: fixtureForm.manufacturer,
      mode: fixtureForm.mode,
      startAddress: fixtureForm.startAddress,
      channels: fixtureForm.channels,
      notes: fixtureForm.notes,
      photoUrl: fixtureForm.photoUrl,
      tags: fixtureForm.tags || []
    }
    
    // Update in store and save to server
    const updatedFixtures = fixtures.map(f => f.id === editingFixtureId ? updatedFixture : f);
    setFixtures(updatedFixtures);
    
    // Save individual fixture to server (more efficient than saving all fixtures)
    axios.post(`/api/fixtures/${updatedFixture.id}`, updatedFixture)
      .then(() => {
        useStoreUtils.getState().addNotification({
          message: `Fixture "${updatedFixture.name}" updated`,
          type: 'success',
          priority: 'normal'
        });
      })
      .catch(error => {
        console.error('Failed to save updated fixture to backend:', error);
        useStoreUtils.getState().addNotification({
          message: 'Failed to save updated fixture to server',
          type: 'error',
          priority: 'high'
        });
      });
    
    resetForm()
  }

  // Start editing a fixture
  const startEditFixture = (fixture: any) => {
    setEditingFixtureId(fixture.id)
    setFixtureForm({
      name: fixture.name,
      type: fixture.type || '',
      manufacturer: fixture.manufacturer || '',
      mode: fixture.mode || '',
      startAddress: fixture.startAddress,
      channels: [...fixture.channels], // Create a copy to avoid direct mutation
      notes: fixture.notes || '',
      photoUrl: fixture.photoUrl,
      tags: fixture.tags || []
    })
    setShowCreateFixture(true)
  }

  // Import/Export functionality
  const exportAllFixtures = () => {
    const exportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      fixtures: fixtures.map(fixture => ({
        name: fixture.name,
        type: fixture.type || '',
        manufacturer: fixture.manufacturer || '',
        mode: fixture.mode || '',
        channels: fixture.channels,
        notes: fixture.notes || ''
      }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `artbastard-fixtures-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);    // Show success notification
    useStoreUtils.getState().addNotification({
      message: `Exported ${fixtures.length} fixtures successfully`,
      type: 'success',
      priority: 'normal'
    });
  };

  const exportSelectedFixtures = () => {
    if (selectedFixtures.length === 0) {      useStoreUtils.getState().addNotification({
        message: 'No fixtures selected for export',
        type: 'warning',
        priority: 'normal'
      });
      return;
    }

    const selectedFixtureData = fixtures.filter(f => selectedFixtures.includes(f.id));
    const exportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      fixtures: selectedFixtureData.map(fixture => ({
        name: fixture.name,
        type: fixture.type || '',
        manufacturer: fixture.manufacturer || '',
        mode: fixture.mode || '',
        channels: fixture.channels,
        notes: fixture.notes || ''
      }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `artbastard-selected-fixtures-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);    // Show success notification
    useStoreUtils.getState().addNotification({
      message: `Exported ${selectedFixtures.length} selected fixtures successfully`,
      type: 'success',
      priority: 'normal'
    });
  };

  const importFixtures = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        // Validate import data structure
        if (!importData.fixtures || !Array.isArray(importData.fixtures)) {
          throw new Error('Invalid file format: Missing fixtures array');
        }

        let importedCount = 0;
        let conflictCount = 0;
        const conflicts: string[] = [];

        importData.fixtures.forEach((fixtureData: any, index: number) => {
          // Validate required fields
          if (!fixtureData.name || !fixtureData.channels || !Array.isArray(fixtureData.channels)) {
            console.warn(`Skipping fixture ${index + 1}: Invalid data structure`);
            return;
          }

          // Check for DMX address conflicts and auto-resolve
          let startAddress = fixtureData.startAddress || calculateNextStartAddress();
          let originalStartAddress = startAddress;
          
          // Keep incrementing until we find a free address space
          while (checkDmxConflict(startAddress, fixtureData.channels.length)) {
            startAddress++;
            if (startAddress > 512 - fixtureData.channels.length) {
              console.warn(`Cannot import "${fixtureData.name}": No available DMX addresses`);
              return;
            }
          }

          // Track if we had to change the address
          if (startAddress !== originalStartAddress) {
            conflictCount++;
            conflicts.push(`"${fixtureData.name}" moved from DMX ${originalStartAddress} to ${startAddress}`);
          }

          // Create fixture with auto-resolved address
          const newFixture = {
            name: fixtureData.name,
            type: fixtureData.type || '',
            manufacturer: fixtureData.manufacturer || '',
            mode: fixtureData.mode || '',
            startAddress: startAddress,
            channels: fixtureData.channels.map((ch: any) => ({
              name: ch.name || 'Unnamed Channel',
              type: channelTypes.find(ct => ct.value === ch.type) ? ch.type : 'other'
            })),
            notes: fixtureData.notes || ''
          };

          // Add fixture to store
          useStoreUtils.setState(state => ({
            fixtures: [...state.fixtures, { ...newFixture, id: `fixture-${Date.now()}-${Math.random()}` }]
          }));
          importedCount++;
        });        // Show import results
        useStoreUtils.getState().addNotification({
          message: importedCount > 0 ? `Successfully imported ${importedCount} fixtures${conflictCount > 0 ? ` (${conflictCount} addresses auto-resolved)` : ''}` : 'No fixtures were imported',
          type: importedCount > 0 ? 'success' : 'warning',
          priority: 'normal'
        });

        // Show conflict details if any
        if (conflicts.length > 0 && conflicts.length <= 5) {
          setTimeout(() => {
            useStoreUtils.getState().addNotification({
              message: `Address conflicts resolved: ${conflicts.join(', ')}`,
              type: 'info',
              priority: 'low'
            });
          }, 1500);
        } else if (conflicts.length > 5) {
          setTimeout(() => {
            useStoreUtils.getState().addNotification({
              message: `${conflicts.length} DMX address conflicts were automatically resolved`,
              type: 'info',
              priority: 'low'
            });
          }, 1500);
        }      } catch (error) {
        console.error('Import error:', error);
        useStoreUtils.getState().addNotification({
          message: `Import failed: ${error instanceof Error ? error.message : 'Invalid file format'}`,
          type: 'error',
          priority: 'high'
        });
      }
    };

    reader.readAsText(file);
    // Reset the input so the same file can be imported again
    event.target.value = '';
  };

  // Import a single fixture definition from an online JSON URL.
  // The JSON is expected to contain at least: { name, channels: Array<{ name, type }> }
  const importFixtureFromUrl = async () => {
    if (!onlineFixtureUrl.trim()) {
      useStoreUtils.getState().addNotification({
        message: 'Please enter a URL for the online fixture definition',
        type: 'warning',
        priority: 'normal'
      });
      return;
    }

    try {
      setIsImportingOnlineFixture(true);
      const response = await axios.get(onlineFixtureUrl.trim());
      const data = response.data;

      if (!data || !data.name || !Array.isArray(data.channels)) {
        throw new Error('Fixture JSON must include "name" and "channels[]" fields');
      }

      // Map channel types to known types when possible, defaulting to "other"
      const knownTypes = channelTypes.map(ct => ct.value);
      const mappedChannels: FixtureChannel[] = data.channels.map((ch: any, idx: number) => ({
        name: ch.name || `Channel ${idx + 1}`,
        type: knownTypes.includes(ch.type) ? ch.type : 'other',
        dmxAddress: typeof ch.dmxAddress === 'number' ? ch.dmxAddress : undefined
      }));

      const nextAddress = calculateNextStartAddress();

      setFixtureForm({
        name: data.name,
        type: data.type || '',
        manufacturer: data.manufacturer || '',
        mode: data.mode || '',
        startAddress: typeof data.startAddress === 'number' ? data.startAddress : nextAddress,
        channels: mappedChannels,
        notes: data.notes || '',
        tags: data.tags || []
      });

      setEditingFixtureId(null);
      setShowCreateFixture(true);

      useStoreUtils.getState().addNotification({
        message: `Loaded fixture definition "${data.name}" from online source`,
        type: 'success',
        priority: 'normal'
      });
    } catch (error) {
      console.error('Failed to import fixture from URL:', error);
      useStoreUtils.getState().addNotification({
        message: `Failed to import fixture: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        priority: 'high'
      });
    } finally {
      setIsImportingOnlineFixture(false);
    }
  };

  // Auto-patch selected fixtures sequentially to resolve DMX address conflicts.
  const autoPatchSelectedFixtures = () => {
    if (selectedFixtures.length === 0) {
      useStoreUtils.getState().addNotification({
        message: 'No fixtures selected for auto-patching',
        type: 'warning',
        priority: 'normal'
      });
      return;
    }

    setIsAutoPatching(true);

    try {
      // Work on a copy of fixtures
      const fixturesCopy = [...fixtures];
      // Map selected fixture IDs to their indices in the fixtures array
      const selected = fixturesCopy.filter(f => selectedFixtures.includes(f.id));

      // Sort by current start address to keep roughly the same order
      selected.sort((a, b) => (a.startAddress || 1) - (b.startAddress || 1));

      // Keep unselected fixtures as immutable reference for conflict checks
      const unselected = fixturesCopy.filter(f => !selectedFixtures.includes(f.id));

      let updatedFixtures = [...fixturesCopy];

      selected.forEach(sel => {
        // Find a free range for this fixture after the last used address
        let proposedStart = calculateNextStartAddress();
        const channelCount = sel.channels.length;

        // Scan forward until we find space that doesn't collide with any unselected fixture
        while (true) {
          const proposedEnd = proposedStart + channelCount - 1;
          const hasConflict = unselected.some(other => {
            const otherStart = other.startAddress;
            const otherEnd = other.startAddress + other.channels.length - 1;
            return !(proposedEnd < otherStart || proposedStart > otherEnd);
          });

          if (!hasConflict && proposedEnd <= 512) {
            break;
          }
          proposedStart++;
          if (proposedStart > 512 - channelCount) {
            useStoreUtils.getState().addNotification({
              message: `Unable to auto-patch fixture "${sel.name}" – no free DMX range available`,
              type: 'error',
              priority: 'high'
            });
            return;
          }
        }

        // Apply the new start address
        updatedFixtures = updatedFixtures.map(f =>
          f.id === sel.id ? { ...f, startAddress: proposedStart } : f
        );
      });

      setFixtures(updatedFixtures);

      useStoreUtils.getState().addNotification({
        message: `Auto-patched ${selected.length} fixture(s) to resolve DMX conflicts`,
        type: 'success',
        priority: 'normal'
      });
    } finally {
      setIsAutoPatching(false);
    }
  };

  // Hidden file input ref for import functionality
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const triggerImport = () => {
    fileInputRef.current?.click();
  };
  // Use the store's deleteFixture function which handles both local and server deletion
  const handleDeleteFixture = (fixtureId: string) => {
    if (window.confirm('Are you sure you want to delete this fixture?')) {
      deleteFixture(fixtureId);
    }
  };

  // Toggle favorite status for a fixture
  const toggleFavorite = (fixtureId: string) => {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return;

    const updatedFixture = {
      ...fixture,
      isFavorite: !fixture.isFavorite
    };

    const updatedFixtures = fixtures.map(f => f.id === fixtureId ? updatedFixture : f);
    setFixtures(updatedFixtures);

    // Save to server
    axios.post(`/api/fixtures/${updatedFixture.id}`, updatedFixture)
      .catch(error => {
        console.error('Failed to save favorite status to backend:', error);
      });
  };

  // Open node editor for fixture
  const openNodeEditor = (fixtureId: string) => {
    setNodeEditorFixtureId(fixtureId)
    setShowNodeEditor(true)
  }

  // Close node editor
  const closeNodeEditor = () => {
    setShowNodeEditor(false)
    setNodeEditorFixtureId(null)
  }

  const resetForm = () => {
    setFixtureForm({
      name: '',
      type: '',
      manufacturer: '',
      mode: '',
      startAddress: calculateNextStartAddress(),
      channels: [{ name: 'Channel 1', type: 'other' }],
      notes: '',
      photoUrl: undefined,
      tags: []
    });
    setEditingFixtureId(null);
    setCurrentTemplate(null);
    setShowCreateFixture(false);
  };

  const saveGroup = () => {
    if (!groupForm.name || !groupForm.fixtureIndices || groupForm.fixtureIndices.length === 0) return;

    const newGroup = {
      id: `group-${Date.now()}-${Math.random()}`,
      name: groupForm.name,
      fixtureIndices: groupForm.fixtureIndices,
      lastStates: new Array(512).fill(0),
      isMuted: false,
      isSolo: false,
      masterValue: 255
    };

    useStoreUtils.setState(state => ({
      groups: [...state.groups, newGroup]
    }));

    useStoreUtils.getState().addNotification({
      message: 'Group created successfully',
      type: 'success',
      priority: 'normal'
    });

    setGroupForm({
      name: '',
      fixtureIndices: [],
      lastStates: new Array(512).fill(0),
      isMuted: false,
      isSolo: false,
      masterValue: 255
    });
    setShowCreateGroup(false);
  };

  const updateGroup = () => {
    if (!editingGroupId || !groupForm.name || !groupForm.fixtureIndices || groupForm.fixtureIndices.length === 0) return;

    useStoreUtils.setState(state => ({
      groups: state.groups.map(g => 
        g.id === editingGroupId 
          ? { ...g, name: groupForm.name, fixtureIndices: groupForm.fixtureIndices }
          : g
      )
    }));

    useStoreUtils.getState().addNotification({
      message: 'Group updated successfully',
      type: 'success',
      priority: 'normal'
    });

    setGroupForm({
      name: '',
      fixtureIndices: [],
      lastStates: new Array(512).fill(0),
      isMuted: false,
      isSolo: false,
      masterValue: 255
    });
    setEditingGroupId(null);
    setShowCreateGroup(false);
  };

  const deleteGroup = (group: any) => {
    useStoreUtils.setState(state => ({
      groups: state.groups.filter(g => g.id !== group.id)
    }));
    useStoreUtils.getState().addNotification({
      message: 'Group deleted successfully',
      type: 'success',
      priority: 'normal'
    });
  };

  const startEditGroup = (group: any) => {
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      fixtureIndices: [...group.fixtureIndices],
      lastStates: group.lastStates,
      isMuted: group.isMuted,
      isSolo: group.isSolo,
      masterValue: group.masterValue
    });
    setShowCreateGroup(true);
  };

  const toggleFixtureForGroup = (fixtureIndex: number) => {
    setGroupForm(prev => ({
      ...prev,
      fixtureIndices: prev.fixtureIndices.includes(fixtureIndex)
        ? prev.fixtureIndices.filter(i => i !== fixtureIndex)
        : [...prev.fixtureIndices, fixtureIndex]
    }));
  };

  // Helper: determine whether a given fixture has any DMX address overlap with others.
  const fixtureHasConflict = (fixtureId: string): boolean => {
    const target = fixtures.find(f => f.id === fixtureId);
    if (!target) return false;
    const start = target.startAddress;
    const end = start + target.channels.length - 1;

    return fixtures.some(other => {
      if (other.id === fixtureId) return false;
      const otherStart = other.startAddress;
      const otherEnd = other.startAddress + other.channels.length - 1;
      return !(end < otherStart || start > otherEnd);
    });
  };

  // Build a simple comparison table when multiple fixtures are selected
  const selectedFixtureDetails = fixtures.filter(f => selectedFixtures.includes(f.id));

  return (
    <div className={styles.fixtureSetup}>
      {/* Header with preview toggle */}
      <div className={styles.headerBar}>
        <h2>Fixture Setup & Management</h2>
        <button 
          className={styles.togglePreviewBtn}
          onClick={() => setShowSuperControlPreview(!showSuperControlPreview)}
          title="Toggle SuperControl Preview"
        >
          <i className="fas fa-eye"></i>
          {showSuperControlPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>
      {/* Main content area */}
      <div className={styles.mainArea}>
        {/* Fixture Management Section */}
        <div className={styles.card}>          <div className={styles.cardHeader}>
            <h3>
              {theme === 'artsnob' && 'Existing Fixtures: The Gallery of Light Instruments'}
              {theme === 'standard' && 'Fixture Library'}
              {theme === 'minimal' && 'Library'}
            </h3>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Active: {fixtures.length}</div>
            <div className={styles.headerActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importFixtures}
                style={{ display: 'none' }}
              />
              <button
                className={`${styles.actionButton} ${styles.importButton}`}
                onClick={triggerImport}
                title="Import fixtures from JSON file"
              >
                <i className="fas fa-upload"></i>
                Import
              </button>
              {/* Online fixture definition import by URL */}
              <div className={styles.onlineImport}>
                <input
                  type="url"
                  placeholder="Online fixture JSON URL"
                  value={onlineFixtureUrl}
                  onChange={(e) => setOnlineFixtureUrl(e.target.value)}
                  className={styles.onlineImportInput}
                />
                <button
                  className={`${styles.actionButton} ${styles.onlineImportButton}`}
                  onClick={importFixtureFromUrl}
                  disabled={isImportingOnlineFixture}
                  title="Load fixture definition from URL"
                >
                  {isImportingOnlineFixture ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Loading...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-link"></i>
                      Import URL
                    </>
                  )}
                </button>
              </div>
              <button
                className={`${styles.actionButton} ${styles.exportButton}`}
                onClick={exportAllFixtures}
                disabled={fixtures.length === 0}
                title="Export all fixtures to JSON file"
              >
                <i className="fas fa-download"></i>
                Export All
              </button>
              {selectedFixtures.length > 0 && (
                <button
                  className={`${styles.actionButton} ${styles.exportSelectedButton}`}
                  onClick={exportSelectedFixtures}
                  title={`Export ${selectedFixtures.length} selected fixtures`}
                >
                  <i className="fas fa-download"></i>
                  Export Selected ({selectedFixtures.length})
                </button>
              )}
              <button
                className={`${styles.actionButton} ${styles.exportButton}`}
                onClick={() => {
                  // Trigger sync to DMX Address Sheet by updating store
                  // The PdfAddressSheet component will automatically pick up changes via useEffect
                  useStoreUtils.getState().addNotification({
                    message: `Fixtures exported to DMX Address Sheet. Open Help & Documentation > Address Sheet to view.`,
                    type: 'success',
                    priority: 'normal'
                  });
                }}
                disabled={fixtures.length === 0}
                title="Export fixtures to DMX Address Sheet"
              >
                <i className="fas fa-file-alt"></i>
                Export to Address Sheet
              </button>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  // Open Help Overlay with address-sheet tab
                  const helpEvent = new CustomEvent('openHelpOverlay', { detail: { tab: 'address-sheet' } });
                  window.dispatchEvent(helpEvent);
                }}
                className={`${styles.actionButton} ${styles.exportButton}`}
                title="Open DMX Address Sheet"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <i className="fas fa-external-link-alt"></i>
                View Address Sheet
              </a>
            </div>
          </div>
          <div className={styles.cardBody}>
            {fixtures.length === 0 ? (
              <div className={styles.emptyState}>
                <i className="fas fa-lightbulb"></i>
                <p>No fixtures have been created yet</p>
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div className={styles.searchSection}>
                  <div className={styles.searchContainer}>
                    <LucideIcon name="Search" />
                    <input
                      type="text"
                      placeholder="Search fixtures..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={styles.searchInput}
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className={styles.clearSearch}
                      >
                        <LucideIcon name="X" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`${styles.favoritesFilterButton} ${showFavoritesOnly ? styles.active : ''}`}
                    title={showFavoritesOnly ? "Show all fixtures" : "Show favorites only"}
                  >
                    <LucideIcon name="Star" />
                    {showFavoritesOnly && <span>Favorites</span>}
                  </button>
                </div>

                {/* Selection Summary */}
                {selectedFixtures.length > 0 && (
                  <div className={styles.selectionSummary}>
                    <div className={styles.summaryText}>
                      <span>{selectedFixtures.length} of {filteredFixtures.length} selected</span>
                    </div>
                    <div className={styles.summaryActions}>
                      <button
                        onClick={deselectAll}
                        className={styles.summaryButton}
                        title="Clear selection"
                      >
                        <LucideIcon name="X" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Bulk Selection Controls */}
                <div className={styles.bulkControls}>
                  <button
                    className={styles.bulkButton}
                    onClick={selectAll}
                    title="Select all visible fixtures"
                  >
                    <LucideIcon name="CheckSquare" />
                    <span>All</span>
                  </button>
                  
                  <button
                    className={styles.bulkButton}
                    onClick={invertSelection}
                    title="Invert selection"
                  >
                    <LucideIcon name="RotateCcw" />
                    <span>Invert</span>
                  </button>
                  
                  <button
                    className={styles.bulkButton}
                    onClick={() => setShowAdvancedSelection(!showAdvancedSelection)}
                    title="Advanced selection"
                  >
                    <LucideIcon name="Filter" />
                    <span>Smart</span>
                  </button>
                  
                  <button
                    className={styles.bulkButton}
                    onClick={() => setShowFlagPanel(!showFlagPanel)}
                    title="Flag management"
                  >
                    <LucideIcon name="Tag" />
                    <span>Flags</span>
                  </button>
                  <button
                    className={styles.bulkButton}
                    onClick={autoPatchSelectedFixtures}
                    disabled={selectedFixtures.length === 0 || isAutoPatching}
                    title="Auto-patch selected fixtures to resolve DMX conflicts"
                  >
                    <LucideIcon name="Grid3X3" />
                    <span>{isAutoPatching ? 'Patching…' : 'Auto-Patch'}</span>
                  </button>
                </div>

                {/* Advanced Selection Panel */}
                {showAdvancedSelection && (
                  <div className={styles.advancedSelection}>
                    <div className={styles.selectionByType}>
                      <h4>Select by Type:</h4>
                      <div className={styles.typeButtons}>
                        <button
                          onClick={() => selectByType('rgb')}
                          className={styles.typeButton}
                        >
                          <LucideIcon name="Palette" />
                          RGB
                        </button>
                        <button
                          onClick={() => selectByType('movement')}
                          className={styles.typeButton}
                        >
                          <LucideIcon name="Move" />
                          Movement
                        </button>
                        <button
                          onClick={() => selectByType('dimmer')}
                          className={styles.typeButton}
                        >
                          <LucideIcon name="Sun" />
                          Dimmer
                        </button>
                      </div>
                    </div>
                    <div className={styles.smartSelection}>
                      <button
                        onClick={selectSimilar}
                        disabled={selectedFixtures.length === 0}
                        className={styles.smartButton}
                      >
                        <LucideIcon name="Copy" />
                        Select Similar
                      </button>
                      <button
                        onClick={selectAllFlagged}
                        className={styles.smartButton}
                      >
                        <LucideIcon name="Flag" />
                        All Flagged
                      </button>
                    </div>
                  </div>
                )}

                {/* Flag Management Panel */}
                {showFlagPanel && (
                  <div className={styles.flagPanel}>
                    <div className={styles.flagCreation}>
                      <input
                        type="text"
                        placeholder="Flag name"
                        value={newFlagName}
                        onChange={(e) => setNewFlagName(e.target.value)}
                        className={styles.flagInput}
                      />
                      <input
                        type="color"
                        value={newFlagColor}
                        onChange={(e) => setNewFlagColor(e.target.value)}
                        className={styles.colorInput}
                      />
                      <input
                        type="text"
                        placeholder="Category (optional)"
                        value={newFlagCategory}
                        onChange={(e) => setNewFlagCategory(e.target.value)}
                        className={styles.flagInput}
                      />
                      <button
                        onClick={createAndApplyFlag}
                        disabled={!newFlagName.trim() || selectedFixtures.length === 0}
                        className={styles.createFlagButton}
                      >
                        Create & Apply
                      </button>
                    </div>

                    {/* Quick Selection by Flag */}
                    {getAllUniqueFlags().length > 0 && (
                      <div className={styles.flagSelection}>
                        <h4>Select by Flag:</h4>
                        {getAllUniqueFlags().map((flag: any) => (
                          <button
                            key={flag.id}
                            onClick={() => selectByFlag(flag.id)}
                            className={styles.flagButton}
                            style={{ backgroundColor: flag.color }}
                          >
                            {flag.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quick Selection by Category */}
                    {getAllUniqueCategories().length > 0 && (
                      <div className={styles.categorySelection}>
                        <h4>Select by Category:</h4>
                        {getAllUniqueCategories().map(category => (
                          <button
                            key={category}
                            onClick={() => selectByFlagCategory(category)}
                            className={styles.categoryButton}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Clear Flags */}
                    {selectedFixtures.length > 0 && (
                      <button
                        onClick={removeSelectedFixtureFlags}
                        className={styles.clearFlagsButton}
                      >
                        Clear Flags from Selected
                      </button>
                    )}
                  </div>
                )}

                {/* Fixture comparison panel for selected fixtures */}
                {selectedFixtureDetails.length >= 2 && (
                  <div className={styles.comparisonPanel}>
                    <h4>
                      <LucideIcon name="Columns" />
                      Compare Selected Fixtures
                    </h4>
                    <div className={styles.comparisonTableWrapper}>
                      <table className={styles.comparisonTable}>
                        <thead>
                          <tr>
                            <th>Fixture</th>
                            <th>DMX Range</th>
                            <th>Channel Count</th>
                            <th>Key Channels</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedFixtureDetails.map(f => {
                            const hasRgb = f.channels.some(ch => ['red', 'green', 'blue'].includes(ch.type));
                            const hasMovement = f.channels.some(ch => ['pan', 'tilt'].includes(ch.type));
                            const hasDimmer = f.channels.some(ch => ch.type === 'dimmer');
                            const rangeStart = f.startAddress;
                            const rangeEnd = f.startAddress + f.channels.length - 1;

                            return (
                              <tr key={f.id}>
                                <td>{f.name}</td>
                                <td>{rangeStart}-{rangeEnd}</td>
                                <td>{f.channels.length}</td>
                                <td>
                                  {hasRgb && <span className={styles.typePill}>RGB</span>}
                                  {hasMovement && <span className={styles.typePill}>Move</span>}
                                  {hasDimmer && <span className={styles.typePill}>Dimmer</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Enhanced Fixture List with checkboxes */}
                <div className={styles.fixtureList}>
                  {filteredFixtures.length === 0 ? (
                    <div className={styles.noResults}>
                      <LucideIcon name="Search" />
                      <span>No fixtures found</span>
                    </div>
                  ) : (
                    filteredFixtures.map((fixture, index) => {
                      const isSelected = selectedFixtures.includes(fixture.id);
                      const hasRgb = fixture.channels.some(ch => ['red', 'green', 'blue'].includes(ch.type));
                      const hasMovement = fixture.channels.some(ch => ['pan', 'tilt'].includes(ch.type));
                      const hasDimmer = fixture.channels.some(ch => ch.type === 'dimmer');
                      
                      const conflict = fixtureHasConflict(fixture.id);
                      return (
                        <div
                          key={fixture.id || index}
                          className={`${styles.fixtureItem} ${isSelected ? styles.selected : ''} ${conflict ? styles.conflict : ''}`}
                          onClick={() => toggleFixtureSelection(fixture.id)}
                        >
                          <div className={styles.fixtureCheckbox}>
                            <div className={`${styles.checkbox} ${isSelected ? styles.checked : ''}`}>
                              {isSelected && <LucideIcon name="Check" />}
                            </div>
                          </div>
                          <div className={styles.fixtureContent}>
                            <div className={styles.fixtureHeader}>
                              <h4>{fixture.name}</h4>
                              <div className={styles.fixtureActions}>
                                <span className={styles.fixtureDmx}>
                                  DMX: {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                                  {conflict && (
                                    <span className={styles.conflictBadge} title="DMX address conflict detected">
                                      Conflict
                                    </span>
                                  )}
                                </span>
                                <div className={styles.fixtureTypes}>
                                  {hasRgb && <span className={styles.typeIndicator} title="RGB">🎨</span>}
                                  {hasMovement && <span className={styles.typeIndicator} title="Movement">↔️</span>}
                                  {hasDimmer && <span className={styles.typeIndicator} title="Dimmer">💡</span>}
                                </div>
                                <button
                                  className={`${styles.favoriteButton} ${fixture.isFavorite ? styles.favorited : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFavorite(fixture.id);
                                  }}
                                  title={fixture.isFavorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <LucideIcon name={fixture.isFavorite ? "Star" : "Star"} fill={fixture.isFavorite ? "currentColor" : "none"} />
                                </button>
                                <button
                                  className={styles.editButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditFixture(fixture);
                                  }}
                                  title="Edit fixture"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  className={styles.nodeEditorButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openNodeEditor(fixture.id);
                                  }}
                                  title="Open Node Editor"
                                >
                                  <i className="fas fa-project-diagram"></i>
                                </button>
                                <button
                                  className={styles.deleteButton}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFixture(fixture.id);
                                  }}
                                  title="Delete fixture"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </div>
                            <div className={styles.fixtureChannels}>
                              {fixture.channels.map((channel, chIndex) => (
                                <div key={chIndex} className={styles.channelTag}>
                                  <span className={`${styles.channelType} ${styles[channel.type]}`}>
                                    {channel.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Display flags if any */}
                            {fixture.flags && fixture.flags.length > 0 && (
                              <div className={styles.fixtureFlags}>
                                {fixture.flags.map((flag: any) => (
                                  <span
                                    key={flag.id}
                                    className={styles.flagTag}
                                    style={{ backgroundColor: flag.color }}
                                    title={flag.category ? `${flag.name} (${flag.category})` : flag.name}
                                  >
                                    {flag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
              {showCreateFixture ? (<>
              <div className={styles.fixtureForm}>
                <h4>
                  {editingFixtureId ? (
                    <>
                      {theme === 'artsnob' && 'Refine Fixture: Sculpting Light Anew'}
                      {theme === 'standard' && 'Edit Fixture'}
                      {theme === 'minimal' && 'Edit Fixture'}
                    </>
                  ) : (
                    <>
                      {theme === 'artsnob' && 'Create New Fixture: Birth of a Light Vessel'}
                      {theme === 'standard' && 'New Fixture'}
                      {theme === 'minimal' && 'New Fixture'}
                    </>
                  )}
                </h4>
                  <div className={styles.formGroup}>
                  <label htmlFor="fixtureName">Name:</label>
                  <input
                    type="text"
                    id="fixtureName"
                    value={fixtureForm.name}
                    onChange={(e) => handleFixtureChange('name', e.target.value)}
                    placeholder="Enter fixture name"
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="fixtureType">Type:</label>
                    <div className={styles.dropdownWithCustom}>
                      <select
                        id="fixtureType"
                        value={fixtureForm.type}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__custom__') {
                            const customValue = prompt('Enter custom type:');
                            if (customValue) {
                              addCustomType(customValue);
                              handleFixtureChange('type', customValue);
                            }
                          } else {
                            handleFixtureChange('type', value);
                          }
                        }}
                      >
                        <option value="">Select or add type...</option>
                        {fixtureTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                        <option value="__custom__">+ Add Custom Type</option>
                      </select>
                      {fixtureForm.type && !fixtureTypes.includes(fixtureForm.type) && (
                        <button
                          type="button"
                          className={styles.addToDropdownButton}
                          onClick={() => addCustomType(fixtureForm.type)}
                          title="Add to dropdown list"
                        >
                          <LucideIcon name="Plus" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="fixtureManufacturer">Manufacturer:</label>
                    <div className={styles.dropdownWithCustom}>
                      <select
                        id="fixtureManufacturer"
                        value={fixtureForm.manufacturer}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '__custom__') {
                            const customValue = prompt('Enter custom manufacturer:');
                            if (customValue) {
                              addCustomManufacturer(customValue);
                              handleFixtureChange('manufacturer', customValue);
                            }
                          } else {
                            handleFixtureChange('manufacturer', value);
                          }
                        }}
                      >
                        <option value="">Select or add manufacturer...</option>
                        {manufacturers.map(manufacturer => (
                          <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                        ))}
                        <option value="__custom__">+ Add Custom Manufacturer</option>
                      </select>
                      {fixtureForm.manufacturer && !manufacturers.includes(fixtureForm.manufacturer) && (
                        <button
                          type="button"
                          className={styles.addToDropdownButton}
                          onClick={() => addCustomManufacturer(fixtureForm.manufacturer)}
                          title="Add to dropdown list"
                        >
                          <LucideIcon name="Plus" size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="fixtureMode">Mode:</label>
                    {currentTemplate && currentTemplate.modes ? (
                      <select
                        id="fixtureMode"
                        value={fixtureForm.mode}
                        onChange={(e) => {
                          const selectedMode = currentTemplate.modes?.find(m => m.name === e.target.value);
                          if (selectedMode) {
                            handleFixtureChange('mode', e.target.value);
                            // Update channels when mode changes
                            setFixtureForm(prev => ({
                              ...prev,
                              channels: JSON.parse(JSON.stringify(selectedMode.channelData))
                            }));
                          }
                        }}
                      >
                        {currentTemplate.modes.map(mode => (
                          <option key={mode.name} value={mode.name}>
                            {mode.name} ({mode.channels} channels)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        id="fixtureMode"
                        value={fixtureForm.mode}
                        onChange={(e) => handleFixtureChange('mode', e.target.value)}
                        placeholder="e.g., 16-bit, Extended"
                      />
                    )}
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="fixtureStartAddress">Start Address:</label>
                  <input
                    type="number"
                    id="fixtureStartAddress"
                    value={fixtureForm.startAddress}
                    onChange={(e) => handleFixtureChange('startAddress', parseInt(e.target.value) || 1)}
                    min="1"
                    max="512"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Tags:</label>
                  <div className={styles.tagsContainer}>
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className={`${styles.tagButton} ${(fixtureForm.tags || []).includes(tag) ? styles.tagActive : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {(fixtureForm.tags || []).length > 0 && (
                    <div className={styles.selectedTags}>
                      Selected: {(fixtureForm.tags || []).join(', ')}
                    </div>
                  )}
                </div>

                <div className={`${styles.formGroup} ${styles.notesField}`}>
                  <label htmlFor="fixtureNotes">Notes:</label>
                  <textarea
                    id="fixtureNotes"
                    value={fixtureForm.notes}
                    onChange={(e) => handleFixtureChange('notes', e.target.value)}
                    placeholder="Optional notes about this fixture (DMX modes, special features, etc.)"
                    rows={3}
                  />
                </div>
                
                <div className={`${styles.formGroup} ${styles.photoField}`}>
                  <label>
                    {theme === 'artsnob' && 'Fixture Photo: The Visual Archetype'}
                    {theme === 'standard' && 'Fixture Photo'}
                    {theme === 'minimal' && 'Photo'}
                  </label>
                  <div className={styles.photoUploadContainer}>
                    {fixtureForm.photoUrl ? (
                      <div className={styles.photoPreview}>
                        <img src={fixtureForm.photoUrl} alt="Fixture thumbnail" />
                        <button
                          type="button"
                          className={styles.removePhotoButton}
                          onClick={() => handleFixtureChange('photoUrl', undefined)}
                          title="Remove photo"
                        >
                          <LucideIcon name="X" size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.photoPlaceholder}>
                        <LucideIcon name="Image" size={48} />
                        <p>No photo uploaded</p>
                      </div>
                    )}
                    <div className={styles.photoActions}>
                      <label className={styles.uploadButton}>
                        <LucideIcon name="Upload" size={16} />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const dataUrl = event.target?.result as string;
                                handleFixtureChange('photoUrl', dataUrl);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {currentTemplate?.photoUrl && (
                        <button
                          type="button"
                          className={styles.useTemplatePhotoButton}
                          onClick={() => handleFixtureChange('photoUrl', currentTemplate.photoUrl)}
                          title="Use photo from selected template"
                        >
                          <LucideIcon name="Copy" size={16} />
                          Use Template Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <h5>
                  {theme === 'artsnob' && 'Channels: The Dimensions of Control'}
                  {theme === 'standard' && 'Channels'}
                  {theme === 'minimal' && 'Channels'}
                </h5>
                
                <div className={styles.channelsList}>
                  {fixtureForm.channels.map((channel, index) => {
                    const calculatedDmxAddress = fixtureForm.startAddress + index;
                    const actualDmxAddress = channel.dmxAddress !== undefined ? channel.dmxAddress : calculatedDmxAddress;
                    const editState = dmxEditStates[index] || { isEditing: false, value: actualDmxAddress.toString() };
                    
                    return (
                      <div key={index} className={styles.channelForm}>
                        <div className={styles.channelFormRow}>
                          <div className={styles.channelNameSection}>
                            <label className={styles.channelNameLabel}>CHANNEL NAME</label>
                            <input
                              type="text"
                              value={channel.name}
                              onChange={(e) => handleChannelChange(index, 'name', e.target.value)}
                              placeholder="Channel name"
                              className={styles.channelNameInput}
                            />
                          </div>
                          
                          <div className={styles.channelTypeSection}>
                            <label className={styles.channelTypeLabel}>TYPE</label>
                            <select
                              value={channel.type}
                              onChange={(e) => handleChannelChange(index, 'type', e.target.value)}
                              className={styles.channelTypeSelect}
                            >
                              {channelTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <button
                            className={styles.removeButton}
                            onClick={() => removeChannel(index)}
                            disabled={fixtureForm.channels.length === 1}
                            title="Remove channel"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <div className={styles.channelDmxInfo}>
                          <div className={styles.dmxSection}>
                            <label className={styles.dmxLabel}>DMX</label>
                            {editState.isEditing ? (
                              <div className={styles.dmxEditContainer}>
                                <input
                                  type="number"
                                  value={editState.value}
                                  onChange={(e) => setDmxEditStates(prev => ({ ...prev, [index]: { isEditing: true, value: e.target.value } }))}
                                  onBlur={() => {
                                    const newAddress = parseInt(editState.value);
                                    if (!isNaN(newAddress) && newAddress >= 1 && newAddress <= 512) {
                                      handleDmxAddressOverride(index, newAddress);
                                    } else {
                                      handleDmxAddressOverride(index, undefined);
                                    }
                                    setDmxEditStates(prev => ({ ...prev, [index]: { isEditing: false, value: actualDmxAddress.toString() } }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const newAddress = parseInt(editState.value);
                                      if (!isNaN(newAddress) && newAddress >= 1 && newAddress <= 512) {
                                        handleDmxAddressOverride(index, newAddress);
                                      } else {
                                        handleDmxAddressOverride(index, undefined);
                                      }
                                      setDmxEditStates(prev => ({ ...prev, [index]: { isEditing: false, value: actualDmxAddress.toString() } }));
                                    } else if (e.key === 'Escape') {
                                      setDmxEditStates(prev => ({ ...prev, [index]: { isEditing: false, value: actualDmxAddress.toString() } }));
                                    }
                                  }}
                                  className={styles.dmxEditInput}
                                  min="1"
                                  max="512"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className={styles.dmxValueContainer}>
                                <span className={styles.dmxAddressValue}>
                                  {actualDmxAddress}
                                  {channel.dmxAddress !== undefined && (
                                    <span className={styles.overrideIndicator} title="DMX address overridden">*</span>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  className={styles.dmxEditButton}
                                  onClick={() => {
                                    setDmxEditStates(prev => ({ ...prev, [index]: { isEditing: true, value: actualDmxAddress.toString() } }));
                                  }}
                                  title="Override DMX address"
                                >
                                  <LucideIcon name="Edit" size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          <MidiLearnButton 
                            channelIndex={actualDmxAddress - 1} // Pass 0-indexed DMX channel
                            className={styles.channelMidiLearnButton} 
                          />
                          <div className={styles.oscControl}>
                            <label className={styles.oscLabel}>OSC</label>
                            <input
                              type="text"
                              value={oscAssignments[actualDmxAddress - 1] || ''}
                              onChange={(e) => setOscAssignment(actualDmxAddress - 1, e.target.value)}
                              className={styles.oscInput}
                              placeholder="/dmx/channel/X"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className={styles.formActions}>
                  <button 
                    className={styles.addChannelButton} 
                    onClick={addChannel}
                  >
                    <i className="fas fa-plus"></i> Add Channel
                  </button>
                    <div className={styles.saveActions}>
                    <button 
                      className={styles.cancelButton}
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                    <button 
                      className={styles.saveButton}
                      onClick={saveFixture}
                      disabled={!fixtureForm.name || fixtureForm.channels.length === 0}
                    >
                      <i className="fas fa-save"></i>
                      {editingFixtureId ? (
                        <>
                          {theme === 'artsnob' && 'Refine & Preserve'}
                          {theme === 'standard' && 'Update Fixture'}
                          {theme === 'minimal' && 'Update'}
                        </>
                      ) : (
                        <>
                          {theme === 'artsnob' && 'Immortalize Fixture'}
                          {theme === 'standard' && 'Save Fixture'}
                          {theme === 'minimal' && 'Save'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              {/* Discovery Wizard removed */}
              {/* end fixture form */}
              </> ) : (              <button 
                className={styles.createButton}
                onClick={() => {                  setFixtureForm({ 
                    name: '',
                    type: '',
                    manufacturer: '',
                    mode: '',
                    startAddress: calculateNextStartAddress(),
                    channels: [{ name: 'Intensity', type: 'dimmer' }],
                    notes: '',
                    photoUrl: undefined,
                    tags: []
                  });
                  setEditingFixtureId(null);
                  setShowCreateFixture(true);
                }}
              >
                <i className="fas fa-plus"></i>
                {theme === 'artsnob' && 'Craft Custom Fixture'}
                {theme === 'standard' && 'Add Custom Fixture'}
                {theme === 'minimal' && 'Custom'}
              </button>
            )}
            {!showCreateFixture && (
              <div className={styles.templateSection}>
                <div className={styles.templateHeader}>
                  <h4 className={styles.templateTitle}>
                    {theme === 'artsnob' ? 'Or, select an archetype:' : 
                     theme === 'standard' ? 'Create from template:' : 'Templates:'}
                  </h4>
                  <button
                    className={styles.manageTemplatesButton}
                    onClick={() => setShowTemplateManager(true)}
                    title="Manage templates"
                  >
                    <LucideIcon name="Settings" />
                    {theme === 'artsnob' && 'Manage Templates'}
                    {theme === 'standard' && 'Manage Templates'}
                    {theme === 'minimal' && 'Templates'}
                  </button>
                </div>
                <div className={styles.templateColumns}>
                  {/* Built-in Column */}
                  <div className={styles.templateColumn}>
                    <h5 className={styles.columnTitle}>
                      <LucideIcon name="Package" />
                      Built-in
                    </h5>
                    <div className={styles.templateButtons}>
                      {fixtureTemplates.filter(t => t.isBuiltIn && !t.isFavorite).map(template => (
                        <button
                          key={template.id}
                          className={`${styles.templateButton} ${styles.builtInTemplate}`}
                          onClick={() => {
                            const nextAddress = calculateNextStartAddress();
                            const existingNames = fixtures.map(f => f.name);
                            let suggestedName = template.defaultNamePrefix;
                            let counter = 1;
                            while (existingNames.includes(suggestedName)) {
                              suggestedName = `${template.defaultNamePrefix} ${counter++}`;
                            }
                            setFixtureForm({
                              name: suggestedName,
                              type: template.type || '',
                              manufacturer: template.manufacturer || '',
                              mode: template.modes ? template.modes[0].name : '',
                              startAddress: nextAddress,
                              channels: template.modes ? JSON.parse(JSON.stringify(template.modes[0].channelData)) : JSON.parse(JSON.stringify(template.channels || [])),
                              notes: '',
                              photoUrl: template.photoUrl,
                              tags: template.tags || []
                            });
                            setCurrentTemplate(template);
                            setEditingFixtureId(null);
                            setShowCreateFixture(true);
                          }}
                          title={`${template.modes ? template.modes[0].channels : (template.channels?.length || 0)} channels`}
                        >
                          <div className={styles.templateImage}>
                            {template.photoUrl ? (
                              <img src={template.photoUrl} alt={template.templateName} />
                            ) : (
                              <div className={styles.imagePlaceholder}>
                                <LucideIcon name="Image" size={24} />
                              </div>
                            )}
                          </div>
                          <div className={styles.templateInfo}>
                            <span className={styles.templateName}>{template.templateName}</span>
                            {template.manufacturer && (
                              <span className={styles.templateManufacturer}>{template.manufacturer}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Favourites Column */}
                  <div className={styles.templateColumn}>
                    <h5 className={styles.columnTitle}>
                      <LucideIcon name="Star" />
                      Favourites
                    </h5>
                    <div className={styles.templateButtons}>
                      {fixtureTemplates.filter(t => t.isFavorite).map(template => (
                        <button
                          key={template.id}
                          className={`${styles.templateButton} ${styles.favoriteTemplate}`}
                          onClick={() => {
                            const nextAddress = calculateNextStartAddress();
                            const existingNames = fixtures.map(f => f.name);
                            let suggestedName = template.defaultNamePrefix;
                            let counter = 1;
                            while (existingNames.includes(suggestedName)) {
                              suggestedName = `${template.defaultNamePrefix} ${counter++}`;
                            }
                            setFixtureForm({
                              name: suggestedName,
                              type: template.type || '',
                              manufacturer: template.manufacturer || '',
                              mode: template.modes ? template.modes[0].name : '',
                              startAddress: nextAddress,
                              channels: template.modes ? JSON.parse(JSON.stringify(template.modes[0].channelData)) : JSON.parse(JSON.stringify(template.channels || [])),
                              notes: '',
                              photoUrl: template.photoUrl,
                              tags: template.tags || []
                            });
                            setCurrentTemplate(template);
                            setEditingFixtureId(null);
                            setShowCreateFixture(true);
                          }}
                          title={`${template.modes ? template.modes[0].channels : (template.channels?.length || 0)} channels`}
                        >
                          <div className={styles.templateImage}>
                            {template.photoUrl ? (
                              <img src={template.photoUrl} alt={template.templateName} />
                            ) : (
                              <div className={styles.imagePlaceholder}>
                                <LucideIcon name="Image" size={24} />
                              </div>
                            )}
                          </div>
                          <div className={styles.templateInfo}>
                            <span className={styles.templateName}>{template.templateName}</span>
                            {template.manufacturer && (
                              <span className={styles.templateManufacturer}>{template.manufacturer}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Column */}
                  <div className={styles.templateColumn}>
                    <h5 className={styles.columnTitle}>
                      <LucideIcon name="Folder" />
                      Custom
                    </h5>
                    <div className={styles.templateButtons}>
                      {fixtureTemplates.filter(t => t.isCustom && !t.isBuiltIn).map(template => (
                        <button
                          key={template.id}
                          className={`${styles.templateButton} ${styles.customTemplate}`}
                          onClick={() => {
                            const nextAddress = calculateNextStartAddress();
                            const existingNames = fixtures.map(f => f.name);
                            let suggestedName = template.defaultNamePrefix;
                            let counter = 1;
                            while (existingNames.includes(suggestedName)) {
                              suggestedName = `${template.defaultNamePrefix} ${counter++}`;
                            }
                            setFixtureForm({
                              name: suggestedName,
                              type: template.type || '',
                              manufacturer: template.manufacturer || '',
                              mode: template.modes ? template.modes[0].name : '',
                              startAddress: nextAddress,
                              channels: template.modes ? JSON.parse(JSON.stringify(template.modes[0].channelData)) : JSON.parse(JSON.stringify(template.channels || [])),
                              notes: '',
                              photoUrl: template.photoUrl,
                              tags: template.tags || []
                            });
                            setCurrentTemplate(template);
                            setEditingFixtureId(null);
                            setShowCreateFixture(true);
                          }}
                          title={`${template.modes ? template.modes[0].channels : (template.channels?.length || 0)} channels`}
                        >
                          <div className={styles.templateImage}>
                            {template.photoUrl ? (
                              <img src={template.photoUrl} alt={template.templateName} />
                            ) : (
                              <div className={styles.imagePlaceholder}>
                                <LucideIcon name="Image" size={24} />
                              </div>
                            )}
                          </div>
                          <div className={styles.templateInfo}>
                            <span className={styles.templateName}>{template.templateName}</span>
                            {template.manufacturer && (
                              <span className={styles.templateManufacturer}>{template.manufacturer}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Group Management Section */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>
              {theme === 'artsnob' && 'Fixture Groups: The Constellations of Light'}
              {theme === 'standard' && 'Groups'}
              {theme === 'minimal' && 'Groups'}
            </h3>
          </div>
          <div className={styles.cardBody}>
            {groups.length === 0 ? (
              <div className={styles.emptyState}>
                <i className="fas fa-object-group"></i>
                <p>No groups have been created yet</p>
              </div>
            ) : (
              <div className={styles.groupList}>
                {groups.map((group, index) => (
                  <div key={index} className={styles.groupItem}>                    <div className={styles.groupHeader}>
                      <h4>{group.name}</h4>
                      <div className={styles.groupActions}>
                        <span className={styles.groupCount}>
                          {group.fixtureIndices.length} fixture{group.fixtureIndices.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          className={styles.editButton}
                          onClick={() => startEditGroup(group)}
                          title="Edit group"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => deleteGroup(group)}
                          title="Delete group"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                    <div className={styles.groupFixtures}>
                      {group.fixtureIndices.map(fixtureIndex => (
                        <div key={fixtureIndex} className={styles.groupFixtureTag}>
                          {fixtures[fixtureIndex]?.name || `Fixture #${fixtureIndex}`}
                        </div>
                      ))}
                    </div>
                    <div className={styles.groupActions}>
                      <button
                        className={styles.editButton}
                        onClick={() => startEditGroup(group)}
                        title="Edit group"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => deleteGroup(group)}
                        title="Delete group"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {showCreateGroup ? (
              <div className={styles.groupForm}>
                <h4>
                  {theme === 'artsnob' && 'Create Fixture Group: The Collective Expression'}
                  {theme === 'standard' && 'New Group'}
                  {theme === 'minimal' && 'New Group'}
                </h4>
                
                <div className={styles.formGroup}>
                  <label htmlFor="groupName">Name:</label>
                  <input
                    type="text"
                    id="groupName"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter group name"
                  />
                </div>
                
                <h5>
                  {theme === 'artsnob' && 'Select Fixtures: Choose Your Instruments'}
                  {theme === 'standard' && 'Select Fixtures'}
                  {theme === 'minimal' && 'Fixtures'}
                </h5>
                
                {fixtures.length === 0 ? (
                  <p className={styles.noFixturesMessage}>No fixtures available to add to group</p>
                ) : (
                  <div className={styles.fixtureSelection}>
                    {fixtures.map((fixture, index) => (
                      <div 
                        key={index}
                        className={`${styles.selectableFixture} ${
                          groupForm.fixtureIndices.includes(index) ? styles.selected : ''
                        }`}
                        onClick={() => toggleFixtureForGroup(index)}
                      >
                        <div className={styles.fixtureCheckbox}>
                          <input
                            type="checkbox"
                            checked={groupForm.fixtureIndices.includes(index)}
                            onChange={() => {}} // Handled by the div click
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className={styles.fixtureInfo}>
                          <span className={styles.fixtureName}>{fixture.name}</span>
                          <span className={styles.fixtureDmx}>
                            DMX: {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className={styles.formActions}>
                  <button 
                    className={styles.cancelButton}
                    onClick={() => setShowCreateGroup(false)}
                  >
                    Cancel
                  </button>                    <button 
                      className={styles.saveButton}
                      onClick={editingGroupId ? updateGroup : saveGroup}
                      disabled={!groupForm.name || groupForm.fixtureIndices.length === 0}
                    >
                      <i className="fas fa-save"></i>
                      {editingGroupId ? (
                        <>
                          {theme === 'artsnob' && 'Update Collective'}
                          {theme === 'standard' && 'Update Group'}
                          {theme === 'minimal' && 'Update'}
                        </>
                      ) : (
                        <>
                          {theme === 'artsnob' && 'Establish Collective'}
                          {theme === 'standard' && 'Save Group'}
                          {theme === 'minimal' && 'Save'}
                        </>
                      )}
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className={styles.createButton}
                onClick={() => setShowCreateGroup(true)}
                disabled={fixtures.length === 0}
              >
                <i className="fas fa-plus"></i>                {theme === 'artsnob' && 'Create Fixture Group'}
                {theme === 'standard' && 'Add Group'}
                {theme === 'minimal' && 'Add'}
              </button>
            )}
          </div>
        </div>
        
        {/* {showSuperControlPreview && (
          <div className={styles.previewContainer}>
            <div className={styles.previewHeader}>
              <h3>SuperControl Preview</h3>
              <span className={styles.previewNote}>Live preview of fixture controls</span>
            </div>
            <div className={styles.superControlWrapper}>
              <SuperControlTidy isDockable={false} />
            </div>
          </div>
        )} */}
      </div> {/* End mainArea */}
      
      {showSuperControlPreview && (
        <div className={styles.previewModal}>
          <div className={styles.previewSectionHeader}>
            <h3>SuperControl Live Preview</h3>
            <p>Real-time control preview for selected fixtures</p>
          </div>
          <div className={styles.previewContent}>
            <SuperControlEnhanced />
          </div>
        </div>
      )}

      {/* Node-Based Fixture Editor */}
      {showNodeEditor && nodeEditorFixtureId && (
        <NodeBasedFixtureEditor
          fixtureId={nodeEditorFixtureId}
          onClose={closeNodeEditor}
        />
      )}

      {/* Template Manager */}
      {showTemplateManager && (
        <FixtureTemplateManager
          onClose={() => setShowTemplateManager(false)}
          onSelectTemplate={(template) => {
            const nextAddress = calculateNextStartAddress();
            const existingNames = fixtures.map(f => f.name);
            let suggestedName = template.defaultNamePrefix;
            let counter = 1;
            while (existingNames.includes(suggestedName)) {
              suggestedName = `${template.defaultNamePrefix} ${counter++}`;
            }
            setFixtureForm({
              name: suggestedName,
              type: '',
              manufacturer: '',
              mode: '',
              startAddress: nextAddress,
              channels: JSON.parse(JSON.stringify(template.channels)),
              notes: '',
              photoUrl: undefined,
              tags: []
            });
            setEditingFixtureId(null);
            setShowCreateFixture(true);
            setShowTemplateManager(false);
          }}
        />
      )}
    </div>
  )
}