
import * as parser from '@babel/parser';
import type * as t from '@babel/types';


export function getCString(text: string): string {
    let out = '';
    for (let char of text) {
        let code = char.charCodeAt(0);
        if (code >= 0x20 && code < 0x7F) {
            out += char;
        } else if (char === '\n') {
            out += '\\n';
        } else {
            out += '\\u' + code.toString(16).padStart(4, '0');
        }
    }
    return '"' + out + '"';
}


// function compileType(node: t.TSType): string {

// }


function compile(node: t.Node | null | undefined | (t.Node | null | undefined)[]): string {
    if (!node) {
        return '';
    } else if (node instanceof Array) {
        return node.map(compile).join('');
    } else if (node.type === 'Identifier') {
        return node.name;
    } else if (node.type === 'PrivateName') {
        return 'neutrino_private_' + node.id.name;
    } else if (node.type === 'NullLiteral') {
        return 'NULL';
    } else if (node.type === 'StringLiteral') {
        return getCString(node.value);
    } else if (node.type === 'BooleanLiteral') {
        return node.value ? '1' : '0';
    } else if (node.type === 'NumericLiteral') {
        let out = node.value.toString();
        return out.includes('.') ? out : out + '.0';
    } else if (node.type === 'Program') {
        return compile(node.body);
    } else if (node.type === 'ExpressionStatement') {
        return compile(node.expression);
    } else if (node.type === 'BlockStatement') {
        return '{' + compile(node.body) + '}';
    } else if (node.type === 'EmptyStatement') {
        return ';';
    } else if (node.type === 'DebuggerStatement') {
        return ';';
    } else if (node.type === 'ReturnStatement') {
        return 'return ' + compile(node.argument) + ';';
    } else if (node.type === 'LabeledStatement') {
        return node.label + ':;' + compile(node.body) + ';';
    } else if (node.type === 'BreakStatement') {
        if (node.label === null) {
            return 'break;'
        } else {
            return 'goto ' + node.label + ';';
        }
    } else if (node.type === 'ContinueStatement') {
        if (node.label === null) {
            return 'continue;'
        } else {
            return 'goto ' + node.label + ';';
        }
    } else if (node.type === 'IfStatement') {
        let out = 'if(' + compile(node.test) + '){' + compile(node.consequent) + '}';
        if (node.alternate) {
            out += 'else{' + compile(node.alternate) + '}';
        }
        return out;
    } else if (node.type === 'SwitchStatement') {
        return 'switch(' + compile(node.discriminant) + '){' + compile(node.cases) + '}';
    } else if (node.type === 'SwitchCase') {
        return 'case ' + compile(node.test) + ':' + compile(node.consequent);
    } else if (node.type === 'WhileStatement') {
        return 'while(' + compile(node.test) + '){' + compile(node.body) + '}';
    } else if (node.type === 'DoWhileStatement') {
        return 'do{' + compile(node.body) + '}while(' + compile(node.test) + ');';
    } else if (node.type === 'ForStatement') {
        return 'for(' + compile(node.init) + ';' + compile(node.test) + ';' + compile(node.update) + '){' + compile(node.body) + '}';
    } else if (node.type === 'VariableDeclaration') {
        let out: string[] = [];
        for (let declaration of node.declarations) {
            if (!(declaration.id.type === 'Identifier')) {
                throw new Error('non-identifier declarations are not supported');
            }
            if (!declaration.id.typeAnnotation) {
                throw new Error('variable declarations must have a type');
            }
            // out += compileType(declaration.id.typeAnnotation)
        }
        if (node.kind === 'const') {
            out = out.map(x => 'const ' + x);
        }
        return out.join(';');
    } else if (node.type === 'ArrayExpression') {
        return '[' + node.elements.map(compile).join(',') + ']';
    } else if (node.type === 'UnaryExpression' || node.type === 'UpdateExpression') {
        if (node.prefix) {
            return node.operator + compile(node.argument);
        } else {
            return compile(node.argument) + node.operator;
        }
    } else if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
        return compile(node.left) + node.operator + compile(node.right);
    } else if (node.type === 'MemberExpression') {
        return compile(node.object) + '->' + compile(node.property);
    } else if (node.type === 'ConditionalExpression') {
        return compile(node.test) + '?' + compile(node.consequent) + ':' + compile(node.alternate);
    } else if (node.type === 'CallExpression') {
        return compile(node.callee) + '(' + node.arguments.map(compile).join(',') + ')';
    } else {
        throw new Error(`nodes of type ${node.type} are not supported`);
    }
}


export interface CompilerOptions {
    jsx?: boolean;
    ts?: boolean;
}


function compileJS(code: string, options: CompilerOptions = {}): string {
    let plugins: parser.ParserPlugin[] = [];
    if (options.jsx) {
        plugins.push('jsx');
    }
    if (options.ts) {
        plugins.push('typescript');
    }
    return compile(parser.parse(code, {
        plugins,
    }));
}

export {compileJS as compile};
