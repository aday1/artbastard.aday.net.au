import { execFileSync } from 'child_process';
import fs from 'fs';

type Direction = 'input' | 'output';
interface AlsaPort {
    address: string;
    clientName: string;
    portName: string;
    pid?: number;
    to: Set<string>;
    from: Set<string>;
}
export type AlsaSnapshot = Map<string, AlsaPort>;
interface TrackedSubscription {
    local: AlsaPort;
    remote: AlsaPort;
}
interface Options {
    platform: string;
    pid: number;
    readOwners?: () => string;
    readSubscriptions?: () => string;
    reportUnavailable?: (message: string) => void;
}

// /proc supplies subscriptions but omits ownership. aconnect includes PIDs and
// is used only around construction, never by health checks or the polling loop.
export function parseAlsaListing(text: string, format: 'proc' | 'aconnect'): AlsaSnapshot | null {
    const ports: AlsaSnapshot = new Map();
    let client: { id: number; name: string; pid?: number } | undefined;
    let port: AlsaPort | undefined;
    let clientCount = 0;
    for (const line of text.split('\n')) {
        const header = format === 'proc'
            ? /^Client\s+(\d+)\s*:\s*"(.*)"\s+\[/.exec(line)
            : /^client\s+(\d+):\s*'(.*)'\s+\[(.*)\]/.exec(line);
        if (header) {
            const owner = format === 'aconnect' ? /(?:^|,)pid=(\d+)(?:,|$)/.exec(header[3]) : null;
            client = { id: Number(header[1]), name: header[2], pid: owner ? Number(owner[1]) : undefined };
            port = undefined;
            clientCount++;
            continue;
        }
        const portLine = format === 'proc'
            ? /^\s+Port\s+(\d+)\s*:\s*"(.*)"\s+\(/.exec(line)
            : /^\s+(\d+)\s+'(.*)'\s*$/.exec(line);
        if (client && portLine) {
            port = {
                address: `${client.id}:${Number(portLine[1])}`,
                clientName: client.name, portName: portLine[2].trimEnd(), pid: client.pid,
                to: new Set(), from: new Set(),
            };
            ports.set(port.address, port);
            continue;
        }
        const connection = /^\s+(Connecting To|Connected From):\s*(.*)$/.exec(line);
        if (port && connection) {
            const target = connection[1] === 'Connecting To' ? port.to : port.from;
            // Both proc's [r:0] and aconnect's [real:0] queue annotations are
            // deliberately ignored; neither changes the endpoint address.
            for (const address of connection[2].matchAll(/(?:^|,\s*)(\d+:\d+)/g)) target.add(address[1]);
        }
    }
    return clientCount > 0 && ports.size > 0 ? ports : null;
}

export class MidiAlsaSubscriptions {
    private readonly tracked = new Map<string, Partial<Record<Direction, TrackedSubscription>>>();
    private readonly options: Options;
    private warned = false;

    constructor(options: Options) {
        this.options = options;
    }

    captureOwnership(): AlsaSnapshot | null {
        if (this.options.platform !== 'linux') return null;
        try {
            const listing = this.options.readOwners ? this.options.readOwners() : execFileSync('aconnect', ['-l'], {
                encoding: 'utf8', timeout: 500, maxBuffer: 512 * 1024,
                env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            const result = parseAlsaListing(listing, 'aconnect');
            if (!result) this.unavailable();
            return result;
        } catch {
            this.unavailable();
            return null;
        }
    }

    remember(name: string, direction: Direction, deviceName: string, before: AlsaSnapshot | null): void {
        const pair = this.tracked.get(name) || {};
        delete pair[direction];
        this.tracked.set(name, pair);
        if (this.options.platform !== 'linux') return;
        const address = / (\d+:\d+)$/.exec(deviceName)?.[1];
        if (!before || !address) return;
        const after = this.captureOwnership();
        if (!after) return;
        const remote = after.get(address);
        const expectedPortName = direction === 'input' ? 'RtMidi Input' : 'RtMidi Output';
        const candidates = [...after.values()].filter((port) =>
            port.pid === this.options.pid && !before.has(port.address) && port.portName === expectedPortName
        );
        // A concurrent client or unusual backend must never be mistaken for
        // this handle. Unknown ownership leaves the previous native checks.
        if (!remote || `${remote.clientName}:${remote.portName} ${address}` !== deviceName || candidates.length !== 1) {
            this.unavailable();
            return;
        }
        pair[direction] = { local: candidates[0], remote };
    }

    forget(name: string): void {
        this.tracked.delete(name);
    }

    status(name: string): Partial<Record<Direction, boolean>> {
        const pair = this.tracked.get(name);
        if (!pair || (!pair.input && !pair.output)) return {};
        let current: AlsaSnapshot | null;
        try {
            current = parseAlsaListing(this.options.readSubscriptions
                ? this.options.readSubscriptions()
                : fs.readFileSync('/proc/asound/seq/clients', 'utf8'), 'proc');
        } catch {
            this.unavailable();
            return {};
        }
        if (!current) {
            this.unavailable();
            return {};
        }
        const result: Partial<Record<Direction, boolean>> = {};
        for (const direction of ['input', 'output'] as const) {
            const known = pair[direction];
            if (!known) continue;
            const local = current.get(known.local.address);
            const remote = current.get(known.remote.address);
            const sameIdentity = (actual: AlsaPort | undefined, expected: AlsaPort) =>
                actual?.clientName === expected.clientName && actual?.portName === expected.portName;
            const linked = direction === 'input'
                ? local?.from.has(known.remote.address) && remote?.to.has(known.local.address)
                : local?.to.has(known.remote.address) && remote?.from.has(known.local.address);
            result[direction] = sameIdentity(local, known.local) && sameIdentity(remote, known.remote) && Boolean(linked);
        }
        return result;
    }

    private unavailable(): void {
        if (!this.warned) {
            this.warned = true;
            this.options.reportUnavailable?.('Linux MIDI subscription verification unavailable; using native MIDI status checks');
        }
    }
}
