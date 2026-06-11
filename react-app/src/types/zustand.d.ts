declare module 'zustand' {
  import { Socket } from 'socket.io-client';
  
  export type StateCreator<T> = (set: any, get: any, api: any) => T;
  
  export interface StoreApi<T> {
    getState: () => T;
    setState: (partial: T | ((state: T) => T), replace?: boolean) => void;
    subscribe: (listener: (state: T, prevState: T) => void) => void;
    destroy: () => void;
  }
  
  export type UseStore<T> = {
    (): T;
    <U>(selector: (state: T) => U): U;
    setState: (state: Partial<T> | ((state: T) => Partial<T>)) => void;
    getState: () => T;
  };
  
  export function create<T>(): (
    fn: StateCreator<T>
  ) => UseStore<T> & StoreApi<T>;
}

declare module 'zustand/middleware' {
  export function devtools<T>(
    fn: (set: any, get: any, api: any) => T, 
    options?: { name?: string }
  ): (set: any, get: any, api: any) => T;
  
  export function persist<T>(
    fn: (set: any, get: any, api: any) => T, 
    options?: any
  ): (set: any, get: any, api: any) => T;
}