
import * as fs from 'node:fs';

import {compile as compileHTML} from './html_compiler';
import {getCString} from './js_compiler';

export {parse as parseHTML} from './html_parser';
export {compile as compileHTML} from './html_compiler';


let template = fs.readFileSync('lib/template.c').toString();

export function compile(appName: string, file: string, out: string) {
    let code = fs.readFileSync(file).toString();
    code = 'void create(void){' + compileHTML(code) + '}';
    let defs = `#define APP_NAME ${getCString(appName)}`;
    code = template.replace('/* COMPILED CODE */', code).replace('/* DEFINITIONS */', defs);
    fs.writeFileSync(out, code);
}
