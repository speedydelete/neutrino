
import type * as b from '@babel/types';
import * as t from './types';
import {Type} from './types';
import {Inferrer} from './inferrer';
import {Caster} from './caster';
import {Scope, ASTManipulator} from './util';


const TYPES = {
    any: 'any*',
    undefined: 'void*',
    void: 'void*',
    null: 'void**',
    boolean: 'bool',
    number: 'double',
    string: 'char*',
    symbol: 'symbol',
    object: 'object*',
    array: 'array*',
};


export class Generator extends ASTManipulator {

    static nextID: number = 0;
    static nextAnon: number = 0;

    infer: Inferrer;
    cast: Caster;
    importIncludes: string[] = [];
    functions: string[] = [];
    topLevel: string = '';
    id: number;

    constructor(fullPath: string, raw: string, scope?: Scope) {
        super(fullPath, raw, scope);
        this.infer = this.newConnectedSubclass(Inferrer);
        this.cast = this.newConnectedSubclass(Caster);
        this.id = Generator.nextID++;
    }

    indent(code: string): string {
        return code.split('\n').map(x => '    ' + x).join('\n');
    }

    string(value: string): string {
        // @ts-ignore
        return '"' + value.replaceAll('"', '\\"').replaceAll('\n', '\\n') + '"';
    }

    type(type: Type, name?: string, decl: boolean = false): string {
        if (type.type === 'object' && type.call) {
            return this.type(type.call.returnType) + ' ' + (decl ? (name ?? '') : '(*' + (name ?? '') + ')') + '(object* this, ' + type.call.params.map(param => this.type(param[1], param[0])).join(', ') + ')';
        } else {
            let out = TYPES[type.type];
            if (name) {
                out += ' ' + name;
            }
            return out;
        }
    }

    identifier(name: string, isFunction: boolean = false): string {
        if (this.globalVarExists(name) && !this.globalIsShadowed(name)) {
            return 'js_global' + (isFunction ? 'function' : '') + '_' + name;
        } else {
            return 'js_' + (isFunction ? 'function' : 'variable') + '_' + this.id + '_' + name;
        }
    }

    getDeclarations(): string {
        let out: string[] = [];
        for (let [key, type] of this.scope.vars) {
            out.push(this.type(type, this.identifier(key, Boolean(type.type === 'object' && type.call)), true) + ';\n');
        }
        return out.join(';\n');
    }

    function(node: b.Function): string {
        let name = 'id' in node && node.id ? 'js_function_' + this.id + '_' + node.id.name : 'js_anon_' + Generator.nextAnon++;
        let type = this.infer.function(node.params, node.returnType).call;
        if (!type) {
            this.error('InternalError', 'Not a function');
        }
        let out = this.type(type.returnType) + ' ' + name + '(object* this' + (node.params.length > 0 ? ', ' + node.params.map((param, index) => {
            if (param.type !== 'Identifier') {
                this.error('InternalError', `Complicated lvalue encountered in Generator.function() of type ${node.type}`)
            } else {
                return this.type(type.params[index][1], 'js_variable_' + this.id + '_' + param.name);
            }
        }).join(', ') : '') + ') ';
        this.pushScope();
        for (let [name, paramType] of type.params) {
            this.scope.set(name, paramType);
        }
        if (node.body.type === 'BlockStatement') {
            out += this.statement(node.body);
        } else {
            out += '{\n    return ' + this.expression(node.body) + ';\n}';
        }
        if ('id' in node && node.id) {
            this.topLevel += 'js_variable_' + this.id + '_' + node.id.name + ' = ' + 'create_object(NULL, 1, "prototype", create_object(0));\n';
        }
        this.popScope();
        this.functions.push(out);
        return name;
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
        switch (node.type) {
            case 'Identifier':
                return this.identifier(node.name);
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
                let out = node.value.toString(10);
                if (!out.includes('.')) {
                    out += '.0';
                }
                return out;
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
                        if (!elt) {
                            return 'NULL';
                        }
                        if (elt.type === 'SpreadElement') {
                            this.error('SyntaxError', 'Spread elements are not supported');
                        } else {
                            return this.expression(elt);
                        }
                    }).join(', ') + ')';
                }
            case 'ObjectExpression':
                if (node.properties.length === 0) {
                    return 'create_object(NULL, 0)';
                } else {
                    return 'create_object(NULL, ' + node.properties.length + ', ' + node.properties.map(prop => {
                        if (prop.type === 'SpreadElement') {
                            this.error('SyntaxError', 'Spread elements are not supported');
                        } else {
                            let key = prop.key.type === 'Identifier' ? this.string(prop.key.name) : this.expression(prop.key);
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
                return this.cast.unary(node.operator, this.expression(node.argument), this.infer.expression(node.argument).type);
            case 'UpdateExpression':
                return (node.prefix ? '' : 'postfix_' + (node.operator === '++' ? 'inc' : 'dec')) + '(' + this.expression(node.argument) + ')';
            case 'BinaryExpression':
                return this.cast.binary(node.operator, this.expression(node.left), this.infer.expression(node.left).type, this.expression(node.right), this.infer.expression(node.right).type);
            case 'LogicalExpression':
                return this.expression(node.left) + ' ' + node.operator + ' ' + this.expression(node.right);
            case 'AssignmentExpression':
                return this.assignment(node.left, this.expression(node.right));
            case 'MemberExpression':
            case 'OptionalMemberExpression':
                let prop = node.property.type === 'Identifier' ? this.string(node.property.name) : this.expression(node.property);
                func = node.type === 'MemberExpression' ? 'get' : 'optional_get';
                return `${func}(${this.expression(node.object)}, to_property_key(${prop}))`;
            case 'BindExpression':
                this.error('SyntaxError', 'Bind expressions are not supported');
            case 'ConditionalExpression':
                return 'ternary(' + this.expression(node.test) + ', ' + this.expression(node.consequent) + ',' + this.expression(node.alternate) + ')';
            case 'CallExpression':
            case 'OptionalCallExpression':
            case 'NewExpression':
                let args = node.arguments.map(arg => {
                    if (arg.type === 'SpreadElement') {
                        this.error('SyntaxError', 'Spread elements are not supported');
                    } else {
                        return this.expression(arg as b.Expression);
                    }
                });
                if (node.callee.type === 'Identifier') {
                    func = this.expression(node.callee);
                    if (func.startsWith('js_variable')) {
                        func = 'js_function' + func.slice(11);
                    } else if (func.startsWith('js_global')) {
                        func = 'js_globalfunction' + func.slice(9);
                    }
                } else {
                    func = this.expression(node.callee);
                }
                let type = this.infer.expression(node.callee);
                if ('call' in type && typeof type.call !== 'function') {
                    let call = type.call;
                    if (call) {
                        args = args.map((arg, i) => {
                            if (this.type(call.params[i][1]) === 'any*') {
                                return 'create_any(' + arg + ')';
                            } else {
                                return arg;
                            }
                        });
                    }
                }
                if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
                    if (node.callee.type === 'MemberExpression') {
                        let macro = node.type === 'OptionalCallExpression' ? 'optional_call_method' : 'call_method';
                        return macro + '(' + this.expression(node.callee.object) + ', ' + (node.callee.property.type === 'Identifier' ? this.string(node.callee.property.name) : this.expression(node.callee.property)) + ', ' + args.join(', ') + ')';
                    } else if (node.type === 'OptionalCallExpression') {
                        return 'optional_call(' + func + ', NULL, ' + args.join(', ') + ')';
                    } else {
                        return func + '(NULL, ' + args.join(', ') + ')';
                    }
                } else {
                    let proto = node.callee.type === 'Identifier' ? 'js_variable_' + this.id + '_' + node.callee.name : this.expression(node.callee);
                    return 'new(' + func + ', get(' + proto + ', "prototype"), ' + args + ')';
                }
            case 'SequenceExpression':
                return node.expressions.map(x => this.expression(x)).join(', ');
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
                out = '{\n' + this.indent((this.getDeclarations() + node.body.map(x => this.statement(x))).slice(0, -1)) + '\n}\n';
                this.popScope();
                return out;
            case 'EmptyStatement':
            case 'DebuggerStatement':
                return ';\n';
            case 'WithStatement':
                this.error('SyntaxError', 'The with statement is not supported');
            case 'ReturnStatement':
                if (node.argument) {
                    return 'return ' + this.expression(node.argument) + ';\n';
                } else {
                    return 'return;\n';
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
                    out += this.indent(case_.consequent.map(x => this.statement(x)).join('\n')) + '\n';
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
                out += ') ' + this.statement(node.body);
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
        this.topLevel = 'init(argc, argv);\n';
        this.infer.program(node);
        for (let statement of node.body) {
            this.topLevel += this.statement(statement);
        }
        let out = '\n#include "builtins/index.h"\n\n';
        if (this.importIncludes.length > 0) {
            out += this.importIncludes.join('\n') + '\n\n';
        } else {
            out += '\n';
        }
        let decls = this.getDeclarations();
        if (decls.length > 0) {
            out += decls + '\n\n';
        }
        if (this.functions.length > 0) {
            out += this.functions.join('\n\n') + '\n\n';
        }
        out += 'int main(int argc, char** argv) {\n' + this.indent(this.topLevel.slice(0, -1)) + '\n}\n';
        return out;
    }

}
