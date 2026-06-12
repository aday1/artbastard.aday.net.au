import fs from 'fs';
import path from 'path';
import { log } from './logger';

const DATA_DIR = path.join(__dirname, '..', 'data');
const FIXTURES_DIR = path.join(DATA_DIR, 'fixtures');
const FIXTURE_DATA_FILE = path.join(DATA_DIR, 'fixture-data.json');

export interface FixturesDataBundle {
  fixtures: any[];
  groups: any[];
  fixtureLayout: any[];
  masterSliders: any[];
}

const ensureFixturesDir = () => {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
};

export const saveFixtureFile = (fixture: any) => {
  try {
    ensureFixturesDir();
    const category = fixture.category || 'Generic';
    const categoryDir = path.join(FIXTURES_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    const fixtureFile = path.join(categoryDir, `${fixture.id}.json`);
    fs.writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2));
    return true;
  } catch (error) {
    log('Error saving fixture file', 'ERROR', { error, fixtureId: fixture?.id });
    return false;
  }
};

export const deleteFixtureFile = (fixtureId: string) => {
  try {
    ensureFixturesDir();

    const searchAndDelete = (dir: string): boolean => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            if (searchAndDelete(fullPath)) return true;
          } else if (entry === `${fixtureId}.json`) {
            fs.unlinkSync(fullPath);
            return true;
          }
        }
      } catch (error) {
        log('Error searching for fixture file', 'WARN', { error, fixtureId });
      }
      return false;
    };

    searchAndDelete(FIXTURES_DIR);
    return true;
  } catch (error) {
    log('Error deleting fixture file', 'ERROR', { error, fixtureId });
    return true;
  }
};

export const loadFixtureFile = (fixtureId: string) => {
  try {
    const searchDir = (dir: string): any => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const result = searchDir(fullPath);
            if (result) return result;
          } else if (entry === `${fixtureId}.json`) {
            const data = fs.readFileSync(fullPath, 'utf-8');
            return JSON.parse(data);
          }
        }
      } catch (error) {
        log('Error searching for fixture file', 'WARN', { error, fixtureId });
      }
      return null;
    };

    return searchDir(FIXTURES_DIR);
  } catch (error) {
    log('Error loading fixture file', 'ERROR', { error, fixtureId });
    return null;
  }
};

const loadAllFixtures = (): any[] => {
  try {
    ensureFixturesDir();
    const fixtures: any[] = [];

    const scanDir = (dir: string): void => {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.endsWith('.json')) {
            try {
              const data = fs.readFileSync(fullPath, 'utf-8');
              const fixture = JSON.parse(data);
              if (fixture && fixture.id) {
                fixtures.push(fixture);
              }
            } catch (error) {
              log('Error loading fixture file', 'WARN', { error, file: entry });
            }
          }
        }
      } catch (error) {
        log('Error scanning fixtures directory', 'WARN', { error, dir });
      }
    };

    scanDir(FIXTURES_DIR);
    return fixtures;
  } catch (error) {
    log('Error loading fixtures directory', 'ERROR', { error });
    return [];
  }
};

const migrateOldFixturesFormat = () => {
  try {
    const oldFixturesPath = path.join(DATA_DIR, 'fixtures.json');
    if (!fs.existsSync(oldFixturesPath)) {
      return;
    }

    const data = fs.readFileSync(oldFixturesPath, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed || !Array.isArray(parsed.fixtures) || parsed.fixtures.length === 0) {
      return;
    }

    log('Migrating fixtures from old format to individual files', 'INFO', { count: parsed.fixtures.length });
    ensureFixturesDir();

    for (const fixture of parsed.fixtures) {
      if (fixture && fixture.id) {
        saveFixtureFile(fixture);
      }
    }

    const fixtureData = {
      groups: parsed.groups || [],
      fixtureLayout: parsed.fixtureLayout || [],
      masterSliders: parsed.masterSliders || []
    };
    fs.writeFileSync(FIXTURE_DATA_FILE, JSON.stringify(fixtureData, null, 2));

    const backupPath = path.join(DATA_DIR, 'fixtures.json.backup');
    if (!fs.existsSync(backupPath)) {
      fs.renameSync(oldFixturesPath, backupPath);
      log('Old fixtures.json backed up', 'INFO');
    }
  } catch (error) {
    log('Error migrating fixtures format', 'ERROR', { error });
  }
};

const loadFixtureData = () => {
  try {
    if (fs.existsSync(FIXTURE_DATA_FILE)) {
      const data = fs.readFileSync(FIXTURE_DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    log('Error loading fixture data', 'ERROR', { error });
  }

  return {
    groups: [],
    fixtureLayout: [],
    masterSliders: []
  };
};

const saveFixtureData = (data: { groups?: any[]; fixtureLayout?: any[]; masterSliders?: any[] }) => {
  try {
    const fixtureData = {
      groups: data.groups || [],
      fixtureLayout: data.fixtureLayout || [],
      masterSliders: data.masterSliders || []
    };
    fs.writeFileSync(FIXTURE_DATA_FILE, JSON.stringify(fixtureData, null, 2));
    return true;
  } catch (error) {
    log('Error saving fixture data', 'ERROR', { error });
    return false;
  }
};

export const loadFixturesData = (): FixturesDataBundle => {
  try {
    migrateOldFixturesFormat();
    const fixtures = loadAllFixtures();
    const fixtureData = loadFixtureData();

    return {
      fixtures,
      groups: fixtureData.groups || [],
      fixtureLayout: fixtureData.fixtureLayout || [],
      masterSliders: fixtureData.masterSliders || []
    };
  } catch (error) {
    log('Error loading fixtures data', 'ERROR', { error });
    return {
      fixtures: [],
      groups: [],
      fixtureLayout: [],
      masterSliders: []
    };
  }
};

export const saveFixturesData = (data: FixturesDataBundle) => {
  try {
    if (Array.isArray(data.fixtures)) {
      ensureFixturesDir();

      const currentFixtureIds = new Set(data.fixtures.map(fixture => fixture.id));

      const findJsonFiles = (dir: string): string[] => {
        const files: string[] = [];
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              files.push(...findJsonFiles(fullPath));
            } else if (entry.endsWith('.json')) {
              files.push(entry);
            }
          }
        } catch (error) {
          log('Error scanning for JSON files', 'WARN', { error, dir });
        }
        return files;
      };

      const jsonFiles = findJsonFiles(FIXTURES_DIR);
      for (const file of jsonFiles) {
        const fixtureId = file.replace(/\.json$/u, '');
        if (!currentFixtureIds.has(fixtureId)) {
          deleteFixtureFile(fixtureId);
        }
      }

      for (const fixture of data.fixtures) {
        if (fixture && fixture.id) {
          saveFixtureFile(fixture);
        }
      }
    }

    saveFixtureData({
      groups: data.groups,
      fixtureLayout: data.fixtureLayout,
      masterSliders: data.masterSliders
    });

    log('Fixtures data saved successfully', 'INFO', {
      fixtures: data.fixtures?.length || 0,
      groups: data.groups?.length || 0
    });
    return true;
  } catch (error) {
    log('Error saving fixtures data', 'ERROR', { error });
    return false;
  }
};
