#!/usr/bin/env node
/**
 * Exercise the actual shutdown callback with real persistence in a temporary
 * directory, without importing the hardware runtime or opening any sockets.
 * TypeScript's AST isolates the existing functions; no production source edits
 * or live API/data files are used. Run: node --test scripts/fixture-shutdown.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const repo = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(repo, 'src', name), 'utf8');
const compile = text => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function functionSource(file, name) {
  const text = source(file);
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `${file} must contain ${name}`);
  return found.getText(ast);
}

function harness(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artbastard-fixture-shutdown-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'data'));
  const persistence = { exports: {} };
  vm.runInNewContext(compile(source('fixturesPersistence.ts')), {
    exports: persistence.exports,
    __dirname: path.join(root, 'dist'),
    require(name) {
      if (name === 'fs') return fs;
      if (name === 'path') return path;
      if (name === './logger') return { log() {} };
      throw new Error(`Unexpected persistence dependency: ${name}`);
    },
  });
  const store = persistence.exports;

  function shutdown(staleFixtures = [], staleGroups = []) {
    // Use the real legacy cache writers to ensure the regression fails if
    // shutdown ever calls them again with an empty or obsolete catalogue.
    const core = vm.runInNewContext(compile(`
      let fixtures = initialFixtures;
      let groups = initialGroups;
      ${functionSource('index.ts', 'saveFixtures')}
      ${functionSource('index.ts', 'saveGroups')}
      ({ saveFixtures, saveGroups });
    `), { ...store, initialFixtures: staleFixtures, initialGroups: staleGroups });
    Object.assign(core, {
      saveConfig() {}, saveScenes() {}, saveActs() {},
      getDmxChannels: () => Array(512).fill(0),
      loadScenes: () => [], loadActs: () => [], loadConfig: () => ({}),
    });
    let closed = false;
    const errors = [];
    const context = {
      require(name) {
        assert.equal(name, './core');
        return core;
      },
      loadFixturesData: store.loadFixturesData,
      fs, path, __dirname: path.join(root, 'dist'),
      log(message, level) { if (level === 'ERROR') errors.push(message); },
      server: { close(callback) { closed = true; callback(); } },
      process: { exit(code) { assert.equal(code, 0); } },
      setTimeout() {},
    };
    vm.runInNewContext(compile(`
      ${functionSource('server.ts', 'gracefulShutdown')}
      gracefulShutdown('SIGTERM');
    `), context);
    assert.deepEqual(errors, [], 'shutdown must not swallow a persistence failure');
    assert.equal(closed, true, 'shutdown must reach server close');
  }

  // JSON normalization avoids cross-VM prototype differences.
  const read = () => JSON.parse(JSON.stringify(store.loadFixturesData()));
  return { store, shutdown, read };
}

const fixture = { id: 'test-minibeam', name: 'MiniBeam', category: 'Moving Head', startAddress: 1, channels: Array(18).fill({ type: 'generic' }) };
const bundle = {
  fixtures: [fixture],
  groups: [{ id: 'group-a', fixtureIds: [fixture.id] }],
  fixtureLayout: [{ fixtureId: fixture.id, x: 12, y: 34 }],
  masterSliders: [{ id: 'master-a', fixtureIds: [fixture.id] }],
};

test('saved fixtures, groups and layout survive two cold shutdowns', t => {
  const { store, shutdown, read } = harness(t);
  assert.equal(store.saveFixturesData(bundle), true);
  shutdown();
  assert.deepEqual(read(), bundle);
  shutdown();
  assert.deepEqual(read(), bundle);
});

test('shutdown preserves immediate fixture edits and deletions despite an obsolete cache', t => {
  const { store, shutdown, read } = harness(t);
  const deleted = { ...fixture, id: 'deleted-fixture', startAddress: 19 };
  store.saveFixturesData({ ...bundle, fixtures: [fixture, deleted] });
  const changed = { ...fixture, name: 'Updated MiniBeam', startAddress: 37 };
  assert.equal(store.saveFixtureFile(changed), true);
  assert.equal(store.deleteFixtureFile(deleted.id), true);
  shutdown([fixture, deleted], bundle.groups);
  assert.deepEqual(read(), { ...bundle, fixtures: [changed] });
});

test('an intentional empty catalogue stays empty after shutdown', t => {
  const { store, shutdown, read } = harness(t);
  store.saveFixturesData(bundle);
  const empty = { fixtures: [], groups: [], fixtureLayout: [], masterSliders: [] };
  store.saveFixturesData(empty);
  shutdown(bundle.fixtures, bundle.groups);
  assert.deepEqual(read(), empty);
});
