/**
 * LogService — In-app debug logger.
 * Import this file ONCE at the top of App.tsx to start intercepting.
 * Access logs from the hidden 5-tap on the version footer inside the app.
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
    id: string;
    level: LogLevel;
    message: string;
    timestamp: Date;
}

type Listener = (logs: LogEntry[]) => void;

class LogServiceClass {
    private logs: LogEntry[] = [];
    private readonly maxLogs = 500;
    private listeners: Listener[] = [];

    private _originalLog = console.log.bind(console);
    private _originalInfo = console.info.bind(console);
    private _originalWarn = console.warn.bind(console);
    private _originalError = console.error.bind(console);

    constructor() {
        console.log = (...args: any[]) => {
            this._add('log', args);
            this._originalLog(...args);
        };
        console.info = (...args: any[]) => {
            this._add('info', args);
            this._originalInfo(...args);
        };
        console.warn = (...args: any[]) => {
            this._add('warn', args);
            this._originalWarn(...args);
        };
        console.error = (...args: any[]) => {
            this._add('error', args);
            this._originalError(...args);
        };
    }

    private _add(level: LogLevel, args: any[]) {
        const message = args
            .map((a) => {
                if (a instanceof Error) return `${a.name}: ${a.message}`;
                if (typeof a === 'object') {
                    try { return JSON.stringify(a, null, 2); } catch { return String(a); }
                }
                return String(a);
            })
            .join(' ');

        const entry: LogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            level,
            message,
            timestamp: new Date(),
        };

        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) this.logs.pop();
        this.listeners.forEach((l) => l([...this.logs]));
    }

    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    clear() {
        this.logs = [];
        this.listeners.forEach((l) => l([]));
    }

    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }
}

export const LogService = new LogServiceClass();
