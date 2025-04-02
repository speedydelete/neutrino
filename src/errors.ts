
import {highlight} from './highlight';


export interface SourceData {
    raw: string;
    rawLine: string;
    file: string;
    line: number;
    col: number;
    length: number;
}


export class CompilerError extends Error implements SourceData {

    [Symbol.toStringTag] = 'CompilerError';

    type: string;

    raw: string;
    rawLine: string;
    file: string;
    line: number;
    col: number;
    length: number;

    constructor(type: string, message: string, src: SourceData) {
        super(message);
        this.type = type;
        this.raw = src.raw;
        this.rawLine = src.rawLine;
        this.file = src.file;
        this.line = src.line;
        this.col = src.col;
        this.length = src.length;
    }

    toString(): string {
        let out = `${this.type}: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + this.rawLine + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.length) + ' (here)';
        return out;
    }

    toStringHighlighted(): string {
        let out = `\x1b[91m${this.type}\x1b[0m: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + highlight(this.rawLine) + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.length) + ' (here)';
        return out;
    }

}
