import { eases } from 'animejs';

/** OutExpo from https://animejs.com/easing-editor/exponential/outexpo */
export const outExpo = eases.outExpo;

export function lerpWithOutExpo(from: number, to: number, linearT: number): number {
  const t = Math.max(0, Math.min(1, linearT));
  return from + (to - from) * outExpo(t);
}
