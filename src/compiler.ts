
import * as parser from '@babel/parser';
import {Scope} from './util';
import {Inferrer} from './inferrer';
import {Generator} from './generator';


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
    let scope = new Scope({
        file: filename,
        raw: code,
        line: 1,
        col: 0,
    });
    if (options.dts) {
        (new Inferrer(filename, code, scope)).program(parser.parse(code, parserOptions).program);
    }
    return (new Generator(filename, code, scope)).program(parser.parse(code, parserOptions).program);
}
