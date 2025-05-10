
import * as fs from 'node:fs';
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import {Type} from './types.js';
import {Scope} from './util.js';


export interface File {
    path: string;
    id: string;
    exports: Map<string, Type>;
    dependsOn: File[];
    raw: string;
    ast: b.Program;
    scope: Scope;
}

export function getFile(path: string, lang: Language): File {
    let code = fs.readFileSync(path);
}
