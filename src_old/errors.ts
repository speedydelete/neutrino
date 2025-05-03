
import {highlight} from './highlighter';


export interface SourceData {
    raw: string;
    file: string;
    line: number;
    col: number;
}


export class CompilerError extends Error implements SourceData {

    [Symbol.toStringTag] = 'CompilerError' as const;

    type: string;

    raw: string;
    rawLine: string;
    file: string;
    line: number;
    col: number;

    constructor(type: string, message: string, src: SourceData) {
        super(message);
        this.type = type;
        this.raw = src.raw;
        this.rawLine = src.raw.split('\n')[0];
        this.file = src.file;
        this.line = src.line;
        this.col = src.col;
    }

    toString(): string {
        let out = `${this.type}: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + this.rawLine + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.raw.length) + ' (here)';
        if (this.type === 'NeutrinoBugError') {
            out += '\n\nStack trace:\n' + this.stack;
        }
        return out;
    }

    toStringHighlighted(): string {
        let out = `\x1b[91m${this.type}\x1b[0m: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + highlight(this.rawLine) + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.raw.length) + ' (here)';
        if (this.type === 'NeutrinoBugError') {
            out += '\n\nStack trace:\n' + this.stack;
        }
        return out;
    }

}
