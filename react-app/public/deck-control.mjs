import { DeckControlEngine } from './deck-control-engine.mjs';

const $ = id => document.getElementById(id);
const engine = new DeckControlEngine();
let channels = Array(512).fill(0), names = {}, scenes = [], selected = 0, sceneIndex = 0;
let online = false, lastStateAt = 0, lastBridgeAt = 0, bridge = null;
let bridgeStatus = null;
const localDeck = ['127.0.0.1', 'localhost'].includes(location.hostname);
const isBuiltInDeck = gamepad => /steam.*(deck|controller)|valve|28de/i.test(gamepad.id);
let refreshing = null;
let busy = false, pendingWrites = 0, epoch = 0, writes = Promise.resolve(), revision = 0, lastSource = null;
const focused = () => !document.hidden && document.hasFocus();
const announce = text => { $('notice').textContent = text; };
function disarm(message) {
  engine.reset();
  epoch++;
  if (message) announce(message);
  render();
}
function render() {
  const value = channels[selected] || 0;
  if (document.activeElement !== $('channel')) $('channel').value = String(selected + 1);
  $('channel-name').textContent = names[selected] || `Channel ${selected + 1}`;
  $('value').textContent = String(value);
  $('percent').textContent = `${Math.round(value / 255 * 100)}%`;
  $('meter').style.width = `${value / 255 * 100}%`;
  $('arm').textContent = engine.armed ? 'Y · Armed — disarm' : 'Y · Arm controls';
  $('arm').setAttribute('aria-pressed', String(engine.armed));
  $('arm').disabled = !online || !focused();
  $('blackout').disabled = !online || !focused();
  document.querySelectorAll('[data-adjust]').forEach(button => { button.disabled = !online || !engine.armed || busy; });
  $('recall').disabled = !online || !engine.armed || busy || !scenes.length;
  $('scene').value = String(sceneIndex);
  $('scene').disabled = !scenes.length;
  $('scene-detail').textContent = scenes.length
    ? `${sceneIndex + 1} of ${scenes.length} · Recall sends the saved channel values.`
    : 'Create and save scenes in the full console.';
}
async function request(path, body) {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  const data = await response.json();
  if (data.errors?.length || data.success === false) throw new Error(data.errors?.join(', ') || data.error || 'Command failed');
  return data;
}
async function loadState({ afterWrite = false } = {}) {
  const before = revision;
  try {
    const data = await request('/state');
    if (!Array.isArray(data.dmxChannels) || data.dmxChannels.length !== 512) throw new Error('Invalid server channel state');
    lastStateAt = performance.now();
    if (!online) announce('Server connected. Controls are disarmed; arm when ready.');
    online = true;
    if (before === revision && (!busy || afterWrite)) channels = data.dmxChannels;
    names = data.channelNames || {};
    const oldName = scenes[sceneIndex]?.name;
    const nextScenes = Array.isArray(data.scenes) ? data.scenes.filter(scene => typeof scene.name === 'string') : [];
    if (JSON.stringify(nextScenes.map(scene => scene.name)) !== JSON.stringify(scenes.map(scene => scene.name))) {
      scenes = nextScenes;
      sceneIndex = Math.max(0, scenes.findIndex(scene => scene.name === oldName));
      $('scene').replaceChildren(...(scenes.length ? scenes.map((scene, index) => new Option(scene.name, String(index))) : [new Option('No saved scenes', '0')]));
    }
    $('network').textContent = `Server online · Art-Net ${data.artNetConfig?.ip || data.artNetConfig?.host || 'unconfigured'}`;
  } catch (error) {
    online = false;
    $('network').textContent = 'Server unavailable';
    disarm(`Disconnected — ${error.message}. Reconnect, then arm again.`);
  }
  render();
}
function refresh() {
  if (!refreshing) refreshing = loadState().finally(() => { refreshing = null; });
  return refreshing;
}
async function refreshAfterWrite(expectedRevision) {
  // A periodic read may have captured the old values before the POST. Drain it,
  // then make a distinct read while edits remain blocked. Joining that old read
  // would leave channels stale even though the write itself succeeded.
  if (refreshing) await refreshing;
  if (expectedRevision !== revision) return;
  refreshing = loadState({ afterWrite: true }).finally(() => { refreshing = null; });
  await refreshing;
}
// Serialize POSTs only. Blackout follows an already-sent command immediately;
// it must never wait for a slow state GET. Ordinary edits remain blocked until
// the newest write has a fresh state read, with older reads rejected by revision.
function send(path, body, message, { blackout = false } = {}) {
  if (!online || !focused() || (!blackout && !engine.armed)) return;
  if (blackout) {
    disarm();
    announce('Sending blackout…');
  }
  const commandEpoch = epoch;
  revision++;
  pendingWrites++;
  busy = true;
  render();
  writes = writes.then(async () => {
    if (!blackout && (epoch !== commandEpoch || !engine.armed || !focused())) return;
    try {
      await request(path, body);
      announce(message);
    } catch (error) {
      online = false;
      disarm(`Command failed — ${error.message}. Check the server before rearming.`);
    }
  }).finally(() => {
    pendingWrites--;
    const completedRevision = ++revision;
    // Do not return this promise into the POST queue.
    void refreshAfterWrite(completedRevision).finally(() => {
      if (completedRevision === revision && pendingWrites === 0) {
        busy = false;
        render();
      }
    });
  });
}
function adjust(delta) {
  if (busy || !engine.armed) return;
  const value = Math.max(0, Math.min(255, (channels[selected] || 0) + delta));
  if (value === channels[selected]) return;
  send('/dmx', { channel: selected, value }, `Channel ${selected + 1} → ${value}`);
}
function blackout() {
  send('/dmx/batch', Object.fromEntries(Array.from({ length: 512 }, (_, index) => [index, 0])),
    'Blackout sent — all 512 channels set to zero. Controls disarmed.', { blackout: true });
}
function recall() {
  if (busy || !scenes.length) return;
  const name = scenes[sceneIndex].name;
  send('/scenes/load', { name }, `Recalled “${name}”.`);
}
function selectScene(delta) {
  if (scenes.length) sceneIndex = (sceneIndex + delta + scenes.length) % scenes.length;
  render();
}
function toggleArm() {
  if (!online || !focused()) return;
  if (engine.armed) return disarm('Controls disarmed.');
  // Touch-only operation can arm without a gamepad, but a connected controller
  // must have passed its neutral gate first.
  if (lastSource && !engine.ready) return announce('Release all controller buttons, then arm.');
  if (!lastSource) engine.ready = true;
  engine.arm();
  announce('Controls armed. Hold LT to change values with the D-pad.');
  render();
}
$('arm').onclick = toggleArm;
$('blackout').onclick = blackout;
$('previous').onclick = () => { selected = Math.max(0, selected - 1); render(); };
$('next').onclick = () => { selected = Math.min(511, selected + 1); render(); };
$('channel').onchange = event => { selected = Math.max(0, Math.min(511, Math.trunc(Number(event.target.value) || 1) - 1)); render(); };
document.querySelectorAll('[data-adjust]').forEach(button => { button.onclick = () => adjust(Number(button.dataset.adjust)); });
$('scene-previous').onclick = () => selectScene(-1);
$('scene-next').onclick = () => selectScene(1);
$('scene').onchange = event => { sceneIndex = Number(event.target.value); render(); };
$('recall').onclick = recall;
window.addEventListener('blur', () => disarm('Window inactive — controls disarmed.'));
document.addEventListener('visibilitychange', () => { if (document.hidden) disarm('Window hidden — controls disarmed.'); });
// deckhypr retains emulator paddle shortcuts in GAME mode. They must not type,
// navigate, or invoke browser shortcuts on this dedicated surface.
window.addEventListener('keydown', event => {
  if (['F2', 'F4', 'r', 'R', 'l', 'L'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) event.preventDefault();
});
if (localDeck) {
  const stream = new EventSource('http://127.0.0.1:18782/events');
  stream.onmessage = event => {
    try {
      const state = JSON.parse(event.data);
      bridge = state.nativeAllowed === true ? state.pad : null;
      bridgeStatus = state;
      lastBridgeAt = performance.now();
    } catch { bridge = null; bridgeStatus = null; }
  };
  stream.onerror = () => { bridge = null; bridgeStatus = null; lastBridgeAt = 0; };
}
function tick(now) {
  let pad = null, source = null, description = 'Touch controls · no controller detected';
  if (bridge && now - lastBridgeAt < 400) {
    pad = bridge;
    source = `kefka:${bridge.connection}`;
    description = 'Kefka Steam Deck · native buttons';
  } else {
    // On Kefka the built-in pad belongs to deckhypr. Taking it through the
    // browser when the native gate closes would reintroduce desktop clicks and
    // lighting actions from one press. Real external gamepads remain usable.
    const gamepad = Array.from(navigator.getGamepads?.() || []).find(item =>
      item?.connected && item.mapping === 'standard' && !(localDeck && isBuiltInDeck(item)));
    if (gamepad) {
      pad = gamepad;
      source = `gamepad:${gamepad.index}:${gamepad.id}`;
      description = `Controller · ${gamepad.id}`;
    } else if (localDeck) {
      description = bridgeStatus && now - lastBridgeAt < 400 && bridgeStatus.connected
        ? `Touch controls · ${bridgeStatus.nativeReason || 'Open ArtBastard Deck from the launcher for native controls'}`
        : 'Touch controls · use the ArtBastard Deck launcher for native buttons';
    }
  }
  if (source !== lastSource) {
    disarm(lastSource ? 'Controller changed or disconnected — controls disarmed.' : undefined);
    lastSource = source;
  }
  if (now - lastStateAt > 4000 && online) {
    online = false;
    disarm('Server state is stale — controls disarmed.');
  }
  // Keep touch-only arming independent of the absence of a physical pad.
  const actions = source ? engine.step(pad, { focused: focused(), online, source, now }) : [];
  for (const action of actions) {
    if (action.type === 'channel') selected = Math.max(0, Math.min(511, selected + action.delta));
    else if (action.type === 'scene') selectScene(action.delta);
    else if (action.type === 'adjust') adjust(action.delta);
    else if (action.type === 'recall') recall();
    else if (action.type === 'blackout') blackout();
    else if (action.type === 'disarm') disarm('Controls disarmed.');
    else if (action.type === 'arm') announce('Controls armed. Hold LT to change values.');
  }
  const neutralNote = source && !engine.ready ? ' · release all buttons' : '';
  $('controller').textContent = description + neutralNote;
  render();
  requestAnimationFrame(tick);
}
await refresh();
setInterval(refresh, 750);
requestAnimationFrame(tick);
