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
    const fixtureFile = path.join(FIXTURES_DIR, `${fixture.id}.json`);
    fs.writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2));
    return true;
  } catch (error) {
    log('Error saving fixture file', 'ERROR', { error, fixtureId: fixture?.id });
    return false;
  }
};

export const deleteFixtureFile = (fixtureId: string) => {
  try {
    const fixtureFile = path.join(FIXTURES_DIR, `${fixtureId}.json`);
    if (fs.existsSync(fixtureFile)) {
      fs.unlinkSync(fixtureFile);
      return true;
    }
    return true;
  } catch (error) {
    log('Error deleting fixture file', 'ERROR', { error, fixtureId });
    return false;
  }
};

export const loadFixtureFile = (fixtureId: string) => {
  try {
    const fixtureFile = path.join(FIXTURES_DIR, `${fixtureId}.json`);
    if (fs.existsSync(fixtureFile)) {
      const data = fs.readFileSync(fixtureFile, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    log('Error loading fixture file', 'ERROR', { error, fixtureId });
    return null;
  }
};

const loadAllFixtures = (): any[] => {
  try {
    ensureFixturesDir();
    const fixtures: any[] = [];
    const files = fs.readdirSync(FIXTURES_DIR);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(FIXTURES_DIR, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const fixture = JSON.parse(data);
          if (fixture && fixture.id) {
            fixtures.push(fixture);
          }
        } catch (error) {
          log('Error loading fixture file', 'WARN', { error, file });
        }
      }
    }

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
      const files = fs.readdirSync(FIXTURES_DIR).filter(file => file.endsWith('.json'));
      for (const file of files) {
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
