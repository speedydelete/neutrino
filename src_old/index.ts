
import {parse, ParserOptions} from '@babel/parser';
import {convert} from './converter';
import {generate, Language} from './generator';

export * as t from './types';
export * as a from './ast';
export * from './converter';
export * from './generator';


export function compile(code: string, lang: Language = 'js', pretty: boolean = false): string {
    return generate(convert(code, parse(code, {plugins: ['typescript']}).program), lang, pretty);
}
