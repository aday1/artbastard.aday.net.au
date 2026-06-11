import { parse, stringify } from 'yaml';

const STRINGIFY_OPTIONS = {
  indent: 2,
  lineWidth: 0,
  sortMapEntries: false,
} as const;

export function emitYaml(value: unknown): string {
  return stringify(value, STRINGIFY_OPTIONS);
}

export function parseYaml<T = unknown>(text: string): T {
  return parse(text) as T;
}
