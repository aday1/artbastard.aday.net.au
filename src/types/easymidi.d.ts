declare module 'easymidi' {
    export function getInputs(): string[];
    export function getOutputs(): string[];
    export function input(name: string, virtual?: boolean): Input;
    export function output(name: string, virtual?: boolean): Output;

    export class Input {
        constructor(name: string, virtual?: boolean);
        on(event: string, callback: (msg: any) => void): void;
        close(): void;
    }

    export class Output {
        constructor(name: string, virtual?: boolean);
        send(event: string, message: any): void;
        close(): void;
    }
}