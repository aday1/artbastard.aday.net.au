import type { RoliRole } from './roliLightpad';

export interface RoliRoleTouchLike {
  role?: string;
}

export function isRoliTouchForRole(ev: RoliRoleTouchLike | null | undefined, role: RoliRole): boolean {
  return ev?.role === role;
}
