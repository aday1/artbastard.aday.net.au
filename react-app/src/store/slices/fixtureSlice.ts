import axios from 'axios';
import { Fixture, Group, FixtureTemplate, FixtureFlag, PlacedFixture } from '../types';

export interface FixtureSlice {
  // Fixtures and Groups State
  fixtures: Fixture[];
  groups: Group[];
  selectedFixtures: string[];
  fixtureTemplates: FixtureTemplate[];
  fixtureLayout: PlacedFixture[];
  placedFixtures: PlacedFixture[];

  // Fixture Actions
  addFixture: (fixture: Fixture) => void;
  deleteFixture: (fixtureId: string) => void;
  setFixtures: (fixtures: Fixture[]) => void;
  setGroups: (groups: Group[]) => void;

  // Template Management
  addFixtureTemplate: (template: Omit<FixtureTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFixtureTemplate: (id: string, template: Partial<FixtureTemplate>) => void;
  deleteFixtureTemplate: (id: string) => void;
  getFixtureTemplate: (id: string) => FixtureTemplate | undefined;

  // Fixture Selection Actions
  selectNextFixture: () => void;
  selectPreviousFixture: () => void;
  selectAllFixtures: () => void;
  selectFixturesByType: (channelType: string) => void;
  selectFixtureGroup: (groupId: string) => void;
  setSelectedFixtures: (fixtureIds: string[]) => void;
  toggleFixtureSelection: (fixtureId: string) => void;
  deselectAllFixtures: () => void;

  // Placed Fixture Actions
  addPlacedFixture: (fixture: Omit<PlacedFixture, 'id'>) => void;
  updatePlacedFixture: (id: string, updates: Partial<PlacedFixture>) => void;
  removePlacedFixture: (id: string) => void;
  setFixtureLayout: (layout: PlacedFixture[]) => void;

  // Fixture Flagging Actions
  addFixtureFlag: (fixtureId: string, flag: FixtureFlag) => void;
  removeFixtureFlag: (fixtureId: string, flagId: string) => void;
  toggleFixtureFlag: (fixtureId: string, flagId: string) => void;
  updateFixtureFlag: (fixtureId: string, flagId: string, updates: Partial<FixtureFlag>) => void;
  clearFixtureFlags: (fixtureId: string) => void;
  getFixturesByFlag: (flagId: string) => Fixture[];
  getFixturesByFlagCategory: (category: string) => Fixture[];
  createQuickFlag: (name: string, color: string, category: string) => FixtureFlag;
  bulkAddFlag: (fixtureIds: string[], flag: FixtureFlag) => void;
  bulkRemoveFlag: (fixtureIds: string[], flagId: string) => void;

  // Fixture Helper Functions
  getChannelInfo: (dmxAddress: number) => {
    fixtureName: string;
    fixtureType: string;
    fixtureId: string;
    channelName: string;
    channelType: string;
    channelIndex: number;
    startAddress: number;
  } | null;
  getFixtureColor: (fixtureId: string) => string;
  isChannelAssigned: (dmxAddress: number) => boolean;
}

export const createFixtureSlice = (
  set: any,
  get: any
): FixtureSlice => ({
  // Initial state
  fixtures: (() => {
    try {
      const saved = localStorage.getItem('artbastard-fixtures');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          console.log('[Fixture Store] Loaded fixtures from localStorage:', parsed.length);
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load fixtures from localStorage:', e);
    }
    return [];
  })(),
  groups: [],
  selectedFixtures: [],
  fixtureTemplates: [], // Will be initialized separately
  fixtureLayout: [],
  placedFixtures: [],

  // Fixture Actions
  addFixture: (fixture) => {
    const updatedFixtures = [...get().fixtures, fixture];
    set({ fixtures: updatedFixtures });
    
    try {
      localStorage.setItem('artbastard-fixtures', JSON.stringify(updatedFixtures));
      console.log('[Fixture Store] Saved fixtures to localStorage after add:', updatedFixtures.length);
    } catch (e) {
      console.error('Failed to save fixtures to localStorage:', e);
    }
    
    console.log('[Fixture Store] Fixture added:', {
      name: fixture.name,
      address: fixture.startAddress,
      channels: fixture.channels?.length || 0,
      type: fixture.type || 'generic',
      totalFixtures: updatedFixtures.length
    });

    axios.post(`/api/fixtures/${fixture.id}`, fixture)
      .then(() => {
        console.log('[Fixture Store] Fixture saved to server:', fixture.id);
      })
      .catch(error => {
        console.error('Failed to save new fixture to backend:', error);
        get().addNotification?.({ message: 'Failed to save new fixture to server', type: 'error' });
      });
  },

  deleteFixture: (fixtureId) => {
    const updatedFixtures = get().fixtures.filter(f => f.id !== fixtureId);
    set({ fixtures: updatedFixtures });
    
    try {
      localStorage.setItem('artbastard-fixtures', JSON.stringify(updatedFixtures));
      console.log('[Fixture Store] Saved fixtures to localStorage after delete:', updatedFixtures.length);
    } catch (e) {
      console.error('Failed to save fixtures to localStorage:', e);
    }
    
    axios.delete(`/api/fixtures/${fixtureId}`)
      .then(() => {
        get().addNotification?.({
          message: 'Fixture deleted successfully',
          type: 'success',
          priority: 'normal'
        });
      })
      .catch(error => {
        console.error('Failed to delete fixture on backend:', error);
        get().addNotification?.({
          message: 'Failed to delete fixture on server',
          type: 'error',
          priority: 'high'
        });
      });
  },

  setFixtures: (fixtures) => {
    set({ fixtures });
    try {
      localStorage.setItem('artbastard-fixtures', JSON.stringify(fixtures));
      console.log('[Fixture Store] Saved fixtures to localStorage:', fixtures.length);
    } catch (e) {
      console.error('Failed to save fixtures to localStorage:', e);
    }
  },

  setGroups: (groups) => {
    set({ groups });
  },

  // Template Management Actions
  addFixtureTemplate: (template) => {
    const validatedChannels = template.channels && Array.isArray(template.channels) && template.channels.length > 0
      ? template.channels
      : [{ name: 'Channel 1', type: 'other' }];
    
    const newTemplate: FixtureTemplate = {
      ...template,
      channels: validatedChannels,
      id: `template-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      isCustom: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    set(state => {
      const updatedTemplates = [...state.fixtureTemplates, newTemplate];
      try {
        const customTemplates = updatedTemplates.filter(t => !t.isBuiltIn);
        localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
      } catch (error) {
        console.warn('Failed to save templates to localStorage:', error);
      }
      
      axios.post('/api/fixture-templates', { templates: updatedTemplates })
        .catch(error => {
          console.error('Failed to save templates to server:', error);
          get().addNotification?.({
            message: 'Template saved locally but failed to save to server',
            type: 'warning',
            priority: 'normal'
          });
        });
      
      return { fixtureTemplates: updatedTemplates };
    });
    
    get().addNotification?.({
      message: `Template "${template.templateName}" saved`,
      type: 'success',
      priority: 'normal'
    });
  },

  updateFixtureTemplate: (id, updates) => {
    set(state => {
      const updatedTemplates = state.fixtureTemplates.map(template =>
        template.id === id
          ? { ...template, ...updates, updatedAt: Date.now() }
          : template
      );
      try {
        const customTemplates = updatedTemplates.filter(t => !t.isBuiltIn);
        localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
      } catch (error) {
        console.warn('Failed to save templates to localStorage:', error);
      }
      
      axios.post('/api/fixture-templates', { templates: updatedTemplates })
        .catch(error => {
          console.error('Failed to save templates to server:', error);
        });
      
      return { fixtureTemplates: updatedTemplates };
    });
    
    get().addNotification?.({
      message: 'Template updated',
      type: 'success',
      priority: 'normal'
    });
  },

  deleteFixtureTemplate: (id) => {
    set(state => {
      const updatedTemplates = state.fixtureTemplates.filter(template => {
        if (template.isBuiltIn) return true;
        return template.id !== id;
      });
      try {
        const customTemplates = updatedTemplates.filter(t => !t.isBuiltIn);
        localStorage.setItem('fixtureTemplates', JSON.stringify(customTemplates));
      } catch (error) {
        console.warn('Failed to save templates to localStorage:', error);
      }
      
      axios.post('/api/fixture-templates', { templates: updatedTemplates })
        .catch(error => {
          console.error('Failed to save templates to server:', error);
        });
      
      return { fixtureTemplates: updatedTemplates };
    });
    
    get().addNotification?.({
      message: 'Template deleted',
      type: 'success',
      priority: 'normal'
    });
  },

  getFixtureTemplate: (id) => {
    return get().fixtureTemplates.find(template => template.id === id);
  },

  // Fixture Selection Actions
  selectNextFixture: () => {
    const { fixtures, selectedFixtures } = get();
    if (fixtures.length === 0) return;

    let nextIndex = 0;
    if (selectedFixtures.length > 0) {
      const currentIndex = fixtures.findIndex(f => f.id === selectedFixtures[0]);
      nextIndex = (currentIndex + 1) % fixtures.length;
    }

    const nextFixture = fixtures[nextIndex];
    if (nextFixture) {
      set({ selectedFixtures: [nextFixture.id] });
      get().addNotification?.({
        message: `Selected fixture: ${nextFixture.name}`,
        type: 'info',
        priority: 'low'
      });
    }
  },

  selectPreviousFixture: () => {
    const { fixtures, selectedFixtures } = get();
    if (fixtures.length === 0) return;

    let prevIndex = fixtures.length - 1;
    if (selectedFixtures.length > 0) {
      const currentIndex = fixtures.findIndex(f => f.id === selectedFixtures[0]);
      prevIndex = currentIndex === 0 ? fixtures.length - 1 : currentIndex - 1;
    }

    const prevFixture = fixtures[prevIndex];
    if (prevFixture) {
      set({ selectedFixtures: [prevFixture.id] });
      get().addNotification?.({
        message: `Selected fixture: ${prevFixture.name}`,
        type: 'info',
        priority: 'low'
      });
    }
  },

  selectAllFixtures: () => {
    const { fixtures } = get();
    set({ selectedFixtures: fixtures.map(f => f.id) });
    get().addNotification?.({
      message: `Selected all ${fixtures.length} fixtures`,
      type: 'info',
      priority: 'low'
    });
  },

  selectFixturesByType: (channelType) => {
    const { fixtures } = get();
    const filteredFixtures = fixtures.filter(fixture =>
      fixture.channels.some(ch => ch.type.toLowerCase() === channelType.toLowerCase())
    );

    set({ selectedFixtures: filteredFixtures.map(f => f.id) });
    get().addNotification?.({
      message: `Selected ${filteredFixtures.length} fixtures with ${channelType} channels`,
      type: 'info',
      priority: 'low'
    });
  },

  selectFixtureGroup: (groupId) => {
    const { fixtures, groups } = get();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    const groupFixtures = group.fixtureIndices
      .map(index => fixtures[index])
      .filter(Boolean)
      .map(f => f.id);

    set({ selectedFixtures: groupFixtures });
    get().addNotification?.({
      message: `Selected group: ${group.name} (${groupFixtures.length} fixtures)`,
      type: 'info',
      priority: 'low'
    });
  },

  setSelectedFixtures: (fixtureIds) => {
    set({ selectedFixtures: fixtureIds });
  },

  toggleFixtureSelection: (fixtureId) => {
    const { selectedFixtures } = get();
    const newSelection = selectedFixtures.includes(fixtureId)
      ? selectedFixtures.filter(id => id !== fixtureId)
      : [...selectedFixtures, fixtureId];
    set({ selectedFixtures: newSelection });
  },

  deselectAllFixtures: () => {
    set({ selectedFixtures: [] });
    get().addNotification?.({
      message: 'Deselected all fixtures',
      type: 'info',
      priority: 'low'
    });
  },

  // Placed Fixture Actions
  addPlacedFixture: (fixture) => {
    const { placedFixtures } = get();
    const newFixture: PlacedFixture = {
      ...fixture,
      id: `placed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dmxAddress: fixture.dmxAddress || fixture.startAddress || 1,
      type: fixture.type || 'generic'
    };
    set({ placedFixtures: [...placedFixtures, newFixture] });
  },

  updatePlacedFixture: (id, updates) => {
    const { placedFixtures } = get();
    const updatedFixtures = placedFixtures.map(fixture =>
      fixture.id === id ? { ...fixture, ...updates } : fixture
    );
    set({ placedFixtures: updatedFixtures });
  },

  removePlacedFixture: (id) => {
    const { placedFixtures } = get();
    const filteredFixtures = placedFixtures.filter(fixture => fixture.id !== id);
    set({ placedFixtures: filteredFixtures });
  },

  setFixtureLayout: (layout) => {
    set({ fixtureLayout: layout });
  },

  // Fixture Flagging Actions (simplified - full implementation would be longer)
  addFixtureFlag: (fixtureId, flag) => {
    const fixtures = get().fixtures.map(f => {
      if (f.id === fixtureId) {
        const flags = f.flags || [];
        if (!flags.find(fl => fl.id === flag.id)) {
          return { ...f, flags: [...flags, flag], isFlagged: true };
        }
      }
      return f;
    });
    set({ fixtures });
  },

  removeFixtureFlag: (fixtureId, flagId) => {
    const fixtures = get().fixtures.map(f => {
      if (f.id === fixtureId) {
        const flags = (f.flags || []).filter(fl => fl.id !== flagId);
        return { ...f, flags, isFlagged: flags.length > 0 };
      }
      return f;
    });
    set({ fixtures });
  },

  toggleFixtureFlag: (fixtureId, flagId) => {
    const fixture = get().fixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    
    const hasFlag = (fixture.flags || []).some(fl => fl.id === flagId);
    if (hasFlag) {
      get().removeFixtureFlag(fixtureId, flagId);
    } else {
      // Would need flag object - simplified
    }
  },

  updateFixtureFlag: (fixtureId, flagId, updates) => {
    const fixtures = get().fixtures.map(f => {
      if (f.id === fixtureId) {
        const flags = (f.flags || []).map(fl =>
          fl.id === flagId ? { ...fl, ...updates } : fl
        );
        return { ...f, flags };
      }
      return f;
    });
    set({ fixtures });
  },

  clearFixtureFlags: (fixtureId) => {
    const fixtures = get().fixtures.map(f =>
      f.id === fixtureId ? { ...f, flags: [], isFlagged: false } : f
    );
    set({ fixtures });
  },

  getFixturesByFlag: (flagId) => {
    return get().fixtures.filter(f =>
      (f.flags || []).some(fl => fl.id === flagId)
    );
  },

  getFixturesByFlagCategory: (category) => {
    return get().fixtures.filter(f =>
      (f.flags || []).some(fl => fl.category === category)
    );
  },

  createQuickFlag: (name, color, category) => {
    return {
      id: `flag-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      color,
      category
    };
  },

  bulkAddFlag: (fixtureIds, flag) => {
    fixtureIds.forEach(id => get().addFixtureFlag(id, flag));
  },

  bulkRemoveFlag: (fixtureIds, flagId) => {
    fixtureIds.forEach(id => get().removeFixtureFlag(id, flagId));
  },

  // Fixture Helper Functions
  getChannelInfo: (dmxAddress) => {
    const state = get();
    for (const fixture of state.fixtures) {
      const fixtureStartAddress = fixture.startAddress - 1;
      const fixtureEndAddress = fixtureStartAddress + (fixture.channels?.length || 0) - 1;

      if (dmxAddress >= fixtureStartAddress && dmxAddress <= fixtureEndAddress) {
        const channelOffset = dmxAddress - fixtureStartAddress;
        const channel = fixture.channels?.[channelOffset];

        if (channel) {
          return {
            fixtureName: fixture.name,
            fixtureType: fixture.type,
            fixtureId: fixture.id,
            channelName: channel.name || `${channel.type} Channel`,
            channelType: channel.type,
            channelIndex: channelOffset,
            startAddress: fixture.startAddress,
          };
        }
      }
    }
    return null;
  },

  getFixtureColor: (fixtureId) => {
    const state = get();
    const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);

    if (fixtureIndex === -1) {
      return '#64748b';
    }

    const colors = [
      '#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
      '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
      '#a855f7', '#ec4899', '#f43f5e', '#10b981', '#0ea5e9', '#d946ef',
    ];

    return colors[fixtureIndex % colors.length];
  },

  isChannelAssigned: (dmxAddress) => {
    return get().getChannelInfo(dmxAddress) !== null;
  },
});

