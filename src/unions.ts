
import {t} from './util.js';


export type UnionType = 'undefined' | 'null' | 'boolean' | 'number' | 'string' | 'symbol' | 'bigint' | 'object' | Exclude<t.SpecialName, 'symbolFunction'>;

export type UnionFunc = 'add' | 'eq' | 'seq' | 'typeof' | 'to_any' | 'to_boolean' | 'to_number' | 'to_string' | 'to_primitive';

const SHORT_NAMES: {[K in UnionType]: string} = {
    undefined: 'v',
    null: 'n',
    boolean: 'b',
    number: 'd',
    string: 'c',
    symbol: 's',
    bigint: 'B',
    object: 'o',
    function: 'f',
    proxy: 'p',
    array: 'a',
    arraybuffer: 'A',
    int8array: '1',
    uint8array: '0',
    int16array: '2',
    uint16array: '3',
    int32array: '4',
    uint32array: '5',
    bigint64array: '8',
    biguint64array: '9',
    float32array: 'F',
    float64array: 'D',
    uint8clampedarray: 'C',
    date: 'T',
    regexp: 'R',
    set: 'S',
    map: 'M',
};

export interface UnionFuncCall {
    func: UnionFunc;
    args: (UnionType | Set<UnionType>)[];
}


export function unionFuncCallsAreEqual(a: UnionFuncCall, b: UnionFuncCall): boolean {
    if (a.func !== b.func || a.args.length !== b.args.length) {
        return false;
    }
    for (let i = 0; i < a.args.length; i++) {
        let x = a.args[i];
        let y = b.args[i];
        if (x instanceof Set) {
            if (y instanceof Set) {
                for (let item of x) {
                    if (!y.has(item)) {
                        return false;
                    }
                }
                for (let item of y) {
                    if (!x.has(item)) {
                        return false;
                    }
                }
            } else {
                return false;
            }
        } else {
            if (y instanceof Set) {
                return false;
            } else {
                if (x !== y) {
                    return false;
                }
            }
        }  
    }
    return true;
}

export function getCUnionFuncName(call: UnionFuncCall): string {
    return call.func + '_' + call.args.map(arg => arg instanceof Set ? Array.from(arg).map(x => SHORT_NAMES[x]).join('') : SHORT_NAMES[arg]).join('_');
}

export function createUnionFunc(call: UnionFuncCall): string {
    
}
