
import {Compiler, CompilerOptions} from './compiler';

export * from './compiler';
export * from './types';


export function compile(code: string, options: CompilerOptions = {}): string {
    return (new Compiler(options)).compile(code);
}
