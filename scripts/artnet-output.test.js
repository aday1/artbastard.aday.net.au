'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter, once } = require('node:events');
const dgram = require('node:dgram');
const path = require('node:path');
const { ArtNetOutput } = require(path.resolve(
  process.env.ARTBASTARD_TEST_DIST || path.join(__dirname, '..', 'dist'),
  'artnetOutput.js'
));

const config = { ip: '127.0.0.1', port: 6454, net: 1, subnet: 2, universe: 3, base_refresh_interval: 25 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeTransport(run) {
  const originalCreate = dgram.createSocket;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const sockets = [];
  const timers = new Map();
  class FakeSocket extends EventEmitter {
    packets = [];
    closeCount = 0;
    bind(options) { this.binding = options; }
    setBroadcast(value) { this.broadcast = value; }
    send(packet, port, ip, callback) {
      this.packets.push({ packet: Buffer.from(packet), port, ip });
      callback(this.sendError || null);
    }
    close() { this.closeCount += 1; this.emit('close'); }
  }
  dgram.createSocket = (options) => {
    const socket = new FakeSocket();
    socket.options = options;
    sockets.push(socket);
    return socket;
  };
  global.setInterval = (callback, interval) => {
    const timer = { unref() {} };
    timers.set(timer, { callback, interval });
    return timer;
  };
  global.clearInterval = (timer) => { timers.delete(timer); };
  try { run({ sockets, timers }); } finally {
    dgram.createSocket = originalCreate;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
}

test('one exclusive source6454 socket emits a complete zero ArtDMX frame only after binding', () => {
  fakeTransport(({ sockets, timers }) => {
    const output = new ArtNetOutput(config);
    const socket = sockets[0];
    assert.deepEqual(socket.options, { type: 'udp4', reuseAddr: false });
    assert.deepEqual(socket.binding, { port: 6454, address: '0.0.0.0' });
    output.transmit();
    assert.equal(socket.packets.length, 0);
    assert.equal(timers.size, 0);
    socket.emit('listening');
    const packet = socket.packets[0].packet;
    assert.equal(packet.length, 530);
    assert.equal(packet.subarray(0, 8).toString('ascii'), 'Art-Net\0');
    assert.equal(packet.readUInt16LE(8), 0x5000);
    assert.equal(packet.readUInt16BE(10), 14);
    assert.equal(packet[12], 1);
    assert.equal(packet[13], 0);
    assert.equal(packet.readUInt16LE(14), 0x123);
    assert.equal(packet.readUInt16BE(16), 512);
    assert.ok(packet.subarray(18).every((value) => value === 0));
    assert.equal(timers.size, 1);
    output.close();
    output.close();
    assert.equal(socket.closeCount, 1);
    assert.equal(timers.size, 0);
  });
});

test('staging512 channels is atomic and repeated configuration edits keep one socket/timer and the complete buffer', () => {
  fakeTransport(({ sockets, timers }) => {
    const output = new ArtNetOutput(config);
    const socket = sockets[0];
    socket.emit('listening');
    const values = Array.from({ length: 512 }, (_, index) => (index * 17) % 256);
    values.forEach((value, index) => output.setChannel(index, value));
    assert.equal(socket.packets.length, 1, 'setChannel must not emit partially staged universes');
    output.transmit();
    assert.deepEqual([...socket.packets.at(-1).packet.subarray(18)], values);
    for (let index = 0; index < 20; index += 1) {
      const next = { ...config, port: 6500 + index, universe: index % 16, base_refresh_interval: 50 + index };
      output.configure(next);
      assert.equal(sockets.length, 1);
      assert.equal(timers.size, 1);
      assert.equal([...timers.values()][0].interval, next.base_refresh_interval);
      assert.equal(socket.packets.at(-1).port, next.port);
      assert.equal(socket.packets.at(-1).packet[14] & 15, next.universe);
      assert.deepEqual([...socket.packets.at(-1).packet.subarray(18)], values);
    }
    const oldCount = socket.packets.length;
    [...timers.values()][0].callback();
    assert.equal(socket.packets.length, oldCount + 1);
    assert.equal(socket.packets.at(-1).port, 6519);
    output.close();
    output.transmit();
    assert.equal(socket.packets.length, oldCount + 1);
    assert.equal(timers.size, 0);
    assert.equal(socket.listenerCount('listening'), 0);
  });
});

test('sequence wraps255 to1 without disabling ordering', () => {
  fakeTransport(({ sockets }) => {
    const output = new ArtNetOutput(config);
    const socket = sockets[0];
    socket.emit('listening');
    for (let index = 0; index < 260; index += 1) output.transmit();
    assert.equal(socket.packets[254].packet[12], 255);
    assert.equal(socket.packets[255].packet[12], 1);
    assert.ok(socket.packets.every(({ packet }) => packet[12] !== 0));
    output.close();
  });
});

test('bind failure closes resources, reports an error, and never falls back to an ephemeral sender', () => {
  fakeTransport(({ sockets, timers }) => {
    const output = new ArtNetOutput(config);
    const failures = [];
    output.on('error', (error) => failures.push(error));
    const socket = sockets[0];
    socket.emit('error', Object.assign(new Error('occupied'), { code: 'EADDRINUSE' }));
    assert.equal(failures[0].code, 'EADDRINUSE');
    assert.equal(output.isClosed, true);
    assert.equal(socket.closeCount, 1);
    assert.equal(sockets.length, 1);
    assert.equal(timers.size, 0);
    socket.emit('listening');
    output.transmit();
    assert.equal(socket.packets.length, 0);
  });
});

test('invalid reconfiguration leaves the active configuration intact; send errors are observable', () => {
  fakeTransport(({ sockets, timers }) => {
    const output = new ArtNetOutput(config);
    const socket = sockets[0];
    const errors = [];
    output.on('error', (error) => errors.push(error));
    socket.emit('listening');
    assert.throws(() => output.configure({ ...config, universe: 16 }), /universe/);
    assert.equal(timers.size, 1);
    socket.sendError = Object.assign(new Error('unreachable'), { code: 'ENETUNREACH' });
    output.transmit();
    assert.equal(errors[0].code, 'ENETUNREACH');
    assert.equal(socket.packets.at(-1).port, config.port);
    output.close();
  });
});

test('loopback packets retain their bound source and stop reaching old destinations after reconfigure/close', async () => {
  const receivers = [dgram.createSocket('udp4'), dgram.createSocket('udp4')];
  const frames = [[], []];
  let output;
  try {
    for (const [index, receiver] of receivers.entries()) {
      receiver.on('message', (packet, source) => frames[index].push({ packet, source }));
      receiver.bind(0, '127.0.0.1');
      await once(receiver, 'listening');
    }
    // Default exercises actual source6454 on an otherwise unused local loopback
    // port. Use0 when running beside a live server; fake tests still enforce6454.
    const sourcePort = Number(process.env.ARTBASTARD_TEST_SOURCE_PORT ?? 6454);
    output = new ArtNetOutput({ ...config, port: receivers[0].address().port }, { address: '127.0.0.1', port: sourcePort });
    output.on('error', () => {});
    await once(output, 'ready');
    await sleep(60);
    assert.ok(frames[0].length > 0);
    const boundPort = frames[0][0].source.port;
    if (sourcePort !== 0) assert.equal(boundPort, sourcePort);
    const values = Array.from({ length: 512 }, (_, index) => index % 256);
    values.forEach((value, index) => output.setChannel(index, value));
    for (let index = 0; index < 4; index += 1) {
      const destination = (index + 1) % 2;
      const oldDestination = 1 - destination;
      output.configure({ ...config, port: receivers[destination].address().port });
      await sleep(60);
      const oldCount = frames[oldDestination].length;
      await sleep(80);
      assert.equal(frames[oldDestination].length, oldCount, 'old destination must stop receiving refreshes');
      assert.deepEqual([...frames[destination].at(-1).packet.subarray(18)], values);
      assert.ok(frames[destination].every(({ source }) => source.port === boundPort));
    }
    const closed = once(output, 'close');
    output.close();
    await closed;
    await sleep(30);
    const counts = frames.map((received) => received.length);
    await sleep(80);
    assert.deepEqual(frames.map((received) => received.length), counts);
    console.log(`Verified real loopback ArtDMX source port ${boundPort}; default required port6454.`);
  } finally {
    output?.close();
    receivers.forEach((receiver) => receiver.close());
  }
});
