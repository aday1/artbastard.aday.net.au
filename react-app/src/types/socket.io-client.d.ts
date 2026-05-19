declare module 'socket.io-client' {
  import { Manager } from 'socket.io-client/build/esm/manager';
  import { Socket as EngineSocket } from 'socket.io-client/build/esm/socket';
  
  export interface SocketOptions {
    /**
     * the path of the endpoint the socket connects to
     * @default /socket.io
     */
    path?: string;
    /**
     * Should we force a new Manager for this connection?
     * @default false
     */
    forceNew?: boolean;
    /**
     * Should we multiplex our connection (reuse existing Manager) ?
     * @default true
     */
    multiplex?: boolean;
    /**
     * The time in milliseconds that a Manager will wait before a reconnection attempt
     * @default 1000
     */
    reconnectionDelay?: number;
    /**
     * The maximum time in milliseconds that a Manager will wait before a reconnection attempt
     * @default 5000
     */
    reconnectionDelayMax?: number;
    /**
     * The time in milliseconds that a Manager will wait before attempting a new reconnection
     * @default 500
     */
    timeout?: number;
    /**
     * Should we automatically connect?
     * @default true
     */
    autoConnect?: boolean;
    /**
     * The list of transports to try (in order)
     * @default ['polling', 'websocket']
     */
    transports?: string[];
    /**
     * Whether to enable reconnection attempts
     * @default true
     */
    reconnection?: boolean;
    /**
     * How many reconnection attempts before giving up
     * @default Infinity
     */
    reconnectionAttempts?: number;
  }

  export interface ManagerOptions {
    /**
     * Should we force a new Manager for this connection?
     * @default false
     */
    forceNew?: boolean;
    /**
     * Should we multiplex our connection (reuse existing Manager) ?
     * @default true
     */
    multiplex?: boolean;
  }

  interface DefaultEventsMap {
    [event: string]: (...args: any[]) => void;
  }

  export interface Socket<ListenEvents = DefaultEventsMap, EmitEvents = DefaultEventsMap> {
    on(event: string, callback: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): this;
    off(event: string, callback?: (...args: any[]) => void): this;
    connect(): this;
    disconnect(): this;
    close(): this;
    id: string;
    io: Manager;
  }

  export function io(uri: string, opts?: SocketOptions): Socket;

  export default io;
}