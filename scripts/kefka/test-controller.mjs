import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeckControlEngine, BUTTON } from '../../react-app/public/deck-control-engine.mjs';

const pad = (...pressed) => ({ buttons: Array.from({ length: 16 }, (_, index) => pressed.includes(index) ? 1 : 0) });
const context = (overrides = {}) => ({ focused: true, online: true, source: 'kefka:1', now: 0, ...overrides });
const step = (engine, pressed = [], overrides = {}) => engine.step(pad(...pressed), context(overrides));
function armed() {
  const engine = new DeckControlEngine();
  step(engine);
  step(engine, [BUTTON.Y]);
  step(engine);
  assert.equal(engine.armed, true);
  return engine;
}

test('held attach/reconnect buttons cannot arm, recall, adjust, or blackout', () => {
  for (const held of [[BUTTON.Y], [BUTTON.X], [BUTTON.LT, BUTTON.A], [BUTTON.LT, BUTTON.UP]]) {
    const engine = new DeckControlEngine();
    assert.deepEqual(step(engine, held), []);
    assert.deepEqual(step(engine, held, { now: 500 }), []);
    assert.equal(engine.armed, false);
    step(engine);
    assert.deepEqual(step(engine), []);
  }
  const engine = armed();
  assert.deepEqual(step(engine, [BUTTON.X], { source: 'kefka:2' }), []);
  assert.equal(engine.armed, false);
});

test('channel selection works disarmed; output needs arm plus LT', () => {
  const engine = new DeckControlEngine();
  step(engine);
  assert.deepEqual(step(engine, [BUTTON.RIGHT]), [{ type: 'channel', delta: 1 }]);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.UP]), []);
  step(engine);
  step(engine, [BUTTON.Y]);
  step(engine);
  assert.deepEqual(step(engine, [BUTTON.UP]), []);
  step(engine);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.UP]), [{ type: 'adjust', delta: 1 }]);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.UP], { now: 200 }), []);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.UP, BUTTON.RT], { now: 401 }), [{ type: 'adjust', delta: 10 }]);
});

test('scene recall needs a fresh A press while armed and holding LT', () => {
  const engine = armed();
  assert.deepEqual(step(engine, [BUTTON.RB]), [{ type: 'scene', delta: 1 }]);
  assert.deepEqual(step(engine, [BUTTON.A]), []);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.A]), []);
  step(engine, [BUTTON.LT]);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.A]), [{ type: 'recall' }]);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.A], { now: 1000 }), []);
});

test('blackout is a single zero intent, disarms, and wins over adjustment', () => {
  const engine = armed();
  assert.deepEqual(step(engine, [BUTTON.X, BUTTON.B, BUTTON.LT, BUTTON.UP]), [{ type: 'blackout' }]);
  assert.equal(engine.armed, false);
  assert.deepEqual(step(engine, [BUTTON.X, BUTTON.LT, BUTTON.UP], { now: 1000 }), []);
  step(engine);
  assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.UP]), []);
});

test('focus, API loss, controller removal or source change disarm and require neutral', () => {
  for (const change of [{ focused: false }, { online: false }, { source: null }, { source: 'gamepad:0' }]) {
    const engine = armed();
    assert.deepEqual(step(engine, [BUTTON.LT, BUTTON.UP], change), []);
    assert.equal(engine.armed, false);
    assert.deepEqual(step(engine, [BUTTON.Y]), []);
    step(engine);
    assert.deepEqual(step(engine, [BUTTON.Y]), [{ type: 'arm' }]);
  }
});

test('stick drift never produces an output intention', () => {
  const engine = armed();
  assert.deepEqual(engine.step({ ...pad(), axes: [1, -1, 0.9, 0.8] }, context({ now: 10000 })), []);
});
