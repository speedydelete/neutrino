
import type * as b from '@babel/types';
import * as t from './types';
import {Type} from './types';
import {Inferrer} from './inferrer';
import {Scope, ASTManipulator} from './util';


const TYPES = {
    any: 'any*',
    unknown: 'any*',
    never: 'any*',
    union: 'any*',
    intersection: 'any*',
    undefined: 'void*',
    void: 'void*',
    null: 'void**',
    boolean: 'bool',
    number: 'double',
    string: 'char*',
    symbol: 'symbol',
    object: 'object*',
};

const UNARY_OP_FUNCS: {[K in b.UnaryExpression['operator']]: string} = {
    '-': 'minus',
    '+': 'plus',
    '!': 'not',
    '~': 'lnot',
    'typeof': 'js_typeof',
    'void': 'js_void',
    'delete': 'js_delete',
    'throw': 'throw',
};

const BINARY_OP_FUNCS: {[K in Exclude<b.BinaryExpression['operator'], '|>'> | '&&' | '||' | '??']: string} = {
    '==': 'eq',
    '!=': 'ne',
    '===': 'seq',
    '!==': 'sne',
    '<': 'lt',
    '<=': 'lte',
    '>': 'gt',
    '>=': 'gte',
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '/': 'div',
    '%': 'mod',
    '**': 'exp',
    '|': 'or',
    '^': 'xor',
    '&': 'and',
    '<<': 'lsh',
    '>>': 'rsh',
    '>>>': 'ursh',
    'in': 'in',
    'instanceof': 'instanceof',
    '&&': 'land',
    '||': 'lor',
    '??': 'nc',
};


export class Generator extends ASTManipulator {

    static nextID: number = 0;
    static nextAnon: number = 0;

    infer: Inferrer;
    importIncludes: string[] = [];
    functions: string[] = [];
    main: string = '';
    id: number;

    constructor(fullPath: string, raw: string, scope?: Scope) {
        super(fullPath, raw, scope);
        this.infer = this.newConnectedSubclass(Inferrer);
        this.id = Generator.nextID++;
    }

    indent(code: string): string {
        return code.split('\n').map(x => '    ' + x).join('\n');
    }

    string(value: string): string {
        // @ts-ignore
        return '"' + value.replaceAll('"', '\\"').replaceAll('\n', '\\n') + '"';
    }

    type(type: Type, name?: string): string {
        if (type.type === 'bigint') {
            this.error('TypeError', 'BigInts are not supported');
        } else if (type.type === 'object' && type.call) {
            return this.type(type.call.returnType) + ' (*' + (name ?? '') + ')(object* this, ' + type.call.params.map(param => this.type(param[1], param[0])).join(', ') + ')';
        } else {
            let out = TYPES[type.type];
            if (name) {
                out += ' ' + name;
            }
            return out;
        }
    }

    getDeclarations(): string {
        let out = [];
        for (let [key, type] of this.scope.vars) {
            out.push(this.type(type, key));
        }
        return out.join(';\n');
    }

    function(node: b.Function): string {
        let name = 'id' in node && node.id ? 'js_function_' + this.id + '_' + node.id.name : 'js_anon_' + Generator.nextAnon++;
        let type = this.infer.function(node.params, node.returnType).call;
        let out = this.type(type.returnType) + ' ' + name + '(' + node.params.map((param, index) => {
            if (param.type !== 'Identifier') {
                this.error('InternalError', `Complicated lvalue encountered in Generator.function() of type ${node.type}`)
            } else {
                return this.type(type.params[index][1], 'js_variable_' + this.id + '_' + param.name);
            }
        }).join(', ') + ') {';
        this.pushScope();
        for (let [name, paramType] of type.params) {
            this.scope.set(name, paramType);
        }
        if (node.body.type === 'BlockStatement') {
            out += this.statement(node.body);
        } else {
            out += '{\n    return ' + this.expression(node.body) + ';\n}';
        }
        this.popScope();
        return out;
    }

    assignment(node: b.LVal | b.OptionalMemberExpression, value: string): string {
        this.setSourceData(node);
        switch (node.type) {
            case 'Identifier':
                return this.expression(node) + ' = ' + value;
            case 'MemberExpression':
                let prop = node.property.type === 'Identifier' ? node.property.name : this.expression(node.property);
                return 'set(' + this.expression(node.object) + ', ' + prop +')';
            default:
                this.error('InternalError', `Complicated lvalue encountered in Generator.assignment() of type ${node.type}`)
        }
    }

    expression(node: b.Expression | b.PrivateName | b.V8IntrinsicIdentifier): string {
        this.setSourceData(node);
        let func: string;
        let args: string;
        switch (node.type) {
            case 'Identifier':
                return 'js_variable_' + this.id + '_' + node.name;
            case 'PrivateName':
                this.error('SyntaxError', 'Private names are not supported');
            case 'RegExpLiteral':
                this.error('SyntaxError', 'RegExps are not supported');
            case 'NullLiteral':
                return 'JS_NULL';
            case 'StringLiteral':
                return this.string(node.value);
            case 'BooleanLiteral':
                return node.value ? 'true' : 'false';
            case 'NumericLiteral':
                return node.value.toString(10);
            case 'BigIntLiteral':
                this.error('SyntaxError', 'BigInts are not supported');
            case 'DecimalLiteral':
                this.error('SyntaxError', 'BigDecimals are not supported');
            case 'Super':
                this.error('SyntaxError', 'Super is not supported');
            case 'Import':
                this.error('SyntaxError', 'Dynamic import is not supported');
            case 'ThisExpression':
                return 'this';
            case 'ArrowFunctionExpression':
                return this.function(node);
            case 'YieldExpression':
                this.error('SyntaxError', 'Yield is not supported');
            case 'AwaitExpression':
                return 'await(' + this.expression(node.argument) + ')';
            case 'ArrayExpression':
                if (node.elements.length === 0) {
                    return 'create_array(0)';
                } else {
                    return 'create_array_with_items(' + node.elements.length + ', ' + node.elements.map(elt => {
                        if (elt.type === 'SpreadElement') {
                            this.error('SyntaxError', 'Spread elements are not supported');
                        } else {
                            return this.expression(elt);
                        }
                    }).join(', ') + ')';
                }
            case 'ObjectExpression':
                if (node.properties.length === 0) {
                    return 'create_object(0)';
                } else {
                    return 'create_object(' + node.properties.length * 2 + ', ' + node.properties.map(prop => {
                        if (prop.type === 'SpreadElement') {
                            this.error('SyntaxError', 'Spread elements are not supported');
                        } else {
                            let key = this.expression(prop.key);
                            if (prop.type === 'ObjectMethod') {
                                return key + ', ' + this.function(prop);
                            } else {
                                return key + ', ' + this.expression(prop.value as b.Expression);
                            }
                        }
                    }).join(', ') + ')';
                }
            case 'RecordExpression':
                this.error('SyntaxError', 'Records are not supported');
            case 'TupleExpression':
                this.error('SyntaxError', 'Tuples are not supported');
            case 'FunctionExpression':
                return this.function(node);
            case 'UnaryExpression':
                return UNARY_OP_FUNCS[node.operator] + '(' + this.expression(node.argument) + ')';
            case 'UpdateExpression':
                return (node.prefix ? '' : 'postfix_' + (node.operator === '++' ? 'inc' : 'dec')) + '(' + this.expression(node.argument) + ')';
            case 'BinaryExpression':
            case 'LogicalExpression':
                return BINARY_OP_FUNCS[node.operator] + '(' + this.expression(node.left) + ', ' + this.expression(node.right) + ')';
            case 'AssignmentExpression':
                return this.assignment(node.left, this.expression(node.right));
            case 'MemberExpression':
            case 'OptionalMemberExpression':
                let prop = node.property.type === 'Identifier' ? this.string(node.property.name) : this.expression(node.property);
                func = node.type === 'MemberExpression' ? 'get' : 'optional_get';
                return func + '(' + this.expression(node.object) + ', ' + prop +')';
            case 'BindExpression':
                this.error('SyntaxError', 'Bind expressions are not supported');
            case 'ConditionalExpression':
                return 'ternary(' + this.expression(node.test) + ', ' + this.expression(node.consequent) + ',' + this.expression(node.alternate) + ')';
            case 'CallExpression':
            case 'OptionalCallExpression':
            case 'NewExpression':
                args = node.arguments.map(arg => {
                    if (arg.type === 'SpreadElement') {
                        this.error('SyntaxError', 'Spread elements are not supported');
                    } else {
                        return this.expression(arg as b.Expression);
                    }
                }).join(', ');
                func = node.callee.type === 'Identifier' ? 'js_function_' + this.id + '_' + node.callee.name : this.expression(node.callee);
                if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
                    if (node.callee.type === 'MemberExpression') {
                        let macro = node.type === 'OptionalCallExpression' ? 'optional_method_call' : 'call';
                        return macro + '(' + this.expression(node.callee.object) + ', ' + (node.callee.property.type === 'Identifier' ? this.string(node.callee.property.name) : this.expression(node.callee.property)) + ', ' + args + ')';
                    } else if (node.type === 'OptionalCallExpression') {
                        return 'optional_call(' + func + ', NULL, ' + args + ')';
                    } else {
                        return func + '(NULL, ' + args + ')';
                    }
                } else {
                    let proto = node.callee.type === 'Identifier' ? 'js_variable_' + this.id + '_' + node.callee.name : this.expression(node.callee);
                    return 'new(' + func + ', get(' + proto + ', "prototype"), ' + args + ')';
                }
            case 'SequenceExpression':
                return node.expressions.map(this.expression).join(', ');
            case 'ParenthesizedExpression':
                return '(' + this.expression(node.expression) + ')';
            case 'DoExpression':
                this.error('SyntaxError', 'Do expressions are not supported');
            case 'ModuleExpression':
                this.error('SyntaxError', 'Module expressions are not supported');
            case 'TemplateLiteral':
            case 'TaggedTemplateExpression':
                this.error('SyntaxError', 'Template literals are not supported');
            default:
                this.error('InternalError', `Bad/unrecongnized AST node in Generator.statement() of type ${node.type}`);
        }
    }

    statement(node: b.Statement): string {
        this.setSourceData(node);
        let out: string;
        switch (node.type) {
            case 'ExpressionStatement':
                return this.expression(node.expression) + ';\n';
            case 'BlockStatement':
                this.pushScope();
                node.body.forEach(x => this.infer.statement(x));
                out = '{\n' + this.indent(this.getDeclarations() + node.body.map(this.statement)) + '}\n';
                this.popScope();
                return out;
            case 'EmptyStatement':
            case 'DebuggerStatement':
                return ';\n';
            case 'WithStatement':
                this.error('SyntaxError', 'The with statement is not supported');
            case 'ReturnStatement':
                if (node.argument) {
                    return 'return;\n';
                } else {
                    return 'return ' + this.expression(node.argument) + ';\n';
                }
            case 'LabeledStatement':
                return node.label.name + ': ' + this.statement(node.body);
            case 'BreakStatement':
            case 'ContinueStatement':
                if (node.label) {
                    return 'goto ' + node.label + ';\n';
                } else {
                    return node.type === 'BreakStatement' ? 'break;\n' : 'continue;\n';
                }
            case 'IfStatement':
                out = 'if (' + this.expression(node.test) + ') ' + this.statement(node.consequent);
                if (node.alternate) {
                    if (node.consequent.type === 'BlockStatement') {
                        out = out.slice(0, -1) + ' else ';
                    } else {
                        out += '\nelse ';
                    }
                    out += this.statement(node.alternate);
                }
                return out;
            case 'SwitchStatement':
                out = '';
                for (let case_ of node.cases) {
                    if (case_.test) {
                        out += 'case ' + this.expression(case_.test) + ':\n';
                    } else {
                        out += 'default:\n';
                    }
                    out += this.indent(case_.consequent.map(this.statement).join('\n')) + '\n';
                }
                return 'switch (' + this.expression(node.discriminant) + ') {\n' + this.indent(out) + '}\n';
            case 'ThrowStatement':
                return 'throw(' + this.expression(node.argument) + ');\n';
            case 'TryStatement':
                this.error('SyntaxError', 'The try statement is not supported');
            case 'WhileStatement':
                return 'while (' + this.expression(node.test) + ') ' + this.statement(node.body);
            case 'DoWhileStatement':
                return 'do ' + this.statement(node.body) + ' while (' + this.expression(node.test) + ');\n';
            case 'ForStatement':
                out = 'for (';
                if (node.init) {
                    if (node.init.type === 'VariableDeclaration') {
                        out += this.statement(node.init).slice(0, -1) + ' ';
                    } else {
                        out += this.expression(node.init) + ' ';
                    }
                } else {
                    out += '; ';
                }
                out += node.test ? this.expression(node.test) + '; ' : '; ';
                if (node.update) {
                    out += this.expression(node.update);
                }
                return out;
            case 'ForInStatement':
            case 'ForOfStatement':
                out = '';
                let type: t.Type;
                if (node.type === 'ForInStatement') {
                    out += 'array* obj = object_keys(' + this.expression(node.right) + ');\n';
                    type = t.array(t.string);
                } else {
                    type = this.infer.expression(node.right);
                    out += this.type(type, 'obj') + ' = ' + this.expression(node.right) + ';\n';
                }
                let init: string;
                if ('isArray' in type) {
                    out += 'for (int i = 0; i < obj-length; i++) {\n';
                    init = 'obj->items[i]';
                } else {
                    out += 'object* iterator = get(obj, Symbol_iterator);\nwhile (true) {\nobject* data = call(obj, "next")\nif (get(data, "done")) break;\n';
                    init = 'get(data, "value")';
                }
                let body: string;
                this.pushScope();
                if (node.left.type === 'VariableDeclaration') {
                    body = this.statement(node.left).slice(0, -2) + ' = ' + init;
                } else {
                    body = this.assignment(node.left, init);
                }
                body += this.statement(node.body);
                this.popScope();
                out += this.indent(body) + '}';
                return 'do {' + this.indent(out) + '} while (0);';
            case 'FunctionDeclaration':
                this.function(node);
                return '';
            case 'VariableDeclaration':
                out = '';
                for (let decl of node.declarations) {
                    if (decl.init) {
                        out += this.assignment(decl.id, this.expression(decl.init)) + ';\n';
                    }
                }
                return out;
            default:
                this.error('InternalError', `Bad/unrecongnized AST node in Generator.statement() of type ${node.type}`);
        }
    }

    program(node: b.Program): string {
        this.importIncludes = [];
        this.functions = [];
        let out = 'set_argv(argc, argv)\n';
        this.infer.program(node);
        for (let statement of node.body) {
            out += this.statement(statement);
        }
        return '\n#include "builtins/neutrino.c"\n\n' + this.importIncludes.join('\n') + '\n\n\n' 
        + this.getDeclarations() + '\n\n\n' + this.functions.join('\n') + '\n\n\nint main(int argc, char** argv) {\n' + this.indent(out) + '\n}';
    }

}
