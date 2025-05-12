
export * as t from './types.js';
export {Type} from './types.js';
export {SourceData, CompilerError, Stack, Scope, GLOBAL_SCOPE, ASTManipulator} from './util.js';
export {Inferrer} from './inferrer.js';
export {Caster} from './caster.js';
export {Generator} from './generator.js';
export {config, setConfig, loadConfig} from './config.js';
export {File, loadImport, loadFile} from './imports.js';
export {transform, transformAll, compile, compileAll, compilePath, compileBuiltins, transformAndCompileAll} from './compiler.js';

import {join} from 'node:path';
import * as fs from 'node:fs';
import * as parser from '@babel/parser';
import * as t from './types.js';
import {GLOBAL_SCOPE} from './util.js';
import {Inferrer} from './inferrer.js';


let globalDTS = fs.readFileSync(join(import.meta.dirname, '..', 'builtins/index.d.ts')).toString();
let parsedGlobalDTS = parser.parse(globalDTS, {
    sourceFilename: 'index.d.ts',
    plugins: [['typescript', {dts: true}]],
});
GLOBAL_SCOPE.set('undefined', t.undefined);
(new Inferrer('builtins/index.d.ts', globalDTS, GLOBAL_SCOPE, false)).program(parsedGlobalDTS.program);
GLOBAL_SCOPE.set('globalThis', t.object(Object.fromEntries(Array.from(GLOBAL_SCOPE.vars.entries()))));
