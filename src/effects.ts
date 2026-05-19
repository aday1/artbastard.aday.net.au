import { Server } from 'socket.io';

interface Effect {
    id: string;
    name: string;
    type: 'colorCycle' | 'strobe';
    params: {
        speed: number;
        colors?: string[];
        intensity?: number;
    };
}

interface EffectTarget {
    type: 'fixture' | 'group';
    id: number;
}

class EffectsEngine {
    private effects: Effect[] = [];
    public activeEffects: Map<string, EffectTarget[]> = new Map();
    private intervalId: NodeJS.Timeout | null = null;

    constructor(private io: Server) {}

    addEffect(effect: Effect): void {
        this.effects.push(effect);
        this.io.emit('effectAdded', effect);
    }

    removeEffect(effectId: string): void {
        const index = this.effects.findIndex(e => e.id === effectId);
        if (index !== -1) {
            this.effects.splice(index, 1);
            this.activeEffects.delete(effectId);
            this.io.emit('effectRemoved', effectId);
        }
    }

    applyEffect(effectId: string, target: EffectTarget): void {
        const effect = this.effects.find(e => e.id === effectId);
        if (effect) {
            if (!this.activeEffects.has(effectId)) {
                this.activeEffects.set(effectId, []);
            }
            this.activeEffects.get(effectId)!.push(target);
            this.io.emit('effectApplied', { effectId, target });
        }
    }

    removeEffectFromTarget(effectId: string, target: EffectTarget): void {
        const targets = this.activeEffects.get(effectId);
        if (targets) {
            const index = targets.findIndex(t => t.type === target.type && t.id === target.id);
            if (index !== -1) {
                targets.splice(index, 1);
                this.io.emit('effectRemovedFromTarget', { effectId, target });
            }
        }
    }

    startEffectsLoop(): void {
        if (this.intervalId === null) {
            this.intervalId = setInterval(() => this.processEffects(), 50); // Run every 50ms
        }
    }

    stopEffectsLoop(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private processEffects(): void {
        const now = Date.now();
        for (const [effectId, targets] of this.activeEffects.entries()) {
            const effect = this.effects.find(e => e.id === effectId);
            if (effect) {
                for (const target of targets) {
                    this.applyEffectToTarget(effect, target, now);
                }
            }
        }
    }

    private applyEffectToTarget(effect: Effect, target: EffectTarget, now: number): void {
        switch (effect.type) {
            case 'colorCycle':
                this.applyColorCycleEffect(effect, target, now);
                break;
            case 'strobe':
                this.applyStrobeEffect(effect, target, now);
                break;
        }
    }

    private applyColorCycleEffect(effect: Effect, target: EffectTarget, now: number): void {
        const { speed, colors = ['#ff0000', '#00ff00', '#0000ff'] } = effect.params;
        const cycleTime = 1000 / speed; // Time for one complete cycle in ms
        const colorIndex = Math.floor((now % cycleTime) / (cycleTime / colors.length));
        const color = colors[colorIndex];

        // Emit an event to update the target's color
        this.io.emit('updateTargetColor', { target, color });
    }

    private applyStrobeEffect(effect: Effect, target: EffectTarget, now: number): void {
        const { speed, intensity = 255 } = effect.params;
        const cycleTime = 1000 / speed; // Time for one complete cycle in ms
        const isOn = (now % cycleTime) < (cycleTime / 2);
        const value = isOn ? intensity : 0;

        // Emit an event to update the target's intensity
        this.io.emit('updateTargetIntensity', { target, value });
    }
}

export default EffectsEngine;