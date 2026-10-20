import dgram, { Socket } from 'dgram';
import { EventEmitter } from 'events';
import { isIPv4 } from 'net';

export interface ArtNetOutputConfig {
    ip: string;
    port: number;
    net: number;
    subnet: number;
    universe: number;
    base_refresh_interval: number;
}

function validatedConfig(config: ArtNetOutputConfig): ArtNetOutputConfig {
    if (!isIPv4(config.ip)) throw new Error('Art-Net destination must be an IPv4 address');
    for (const [name, max] of [['net', 127], ['subnet', 15], ['universe', 15]] as const) {
        if (!Number.isInteger(config[name]) || config[name] < 0 || config[name] > max) {
            throw new Error(`Invalid Art-Net ${name}`);
        }
    }
    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
        throw new Error('Invalid Art-Net destination port');
    }
    const interval = config.base_refresh_interval || 1000;
    if (!Number.isInteger(interval) || interval < 1) throw new Error('Invalid Art-Net refresh interval');
    return { ...config, base_refresh_interval: interval };
}

/**
 * The backend only needs ArtDMX output. One socket owns the Art-Net source port;
 * destination changes reuse it rather than creating listeners and refresh loops.
 * Art-Net 4 requires UDP source and destination port 0x1936 (6454).
 * https://art-net.org.uk/downloads/art-net.pdf
 */
export class ArtNetOutput extends EventEmitter {
    private readonly socket: Socket;
    private readonly values = Buffer.alloc(512);
    private config: ArtNetOutputConfig;
    private timer: NodeJS.Timeout | null = null;
    private sequence = 1;
    private ready = false;
    private closed = false;

    constructor(
        config: ArtNetOutputConfig,
        // A private loopback bind/ephemeral source is useful for isolated tests.
        binding: { address?: string; port?: number } = {}
    ) {
        super();
        this.config = validatedConfig(config);
        this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: false });
        this.socket.on('error', (error) => {
            if (!this.ready) this.close();
            this.emit('error', error);
        });
        this.socket.once('close', () => {
            this.closed = true;
            this.ready = false;
            this.clearRefreshTimer();
            this.emit('close');
        });
        this.socket.once('listening', () => {
            if (this.closed) return;
            try {
                this.socket.setBroadcast(true);
                this.ready = true;
                this.startRefreshTimer();
                this.transmit();
                this.emit('ready');
            } catch (error) {
                this.close();
                this.emit('error', error);
            }
        });
        this.socket.bind({ port: binding.port ?? 6454, address: binding.address ?? '0.0.0.0' });
    }

    get isClosed(): boolean { return this.closed; }

    configure(config: ArtNetOutputConfig): void {
        if (this.closed) throw new Error('Art-Net output is closed');
        this.config = validatedConfig(config);
        if (this.ready) {
            this.startRefreshTimer();
            this.transmit();
        }
    }

    setChannel(channel: number, value: number): void {
        if (!Number.isInteger(channel) || channel < 0 || channel >= 512) throw new Error('Invalid DMX channel');
        if (!Number.isFinite(value) || value < 0 || value > 255) throw new Error('Invalid DMX value');
        this.values[channel] = value;
    }

    transmit(): void {
        if (!this.ready || this.closed) return;
        const packet = Buffer.alloc(18 + 512);
        packet.write('Art-Net\0', 0, 'ascii');
        packet.writeUInt16LE(0x5000, 8);
        packet.writeUInt16BE(14, 10);
        packet[12] = this.sequence;
        packet[13] = 0;
        packet[14] = (this.config.subnet << 4) | this.config.universe;
        packet[15] = this.config.net;
        packet.writeUInt16BE(512, 16);
        this.values.copy(packet, 18);
        this.sequence = this.sequence === 255 ? 1 : this.sequence + 1;
        this.socket.send(packet, this.config.port, this.config.ip, (error) => {
            if (error && !this.closed) this.emit('error', error);
        });
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.ready = false;
        this.clearRefreshTimer();
        try { this.socket.close(); } catch {
            // A failed bind may already have closed the native socket.
        }
    }

    private clearRefreshTimer(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    private startRefreshTimer(): void {
        this.clearRefreshTimer();
        this.timer = setInterval(() => { this.transmit(); }, this.config.base_refresh_interval);
        this.timer.unref();
    }
}
