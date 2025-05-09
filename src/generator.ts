
import type * as b from '@babel/types';
import * as t from './types';
import {Type} from './types';
import {Inferrer} from './inferrer';
import {Caster} from './caster';
import {Stack, Scope, ASTManipulator} from './util';


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

    id: number;

    infer: Inferrer;
    cast: Caster;
    importIncludes: string[] = [];
    functions: string[] = [];
    topLevel: string = '';
    thisArgs: Stack<string>;
    thisTypes: Stack<Type>;

    constructor(fullPath: string, raw: string, scope?: Scope) {
        super(fullPath, raw, scope);
        this.infer = this.newConnectedSubclass(Inferrer);
        this.cast = this.newConnectedSubclass(Caster);
        this.id = Generator.nextID++;
        this.thisArgs = this.createStack();
        this.thisTypes = this.createStack();
    }

    indent(code: string): string {
        return code.split('\n').map(x => '    ' + x).join('\n');
    }

    string(value: string): string {
        // @ts-ignore
        return '"' + value.replaceAll('"', '\\"').replaceAll('\n', '\\n') + '"';
    }

    property(prop: b.Expression | b.PrivateName): [string, t.String | t.Symbol | t.Any] {
        if (prop.type === 'Identifier') {
            return [this.string(prop.name), t.string];
        }
        let type = this.infer.expression(prop);
        let out = this.expression(prop);
        switch (type.type) {
            case 'undefined':
            case 'null':
                return [`(${out}, "${type.type}")`, t.string];
            case 'boolean':
                return [`(${out} ? "true" : "false")`, t.string];
            case 'number':
                return [`number_to_string(${out}, 10)`, t.string];
            case 'string':
            case 'symbol':
                return [out, type];
            case 'object':
                return [`any_to_property_key(object_to_primitive(${out}))`, t.any];
            case 'array':
                return [`array_to_string(${out})`, t.string];
            default:
                return [`any_to_property_key(${out})`, t.any];
        }
    }

    type(type: Type, name?: string, decl: boolean = false): string {
        if (type.type === 'object' && type.call) {
            let out = this.type(type.call.returnType) + ' ';
            out += (decl ? (name ?? '') : '(*' + (name ?? '') + ')') + '(';
            if (!type.call.noThis) {
                out += 'object* this, ';
            }
            out += type.call.params.map(param => this.type(param[1], param[0])).join(', ') + ')';
            return out;
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
                let [prop, type] = this.property(node.property);
                let obj = this.expression(node.object);
                let objType = this.infer.expression(node.object);
                switch (objType.type) {
                    case 'object':
                        return `set_object_${type}(${obj}, ${prop})`;
                    case 'any':
                        return `set_any_${type}(${obj}, ${prop})`;
                    default:
                        this.error('TypeError', `Cannot set properties of ${type.type} (setting ${prop}`);                    
                }
            default:
                this.error('InternalError', `Complicated lvalue encountered in Generator.assignment() of type ${node.type}`)
        }
    }

    expression(node: b.Expression | b.PrivateName | b.V8IntrinsicIdentifier): string {
        this.setSourceData(node);
        let prop: string;
        let type: Type;
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
                            let [key, type] = this.property(prop.key);
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
                [prop, type] = this.property(node.property);
                let obj = this.expression(node.object);
                let objType = this.infer.expression(node.object);
                if (objType.type === 'undefined' || objType.type === 'null') {
                    if (node.type === 'OptionalMemberExpression') {
                        return `(${prop}, ${obj})`;
                    } else {
                        this.error('TypeError', `Cannot read properties of ${objType.type} (reading ${prop})`);
                    }
                } else if (objType.type === 'any' && node.type === 'OptionalMemberExpression') {
                    return `optional_get_any_${type.type}(${obj}, ${prop})`;
                } else if (objType.type === 'string' && prop === '"length"') {
                    return `strlen(${obj})`;
                } else if (objType.type === 'array' && prop === '"length"') {
                    return `(${obj}->length)`;
                } else {
                    let outType = this.infer.expression(node);
                    if (outType.type === 'object' && outType.call && outType.call.cName) {
                        return outType.call.cName;
                    } else {
                        return `get_${objType.type}_${type.type}(${obj}, ${prop})`;
                    }
                }
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
                let func: string;
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
                if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
                    let funcType = this.infer.expression(node.callee);
                    if (funcType.type === 'any') {
                        this.error('TypeError', 'Cannot call expression of type any, cast to a type first.');
                    } else if (node.type === 'OptionalCallExpression' && (funcType.type === 'undefined' || funcType.type === 'null')) {
                        return func;
                    } else if (funcType.type !== 'object') {
                        this.error('TypeError', `Value of type ${funcType.type} is not callable`);
                    } else if (funcType.call === null) {
                        this.error('TypeError', 'Is not callable');
                    }
                    let call = funcType.call;
                    let argsArray: string[] = [];
                    if (!call.noThis) {
                        if (node.callee.type === 'MemberExpression') {
                            this.thisArgs.push(this.expression(node.callee.object));
                            this.thisTypes.push(this.infer.expression(node.callee.object));
                        }
                        argsArray.push(this.thisArgs.value ?? 'NULL');
                    }
                    argsArray.push(...node.arguments.map((arg, i) => {
                        if (call.params[i] === undefined) {
                            return;
                        }
                        if (arg.type === 'SpreadElement') {
                            this.error('SyntaxError', 'Spread elements are not supported');
                        } else if (arg.type === 'ArgumentPlaceholder') {
                            this.error('InternalError', 'This error should not occur (ArgumentPlaceholder node found)');
                        }
                        let out = this.expression(arg);
                        let type = this.infer.expression(arg);
                        if (type.type === 'undefined' && call.params[i][2]) {
                            out = '(' + out + ', ' + this.expression(call.params[i][2]) + ')';
                        }
                        if (type.type === 'array' && call.thisIsAnyArray) {
                            if (Array.isArray(type.elts)) {
                                if (type.elts.length === 0) {
                                    out = 'create_array(0)';
                                } else {
                                    out = `create_array(${type.elts.length}, ${type.elts.map((type, i) => this.cast.toAny(`out->items[${i}]`, type.type)).join(', ')})`;
                                }
                            } else {
                                out = `cast_array_to_any_array(${out}, ${this.string(type.elts.type)})`;
                            }
                        }
                        return this.cast.to(out, type, call.params[i][1]);
                    }).filter(x => x !== undefined));
                    return '((' + this.type(funcType) + ')' + this.expression(node.callee) + ')(' + argsArray.join(', ') + ')';
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
                this.pushScope();
                out = 'for (';
                if (node.init) {
                    if (node.init.type === 'VariableDeclaration') {
                        out += this.statement(node.init).slice(0, -1) + ' ';
                        for (let decl of node.init.declarations) {
                            if (decl.id.type === 'Identifier') {
                                let type = decl.init ? this.infer.expression(decl.init) : this.infer.type(decl.id.typeAnnotation);
                                out = this.type(type) + ' ' + this.identifier(decl.id.name) + ';\n' + out;
                                this.setVar(decl.id.name, type);
                            }
                        }
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
                this.popScope();
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
