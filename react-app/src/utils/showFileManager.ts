/**
 * Show File Management System
 * Handles versioning, comparison, auto-save, and templates for show files
 */

export interface ShowFileVersion {
  id: string;
  version: string;
  timestamp: number;
  description?: string;
  data: ShowFileData;
  author?: string;
}

export interface ShowFileData {
  scenes: unknown[];
  acts: unknown[];
  fixtures: unknown[];
  groups: unknown[];
  dmxChannels: number[];
  configuration: Record<string, unknown>;
  metadata: {
    name: string;
    description?: string;
    createdAt: number;
    updatedAt: number;
  };
}

export interface ShowFileTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  data: Partial<ShowFileData>;
  thumbnail?: string;
}

class ShowFileManager {
  private versions: ShowFileVersion[] = [];
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private autoSaveEnabled: boolean = false;
  private autoSaveIntervalMs: number = 60000; // 1 minute default

  /**
   * Create a new version of the show file
   */
  createVersion(
    data: ShowFileData,
    description?: string,
    author?: string
  ): ShowFileVersion {
    const version: ShowFileVersion = {
      id: `version-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      version: this.generateVersionNumber(),
      timestamp: Date.now(),
      description,
      data: this.deepClone(data),
      author
    };

    this.versions.push(version);
    this.saveVersionsToStorage();
    return version;
  }

  /**
   * Get all versions
   */
  getVersions(): ShowFileVersion[] {
    return [...this.versions].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get specific version
   */
  getVersion(versionId: string): ShowFileVersion | undefined {
    return this.versions.find(v => v.id === versionId);
  }

  /**
   * Compare two versions
   */
  compareVersions(versionId1: string, versionId2: string): {
    differences: Array<{
      path: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
    summary: {
      scenesChanged: number;
      actsChanged: number;
      fixturesChanged: number;
      dmxChannelsChanged: number;
    };
  } {
    const v1 = this.getVersion(versionId1);
    const v2 = this.getVersion(versionId2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const differences: Array<{
      path: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [];

    // Compare scenes
    const scenesChanged = this.compareArrays(v1.data.scenes, v2.data.scenes, 'scenes');
    differences.push(...scenesChanged);

    // Compare acts
    const actsChanged = this.compareArrays(v1.data.acts, v2.data.acts, 'acts');
    differences.push(...actsChanged);

    // Compare fixtures
    const fixturesChanged = this.compareArrays(v1.data.fixtures, v2.data.fixtures, 'fixtures');
    differences.push(...fixturesChanged);

    // Compare DMX channels
    const dmxChanged = this.compareArrays(
      v1.data.dmxChannels,
      v2.data.dmxChannels,
      'dmxChannels'
    );
    differences.push(...dmxChanged);

    return {
      differences,
      summary: {
        scenesChanged: scenesChanged.length,
        actsChanged: actsChanged.length,
        fixturesChanged: fixturesChanged.length,
        dmxChannelsChanged: dmxChanged.length
      }
    };
  }

  /**
   * Restore version
   */
  restoreVersion(versionId: string): ShowFileData {
    const version = this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }
    return this.deepClone(version.data);
  }

  /**
   * Delete version
   */
  deleteVersion(versionId: string): boolean {
    const index = this.versions.findIndex(v => v.id === versionId);
    if (index === -1) return false;
    this.versions.splice(index, 1);
    this.saveVersionsToStorage();
    return true;
  }

  /**
   * Enable auto-save
   */
  enableAutoSave(intervalMs: number = 60000, getCurrentData: () => ShowFileData) {
    this.autoSaveEnabled = true;
    this.autoSaveIntervalMs = intervalMs;

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }

    this.autoSaveInterval = setInterval(() => {
      if (this.autoSaveEnabled) {
        const data = getCurrentData();
        this.createVersion(data, 'Auto-save', 'System');
      }
    }, intervalMs);
  }

  /**
   * Disable auto-save
   */
  disableAutoSave() {
    this.autoSaveEnabled = false;
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Export show file
   */
  exportShowFile(data: ShowFileData): string {
    return JSON.stringify({
      ...data,
      exportedAt: Date.now(),
      version: '1.0'
    }, null, 2);
  }

  /**
   * Import show file
   */
  importShowFile(json: string): ShowFileData {
    try {
      const parsed = JSON.parse(json);
      // Validate structure
      if (!parsed.scenes || !parsed.fixtures || !parsed.dmxChannels) {
        throw new Error('Invalid show file format');
      }
      return parsed as ShowFileData;
    } catch (error) {
      throw new Error(`Failed to import show file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load from template
   */
  loadFromTemplate(template: ShowFileTemplate): ShowFileData {
    return {
      scenes: template.data.scenes || [],
      acts: template.data.acts || [],
      fixtures: template.data.fixtures || [],
      groups: template.data.groups || [],
      dmxChannels: template.data.dmxChannels || new Array(512).fill(0),
      configuration: template.data.configuration || {},
      metadata: {
        name: template.name,
        description: template.description,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };
  }

  /**
   * Generate version number (semantic versioning)
   */
  private generateVersionNumber(): string {
    const major = Math.floor(this.versions.length / 100) + 1;
    const minor = Math.floor((this.versions.length % 100) / 10);
    const patch = this.versions.length % 10;
    return `${major}.${minor}.${patch}`;
  }

  /**
   * Compare arrays
   */
  private compareArrays(
    arr1: unknown[],
    arr2: unknown[],
    path: string
  ): Array<{ path: string; oldValue: unknown; newValue: unknown }> {
    const differences: Array<{ path: string; oldValue: unknown; newValue: unknown }> = [];
    const maxLength = Math.max(arr1.length, arr2.length);

    for (let i = 0; i < maxLength; i++) {
      if (i >= arr1.length) {
        differences.push({
          path: `${path}[${i}]`,
          oldValue: undefined,
          newValue: arr2[i]
        });
      } else if (i >= arr2.length) {
        differences.push({
          path: `${path}[${i}]`,
          oldValue: arr1[i],
          newValue: undefined
        });
      } else if (JSON.stringify(arr1[i]) !== JSON.stringify(arr2[i])) {
        differences.push({
          path: `${path}[${i}]`,
          oldValue: arr1[i],
          newValue: arr2[i]
        });
      }
    }

    return differences;
  }

  /**
   * Deep clone object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Save versions to localStorage
   */
  private saveVersionsToStorage() {
    try {
      // Only save last 50 versions to avoid storage issues
      const recentVersions = this.versions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      localStorage.setItem('artbastard-show-versions', JSON.stringify(recentVersions));
    } catch (error) {
      console.error('Failed to save versions to storage:', error);
    }
  }

  /**
   * Load versions from localStorage
   */
  loadVersionsFromStorage() {
    try {
      const stored = localStorage.getItem('artbastard-show-versions');
      if (stored) {
        this.versions = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load versions from storage:', error);
    }
  }
}

export const showFileManager = new ShowFileManager();

