
export * as t from './types.js';
export {Type} from './types.js';
export {SourceData, CompilerError, Stack, Scope, GLOBAL_SCOPE, ASTManipulator} from './util.js';
export {Inferrer} from './inferrer.js';
export {Caster} from './caster.js';
export {Generator} from './generator.js';
export {config, setConfig} from './config.js';
export {File, loadImport, loadFile} from './imports.js';
export {transform, transformAll} from './compiler.js';

import * as fs from 'node:fs';
import * as parser from '@babel/parser';
import {GLOBAL_SCOPE} from './util.js';
import {Inferrer} from './inferrer.js';


let globalDTS = fs.readFileSync(import.meta.dirname).toString();
let parsedGlobalDTS = parser.parse(globalDTS, {
    sourceFilename: 'index.d.ts',
    plugins: [['typescript', {dts: true}]],
});
(new Inferrer('builtins/index.d.ts', globalDTS, GLOBAL_SCOPE)).program(parsedGlobalDTS.program);
