
import * as fs from 'node:fs';
import * as parser from '@babel/parser';
import * as t from './types';
import {Scope} from './util';
import {Inferrer} from './inferrer';
import {Generator} from './generator';


let globalDTS = fs.readFileSync('builtins/index.d.ts').toString();
const GLOBAL_SCOPE = new Scope({
    file: 'builtins/index.d.ts',
    raw: globalDTS,
    fullRaw: globalDTS,
    line: 1,
    col: 0,
});
GLOBAL_SCOPE.set('undefined', t.undefined);
(new Inferrer('builtins/index.d.ts', globalDTS, GLOBAL_SCOPE)).program(parser.parse(globalDTS, {sourceFilename: 'index.d.ts', plugins: [['typescript', {dts: true}]]}).program);


export interface CompilerOptions {
    filename?: string;
    ts?: boolean;
    jsx?: boolean;
    dts?: string;
}

export function compile(code: string, options: CompilerOptions = {}): string {
    let filename = options.filename ?? '<anonymous>';
    let plugins: parser.ParserPlugin[] = [];
    if (options.jsx) {
        plugins.push('jsx');
    }
    if (options.ts) {
        plugins.push('typescript');
    }
    let parserOptions: parser.ParserOptions = {
        sourceFilename: filename,
        plugins,
    }
    let scope = new Scope(GLOBAL_SCOPE);
    if (options.dts) {
        (new Inferrer(filename, code, scope)).program(parser.parse(code, parserOptions).program);
    }
    return (new Generator(filename, code, scope)).program(parser.parse(code, parserOptions).program);
}
