// Kefka bench add-on: blackout ON/OFF state with undo, plus FULL ON and RANDOM output tests.
// Self-contained so the bench page can change around it: it injects its own card and takes over
// the header BLACKOUT button. Loaded by <script type="module" src="/kefka-bench-tests.mjs">.
const $ = id => document.getElementById(id);
const css = `
#bt-card { border-width: 2px; }
#bt-card.dark { border-color: #ff5a6a; background: #24121a; }
#bt-card.live { border-color: #6ee7a0; background: #10221a; }
#bt-state { font-size: 28px; font-weight: 900; letter-spacing: .03em; margin: 0; }
#bt-card.dark #bt-state { color: #ff8f9a; }
#bt-card.live #bt-state { color: #6ee7a0; }
#bt-detail { color: #c9cde0; margin: 4px 0 12px; }
.bt-row { display: flex; flex-wrap: wrap; gap: 10px; }
.bt-row button { font: inherit; font-weight: 800; min-height: 56px; padding: 0 18px; border-radius: 14px; cursor: pointer; flex: 1 1 140px; }
#bt-full { background: #f5f0d0; color: #111; border: 2px solid #fff; }
#bt-random { background: #23324a; color: #fff; border: 2px solid #5b7bb0; }
#bt-finder { display: block; margin-top: 10px; padding: 14px 16px; border-radius: 14px; background: #2a2440; border: 2px solid #9c86ff; color: #fff; font-weight: 800; text-decoration: none; text-align: center; }
#bt-log { font: 14px ui-monospace, SFMono-Regular, Menlo, monospace; color: #9aa1b8; margin: 12px 0 0; white-space: pre-wrap; }
#blackout[data-mode="undo"] { background: #1d3b2c; border-color: #6ee7a0; }
#blackout:disabled { opacity: .55; cursor: default; }
`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

const card = document.createElement('section');
card.className = 'card';
card.id = 'bt-card';
card.innerHTML = `
  <div class="eyebrow">Output state <span id="bt-since"></span></div>
  <p id="bt-state">…</p>
  <p id="bt-detail"></p>
  <div class="bt-row">
    <button id="bt-full" type="button">FULL ON · test</button>
    <button id="bt-random" type="button">RANDOM · test</button>
  </div>
  <a id="bt-finder" href="/kefka-channels.html">CHANNEL FINDER · fix which channel does what →</a>
  <pre id="bt-log"></pre>`;
const anchor = $('msg') || document.querySelector('header');
anchor.after(card);

// Take over the header button: drop any earlier listeners by replacing the node.
const old = $('blackout');
const btn = old.cloneNode(true);
old.replaceWith(btn);

let channels = null, fixtures = [], dark = null, since = null, snapshot = null, busy = false;
const log = [];
const now = () => new Date().toLocaleTimeString();
function note(line) {
  log.unshift(`${now()}  ${line}`);
  log.length = Math.min(log.length, 8);
  $('bt-log').textContent = log.join('\n');
  const msg = $('msg'); if (msg) msg.textContent = `${now()} · ${line}`;
}
// Timed command channels (lamp, reset) are never replayed or pulsed by these tests.
function special() {
  const reset = new Set(), lamp = new Set();
  for (const f of fixtures) (f.channels || []).forEach((c, i) => {
    const a = (f.startAddress || 1) - 1 + i;
    if (c.type === 'reset') reset.add(a);
    if (c.type === 'lamp') lamp.add(a);
  });
  return { reset, lamp };
}
async function batch(values, label) {
  if (busy) return false;
  busy = true; render();
  try {
    const r = await fetch('/api/dmx/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(values.map((v, i) => [i, v]))),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`server ${r.status}`);
    note(label);
    await poll();
    return true;
  } catch (e) {
    note(`FAILED: ${label} (${e.message})`);
    return false;
  } finally { busy = false; render(); }
}
function liveSummary() {
  const on = channels.map((v, i) => [i + 1, v]).filter(([, v]) => v > 0);
  const names = {};
  for (const f of fixtures) (f.channels || []).forEach((c, i) => { names[(f.startAddress || 1) + i] = c.name; });
  const shown = on.slice(0, 6).map(([a, v]) => `${names[a] ? names[a] + ' ' : 'DMX '}${a}=${v}`).join(', ');
  return { count: on.length, text: shown + (on.length > 6 ? ` … +${on.length - 6} more` : '') };
}
function render() {
  if (!channels) return;
  const s = liveSummary();
  card.classList.toggle('dark', dark);
  card.classList.toggle('live', !dark);
  $('bt-state').textContent = dark ? 'BLACKOUT ON' : 'BLACKOUT OFF';
  $('bt-detail').textContent = dark
    ? 'All 512 DMX channels are at 0. Nothing is being asked to light.'
    : `${s.count} channel${s.count === 1 ? '' : 's'} live: ${s.text}`;
  $('bt-since').textContent = since ? `since ${since}` : '';
  if (dark && snapshot) { btn.textContent = 'UNDO BLACKOUT'; btn.dataset.mode = 'undo'; btn.disabled = busy; }
  else if (dark) { btn.textContent = 'DARK'; btn.dataset.mode = 'dark'; btn.disabled = true; }
  else { btn.textContent = 'BLACKOUT'; btn.dataset.mode = 'blackout'; btn.disabled = busy; }
  $('bt-full').disabled = busy; $('bt-random').disabled = busy;
}
async function poll() {
  try {
    const r = await fetch('/api/state', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    const d = await r.json();
    if (!Array.isArray(d.dmxChannels) || d.dmxChannels.length !== 512) return;
    channels = d.dmxChannels; fixtures = d.fixtures || [];
    const isDark = channels.every(v => !v);
    if (dark !== null && isDark !== dark) {
      since = now();
      note(isDark ? 'Blackout is ON (all channels reached 0)' : `Blackout is OFF (${liveSummary().count} channels live)`);
      if (!isDark) snapshot = null;   // something new is live; an old undo would be stale
    } else if (dark === null) since = now();
    dark = isDark;
    render();
  } catch { /* the page's own status chips report server trouble */ }
}
btn.addEventListener('click', async () => {
  if (!channels) return;
  if (btn.dataset.mode === 'undo' && snapshot) {
    const restore = snapshot; snapshot = null;
    await batch(restore, 'Blackout undone: previous values restored (lamp/reset left at 0)');
    return;
  }
  const { reset, lamp } = special();
  snapshot = channels.map((v, i) => (reset.has(i) || lamp.has(i)) ? 0 : v);
  await batch(Array(512).fill(0), 'BLACKOUT sent: all 512 channels set to 0');
});
$('bt-full').addEventListener('click', () => {
  const { reset, lamp } = special();
  snapshot = null;
  batch(Array.from({ length: 512 }, (_, i) => reset.has(i) ? 0 : lamp.has(i) ? 200 : 255),
    'FULL ON test: all 512 channels = 255 (patched reset at 0, lamp-on 200)');
});
$('bt-random').addEventListener('click', () => {
  const { reset, lamp } = special();
  snapshot = null;
  batch(Array.from({ length: 512 }, (_, i) => reset.has(i) ? 0 : lamp.has(i) ? 200 : Math.floor(Math.random() * 256)),
    'RANDOM test: all 512 channels random 0-255 (patched reset at 0, lamp-on 200)');
});
poll();
setInterval(poll, 800);
