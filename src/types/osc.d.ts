declare module 'osc' {
    export interface OscMessage {
        address: string;
        args: any[];
    }

    export interface UDPPortOptions {
        localAddress?: string;
        localPort?: number;
        remoteAddress?: string;
        remotePort?: number;
        metadata?: boolean;
    }

    export class UDPPort {
        constructor(options?: UDPPortOptions);
        on(event: string, listener: Function): this;
        open(): void;
        close(): void;
        send(message: OscMessage): void;
    }
}