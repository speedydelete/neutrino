
import * as fs from 'node:fs';
import * as parser from '@babel/parser';
import * as t from './types.js';
import {Scope} from './util.js';
import {Generator} from './generator.js';
import {File, loadFile, getID} from './imports.js';
import config, {Config, setConfig} from './config.js';


export function 

export function compile(file: File, config_?: Config): {code: string, header: string} {
    if (config_) {
        setConfig(config_);
    }
    let gen = new Generator(getID(), file.path, file.code);
    return {
        code: gen.program(file.ast),
    }
}
