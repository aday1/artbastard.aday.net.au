#!/usr/bin/env node
/**
 * Network MIDI receiver for Kefka. A bridge on another machine (e.g. ULTIMA with a Launchkey) connects over
 * TCP, names its ports, and streams MIDI. Each remote port becomes a pair of ALSA virtual ports named
 * "<port> (<HOST>)": what the keyboard plays appears as a MIDI input to ArtBastard, Chrome (Web MIDI) and any
 * ALSA app; what apps send to it (LED feedback) goes back to the keyboard.
 *
 * Wire format after a one-line JSON hello {"hello":1,"host":"ULTIMA","ports":[{"id":0,"name":"Launchkey MIDI"}]}:
 *   frame = u8 portId, u16 big-endian length, MIDI bytes (one complete message or SysEx).
 * Only addresses in MIDINET_ALLOW (comma list) may connect. Ports persist for the life of the service so apps
 * that opened them keep working across bridge reconnects.
 */
'use strict';
const net = require('node:net');
const path = require('node:path');
const midi = require(process.env.MIDINET_MIDI_MODULE || path.join(process.env.HOME, 'Work/artbastard/node_modules/@julusian/midi'));

const PORT = Number(process.env.MIDINET_PORT || 18790);
const ALLOW = new Set((process.env.MIDINET_ALLOW || '127.0.0.1,::1').split(',').map((s) => s.trim()).filter(Boolean));
const ports = new Map();   // "<name> (<HOST>)" -> { out: midi.Output (to apps), inp: midi.Input (from apps), client: socket|null, id }
const log = (...a) => console.log(new Date().toISOString(), ...a);
const clean = (s) => String(s || '').replace(/[^\w .()+#-]/g, '').slice(0, 40).trim();
const statusLength = (b) => (b >= 0xf8 ? 1 : b === 0xf1 || b === 0xf3 ? 2 : b === 0xf2 ? 3 : b < 0xf0 ? ((b & 0xf0) === 0xc0 || (b & 0xf0) === 0xd0 ? 2 : 3) : 0);

function virtualPair(label) {
  if (ports.has(label)) return ports.get(label);
  const out = new midi.Output();
  out.openVirtualPort(label);
  const inp = new midi.Input();
  inp.ignoreTypes(false, true, true);   // keep SysEx (LED / mode messages), drop timing and active sensing
  inp.openVirtualPort(label);
  const entry = { out, inp, client: null, id: 0 };
  inp.on('message', (_dt, bytes) => {
    if (!entry.client || entry.client.destroyed || !bytes.length) return;
    const head = Buffer.from([entry.id, bytes.length >> 8, bytes.length & 255]);
    entry.client.write(Buffer.concat([head, Buffer.from(bytes)]));
  });
  ports.set(label, entry);
  log('virtual port ready:', label);
  return entry;
}

const server = net.createServer((socket) => {
  const peer = socket.remoteAddress.replace(/^::ffff:/, '');
  if (!ALLOW.has(peer)) { log('refused', peer); socket.destroy(); return; }
  socket.setNoDelay(true);
  let hello = null, buffer = Buffer.alloc(0), byId = new Map();
  log('connected', peer);
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (!hello) {
      const nl = buffer.indexOf(10);
      if (nl < 0) { if (buffer.length > 8192) socket.destroy(); return; }
      try { hello = JSON.parse(buffer.subarray(0, nl).toString('utf8')); } catch { socket.destroy(); return; }
      buffer = buffer.subarray(nl + 1);
      const host = clean(hello.host) || peer;
      for (const p of (Array.isArray(hello.ports) ? hello.ports : []).slice(0, 8)) {
        const label = `${clean(p.name) || 'MIDI'} (${host})`;
        const entry = virtualPair(label);
        if (entry.client && entry.client !== socket) entry.client.destroy();
        entry.client = socket; entry.id = Number(p.id) & 255;
        byId.set(entry.id, entry);
      }
      socket.write(JSON.stringify({ ok: 1, ports: [...byId.values()].map((e) => [...ports].find(([, v]) => v === e)[0]) }) + '\n');
      log('hello', host, [...byId.keys()]);
    }
    while (buffer.length >= 3) {
      const id = buffer[0], len = buffer.readUInt16BE(1);
      if (buffer.length < 3 + len) break;
      const bytes = [...buffer.subarray(3, 3 + len)];
      buffer = buffer.subarray(3 + len);
      const entry = byId.get(id);
      if (!entry || !bytes.length) continue;
      const need = bytes[0] === 0xf0 ? bytes.length : statusLength(bytes[0]);
      if (bytes[0] < 0x80 || (bytes[0] !== 0xf0 && bytes.length !== need)) continue;   // drop malformed frames
      entry.out.sendMessage(bytes);
    }
  });
  const gone = () => { for (const e of byId.values()) if (e.client === socket) e.client = null; log('disconnected', peer); };
  socket.on('close', gone);
  socket.on('error', () => {});
});
server.listen(PORT, '0.0.0.0', () => log(`midinet listening on :${PORT}, allow ${[...ALLOW].join(' ')}`));
const stop = () => { for (const e of ports.values()) { try { e.out.closePort(); e.inp.closePort(); } catch {} } process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
