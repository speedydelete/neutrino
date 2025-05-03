
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import * as t from './types';
import {Scope, Type} from './types';
import {CompilerError} from './errors';


function expression(scope: Scope, node: b.Expression): Type {

}

function statement(scope: Scope, node: b.Statement): void {
    if (node.type === 'VariableDeclaration') {
        for (let decl of node.declarations) {
            scope.setLValue(decl.id, decl.init ? expression(scope, decl.init) : undefined);
        }
    } else {
        throw new CompilerError('SyntaxError', `Node of type ${node.type} is not valid in a TypeScript declaration`);
    }
}

export function parse(code: string, file?: string, {ts = false, dts = true}: {ts?: boolean, dts?: boolean} = {}): Scope {
    CompilerError.code = code;
    let out = new Scope();
    let ast = parser.parse(code, {
        plugins: ts ? [['typescript', {dts}]] : [],
        sourceType: 'module',
        sourceFilename: file,
    });
    for (let stmt of ast.program.body) {
        statement(out, stmt);
    }
    return out;
}
