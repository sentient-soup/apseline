import type { LogEntry } from '@apseline/shared';

const MAX = 500;
const buffer: LogEntry[] = [];

function push(level: LogEntry['level'], args: unknown[]): void {
  const message = args
    .map((a) => (a instanceof Error ? a.stack ?? a.message : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  if (buffer.length >= MAX) buffer.shift();
  buffer.push({ level, message, ts: Date.now() });
}

export function getAll(): LogEntry[] {
  return [...buffer];
}

// Patch console once so all server output feeds the buffer.
const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);
console.log = (...args: unknown[]) => { push('info', args); _log(...args); };
console.warn = (...args: unknown[]) => { push('warn', args); _warn(...args); };
console.error = (...args: unknown[]) => { push('error', args); _error(...args); };
