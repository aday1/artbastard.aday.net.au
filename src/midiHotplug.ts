export interface MidiHotplugOptions {
    platform: string;
    listInputs: () => string[];
    activeInputs: () => string[];
    isInputOpen: (name: string) => boolean;
    configuredInputs: () => string[];
    defaultInputs: (available: string[]) => string[];
    connect: (name: string) => Promise<boolean>;
    disconnect: (name: string) => void;
    interfacesChanged?: (available: string[]) => void;
    reportError?: (error: unknown) => void;
}

// ALSA appends a volatile client:port address. Keep every part of the actual
// device/port name; do not match different devices by controller family.
export function midiInputIdentity(name: string, platform: string): string {
    return platform === 'linux' ? name.replace(/ \d+:\d+$/, '') : name;
}

export function forgetMidiInputIdentity(saved: string[], forgotten: string, platform: string): string[] {
    const identity = midiInputIdentity(forgotten, platform);
    return saved.filter((name) => midiInputIdentity(name, platform) !== identity);
}

export function resolveMidiInputName(
    requested: string,
    available: string[],
    platform: string
): string | undefined {
    if (available.includes(requested)) return requested;
    if (platform !== 'linux' || !/ \d+:\d+$/.test(requested)) return undefined;
    const identity = midiInputIdentity(requested, platform);
    const candidates = available.filter((name) =>
        / \d+:\d+$/.test(name) && midiInputIdentity(name, platform) === identity
    );
    return candidates.length === 1 ? candidates[0] : undefined;
}

export class MidiHotplugMonitor {
    private readonly options: MidiHotplugOptions;
    private readonly desired = new Set<string>();
    private readonly suppressed = new Set<string>();
    private allowDefaults = true;
    private running: Promise<void> | null = null;
    private previousInterfaces: string[] | null = null;

    constructor(options: MidiHotplugOptions) {
        this.options = options;
    }

    rememberConnection(name: string): void {
        this.desired.add(name);
        this.suppressed.delete(midiInputIdentity(name, this.options.platform));
    }

    suppressConnection(name: string): void {
        const identity = midiInputIdentity(name, this.options.platform);
        this.suppressed.add(identity);
        for (const desired of this.desired) {
            if (midiInputIdentity(desired, this.options.platform) === identity) {
                this.desired.delete(desired);
            }
        }
    }

    clearAutoConnect(): void {
        for (const name of [...this.desired, ...this.options.activeInputs()]) {
            this.suppressConnection(name);
        }
        // Clearing saved auto-connect devices must not immediately fall back to
        // smart defaults. A later explicit connection still works.
        this.allowDefaults = false;
    }

    observedActiveInputs(): string[] {
        try {
            const available = new Set(this.options.listInputs());
            return this.options.activeInputs().filter((name) =>
                available.has(name) && this.inputIsOpen(name)
            );
        } catch {
            // An enumeration failure is not evidence of connected hardware.
            // Reconciliation retains handles until enumeration succeeds.
            return [];
        }
    }

    reconcile(): Promise<void> {
        if (this.running) return this.running;
        this.running = this.reconcileOnce()
            .catch((error) => { this.options.reportError?.(error); })
            .finally(() => { this.running = null; });
        return this.running;
    }

    private inputIsOpen(name: string): boolean {
        try {
            return this.options.isInputOpen(name);
        } catch {
            return false;
        }
    }

    private async reconcileOnce(): Promise<void> {
        let available: string[];
        try {
            available = this.options.listInputs();
        } catch (error) {
            this.options.reportError?.(error);
            return;
        }

        for (const name of this.options.activeInputs()) {
            if (!available.includes(name) || !this.inputIsOpen(name)) {
                try {
                    this.options.disconnect(name);
                } catch (error) {
                    this.options.reportError?.(error);
                }
            }
        }

        if (!this.previousInterfaces
            || available.length !== this.previousInterfaces.length
            || available.some((name, index) => name !== this.previousInterfaces![index])) {
            this.previousInterfaces = [...available];
            this.options.interfacesChanged?.(available);
        }

        let configured: string[];
        try {
            configured = this.options.configuredInputs();
        } catch (error) {
            this.options.reportError?.(error);
            return;
        }
        const defaults = configured.length === 0 && this.allowDefaults
            ? this.options.defaultInputs(available)
            : [];
        const requested = new Set([...configured, ...defaults, ...this.desired]);
        const attempted = new Set<string>();
        for (const name of requested) {
            if (this.suppressed.has(midiInputIdentity(name, this.options.platform))) continue;
            const resolved = resolveMidiInputName(name, available, this.options.platform);
            if (!resolved || attempted.has(resolved)) continue;
            attempted.add(resolved);
            if (this.options.activeInputs().includes(resolved) && this.inputIsOpen(resolved)) continue;
            try {
                if (await this.options.connect(resolved)) {
                    if (this.suppressed.has(midiInputIdentity(resolved, this.options.platform))) {
                        this.options.disconnect(resolved);
                    } else {
                        this.rememberConnection(resolved);
                    }
                }
            } catch (error) {
                this.options.reportError?.(error);
            }
        }
    }
}
