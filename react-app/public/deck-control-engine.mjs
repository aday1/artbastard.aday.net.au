/** Standard Gamepad button indices; the Kefka evdev bridge normalizes to these. */
export const BUTTON = Object.freeze({ A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 });
const watched = Object.values(BUTTON);
const down = (pad, index) => Number(pad?.buttons?.[index]?.value ?? pad?.buttons?.[index] ?? 0) > 0.5;

/** Produces intentions only. It never opens sockets, writes DMX, or persists arming. */
export class DeckControlEngine {
  constructor() {
    this.armed = false;
    this.source = null;
    this.ready = false;
    this.previous = {};
    this.repeatAt = {};
  }
  disarm() { this.armed = false; }
  reset() {
    this.disarm();
    this.source = null;
    this.ready = false;
    this.previous = {};
    this.repeatAt = {};
  }
  arm() {
    if (!this.ready) return false;
    this.armed = true;
    return true;
  }
  step(pad, { focused, online, source, now }) {
    if (!focused || !online || !pad || !source) {
      this.reset();
      return [];
    }
    if (source !== this.source) {
      this.reset();
      this.source = source;
    }
    const current = Object.fromEntries(watched.map(index => [index, down(pad, index)]));
    // Connecting/focusing with a held control must not trigger an action.
    if (!this.ready) {
      this.previous = current;
      this.ready = !watched.some(index => current[index]);
      return [];
    }
    const edge = index => current[index] && !this.previous[index];
    const pulse = index => {
      if (!current[index]) { delete this.repeatAt[index]; return false; }
      if (edge(index)) { this.repeatAt[index] = now + 400; return true; }
      if (now >= (this.repeatAt[index] ?? Infinity)) {
        this.repeatAt[index] = now + 120;
        return true;
      }
      return false;
    };
    const actions = [];
    if (edge(BUTTON.X)) {
      this.disarm();
      actions.push({ type: 'blackout' });
    } else if (edge(BUTTON.B)) {
      this.disarm();
      actions.push({ type: 'disarm' });
    } else if (edge(BUTTON.Y)) {
      this.armed = !this.armed;
      actions.push({ type: this.armed ? 'arm' : 'disarm' });
    } else {
      if (pulse(BUTTON.LEFT)) actions.push({ type: 'channel', delta: -1 });
      if (pulse(BUTTON.RIGHT)) actions.push({ type: 'channel', delta: 1 });
      if (edge(BUTTON.LB)) actions.push({ type: 'scene', delta: -1 });
      if (edge(BUTTON.RB)) actions.push({ type: 'scene', delta: 1 });
      if (this.armed && current[BUTTON.LT]) {
        const amount = current[BUTTON.RT] ? 10 : 1;
        if (pulse(BUTTON.UP)) actions.push({ type: 'adjust', delta: amount });
        if (pulse(BUTTON.DOWN)) actions.push({ type: 'adjust', delta: -amount });
        if (edge(BUTTON.A)) actions.push({ type: 'recall' });
      } else {
        delete this.repeatAt[BUTTON.UP];
        delete this.repeatAt[BUTTON.DOWN];
      }
    }
    this.previous = current;
    return actions;
  }
}
