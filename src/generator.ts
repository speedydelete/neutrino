
import type * as b from '@babel/types';
import {t, Type, SimpleType, Stack, Scope, ASTManipulator} from './util.js';
import {Inferrer} from './inferrer.js';
import {UnionType, UnionFunc, UnionFuncCall, unionFuncCallsAreEqual, getCUnionFuncName} from './unions.js';
import type {Compiler} from './compiler.js';


export type CTypeName = UnionType | 'unknown';


export class Generator extends ASTManipulator {

    static nextAnon: number = 0;

    id: string;
    infer: Inferrer;
    importIncludes: string[] = [];
    functions: string[] = [];
    topLevel: string = '';
    thisArgs: Stack<string>;
    thisTypes: Stack<Type>;
    isGlobal: boolean = true;
    initScope: Scope;

    constructor(compiler: Compiler, id: string, fullPath: string, raw: string, scope?: Scope) {
        super(compiler, fullPath, raw, scope);
        this.id = id;
        this.infer = this.new(Inferrer);
        this.thisArgs = this.createStack();
        this.thisTypes = this.createStack([this.getVar('globalThis')]);
        this.initScope = this.scope;
    }

    indent(code: string): string {
        return code.split('\n').map(x => '    ' + x).join('\n');
    }

    string(value: string): string {
        // @ts-ignore
        return '"' + value.replaceAll('"', '\\"').replaceAll('\n', '\\n') + '"';
    }

    property(prop: b.Expression | b.PrivateName): [string, t.Type] {
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
                if (type.specialName === 'array') {
                    return [`array_to_string(${out})`, t.string];
                }
                return [`primitive_to_property_key(object_to_primitive(${out}))`, t.any];
            default:
                return [`any_to_property_key(${out})`, t.any];
        }
    }

    type(type: Type, name?: string, decl: boolean = false): string {
        let out: string;
        if (type.type === 'object') {
            if (type.call) {
                if (type.call.realVoid) {
                    out = 'void ';
                } else {
                    out = this.type(type.call.returnType) + ' ';
                }
                out += (decl ? (name ?? '') : '(*' + (name ?? '') + ')') + '(';
                if (!type.call.noThis) {
                    out += 'object* this';
                    if (type.call.params.length > 0) {
                        out += ', ';
                    }
                }
                if (type.call.params.length > 0) {
                    out += type.call.params.map(param => this.type(param[1], param[0])).join(', ');
                }
                out += ')';
                if (decl) {
                    out += ';';
                }
                return out;
            } else if (type.specialName) {
                if (type.specialName === 'function' || type.specialName === 'symbolFunction') {
                    this.error('InternalError', 'Non-callable function type');
                } else {
                    out = type.specialName + '*';
                }
            } else {
                out = 'object*';
            }
        } else if (type.type === 'any' || type.type === 'unknown' || type.type === 'never') {
            out = 'unknown*';
        } else if (type.type === 'undefined' || type.type === 'null' || type.type === 'void') {
            out = 'void*';
        } else if (type.type === 'boolean' || type.type === 'boolean_value') {
            out = 'bool';
        } else if (type.type === 'number' || type.type === 'number_value') {
            out = 'double';
        } else if (type.type === 'string' || type.type === 'string_value') {
            out = 'latin1' in type ? 'char*' : 'full_string*';
        } else if (type.type === 'symbol' || type.type === 'unique_symbol') {
            out = 'symbol';
        } else if (type.type === 'bigint' || type.type === 'bigint_value') {
            out = 'bigint';
        } else {
            this.error('InternalError', `Invalid type in Generator.type of type ${type.type}`);
        }
        if (name) {
            out += ' ' + name;
        }
        if (decl) {
            out = 'extern ' + out + ';';
        }
        return out;
    }

    identifier(name: string, isFunction: boolean = false): string {
        if (this.globalVarExists(name) && !this.globalIsShadowed(name)) {
            return 'js_global' + (isFunction ? 'function' : '') + '_' + name;
        } else {
            return 'js_' + (isFunction ? 'function' : 'variable') + '_' + this.id + '_' + name;
        }
    }

    getDeclarations(header: boolean = false): string {
        let out: string[] = [];
        for (let [key, type] of this.scope.vars) {
            if (!this.scope.imports.has(key)) {
                if (type.type === 'object' && type.call) {
                    if (header) {
                        out.push(this.type(type, this.identifier(key, true), true) + '\n');
                    }
                    out.push(`${header ? 'extern ' : ''}object* js_variable_${this.id}_${key};\n`);
                } else {
                    out.push(this.type(type, this.identifier(key), true) + '\n');
                }
            }
        }
        return out.join('');
    }

    function(node: b.Function): string {
        let name = 'id' in node && node.id ? 'js_function_' + this.id + '_' + node.id.name : 'js_anon_' + Generator.nextAnon++;
        let type = this.infer.function(node.params, node.typeParameters, node.returnType).call;
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
        let wasGlobal = this.isGlobal;
        this.isGlobal = false;
        this.pushScope();
        for (let [name, paramType] of type.params) {
            this.scope.set(name, paramType);
        }
        if (node.body.type === 'BlockStatement') {
            out += '{\n';
            node.body.body.forEach(x => this.infer.statement(x));
            out += this.indent((this.getDeclarations() + node.body.body.map(x => this.statement(x))).slice(0, -1));
            if (type.returnType.type === 'undefined') {
                out += '\n    return NULL;';
            } else if (type.returnType.type === 'any') {
                out += `\n    return create_any_from_undefined(NULL);`;
            }
            out += '\n}\n';
        } else {
            out += '{\n    return ' + this.expression(node.body) + ';\n}';
        }
        this.isGlobal = wasGlobal;
        if ('id' in node && node.id) {
            this.topLevel += 'js_variable_' + this.id + '_' + node.id.name + ' = ' + 'create_object(NULL, 1, "prototype", create_object(NULL, 0));\n';
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

    getCTypeName(type: t.NonUnionSimpleType): CTypeName {
        if (type.type === 'any') {
            return 'unknown';
        } else if (type.type === 'object' && type.specialName) {
            if (type.specialName === 'symbolFunction') {
                return 'function';
            } else {
                return type.specialName;
            }
        } else if (type.type === 'boolean_value') {
            return 'boolean';
        } else if (type.type === 'number_value') {
            return 'number';
        } else if (type.type === 'string_value') {
            return 'string';
        } else if (type.type === 'unique_symbol') {
            return 'symbol';
        } else if (type.type === 'bigint_value') {
            return 'bigint';
        } else {
            return type.type;
        }
    }

    getUnionFunc(func: UnionFunc, ...argTypes: SimpleType[]): string {
        let args = argTypes.map(type => type.type === 'union' ? new Set(type.types.map(type => this.getCTypeName(type))) : this.getCTypeName(type));
        for (let arg of args) {
            if (arg instanceof Set) {
                for (let type of arg) {
                    if (type === 'unknown') {
                        return func;
                    }
                }
            } else if (arg === 'unknown') {
                return func;
            }
        }
        let newCall: UnionFuncCall = {func, args: args as UnionFuncCall['args']};
        let cFunc = getCUnionFuncName(newCall);
        let found = false;
        for (let call of this.compiler.unionFuncCalls) {
            if (unionFuncCallsAreEqual(call, newCall)) {
                return cFunc;
            }
        }
        this.compiler.unionFuncCalls.push(newCall);
        return cFunc;
    }

    toAny(value: string, type: SimpleType): string {
        if (type.type === 'union') {
            return this.getUnionFunc('to_any', type) + '(' + value + ')';
        } else {
            return `create_unknown_from_${type.type.replace('_value', '').replace('unique_', '')}(${value})`;
        }
    }

    toBoolean(value: string, type: SimpleType): string {
        switch (type.type) {
            case 'undefined':
            case 'null':
                return `(${value}, false)`;
            case 'boolean':
            case 'number':
                return value;
            case 'string':
                return `(${value} == '\0')`;
            case 'any':
                return `any_to_boolean(${value})`;
            default:
                return `(${value}, true)`;
        }
    }
    
    toNumber(value: string, type: SimpleType): string {
        switch (type.type) {
            case 'undefined':
                return `(${value}, NaN)`;
            case 'null':
                return `(${value}, null)`;
            case 'boolean':
                return `((double)${value})`;
            case 'number':
                return value;
            case 'string':
                return `parse_number(${value})`;
            case 'symbol':
                this.error('TypeError',`Cannot convert symbol to number`);
            case 'object':
                if (type.specialName) {
                    switch (type.specialName) {
                        case 'array':
                            return `parse_number(array_to_string(${value}), 10)`;
                        case 'proxy':
                            return `any_to_number(proxy_to_primitive(${value}))`;
                        default:
                            this.error('InternalError', `Invalid special name: ${type.specialName}`);
                    }
                }
                return `any_to_number(object_to_primitive(${value}))`;
            default:
                return `any_to_number(${value})`;
        }
    }

    toString(value: string, type: SimpleType): string {
        switch (type.type) {
            case 'any':
                return `to_string(${value})`;
            case 'undefined':
                return `(${value}, "undefined")`;
            case 'null':
                return `(${value}, "null")`;
            case 'boolean':
                return `(${value} ? "true" : "false")`;
            case 'boolean_value':
                return type.value ? '"true"' : '"false"';
            case 'number':
                return `number_to_string(${value}, 10)`;
            case 'number_value':
                return `"${value}"`;
            case 'string':
            case 'string_value':
                return value;
            case 'symbol':
            case 'unique_symbol':
                this.error('TypeError', 'Cannot convert symbol to string');
            case 'bigint':
                return `bigint_to_string(${value}, 10)`;
            case 'bigint_value':
                return `(${value}, "${type.value}")`;
            case 'object':
                return `to_string(object_to_primitive(${value}))`;
            default:
                return this.getUnionFunc('to_string', type) + '(' + value + ')';
        }
    }

    to(newType: SimpleType, value: string, type: SimpleType): string {
        switch (newType.type) {
            case 'any':
                return this.toAny(value, type);
            case 'boolean':
            case 'boolean_value':
                return this.toBoolean(value, type);
            case 'number':
            case 'number_value':
                return this.toNumber(value, type);
            case 'string':
            case 'string_value':
                return this.toString(value, type);
            default:
                this.error('TypeError', `Cannot cast to type ${newType} from type ${type}. This may mean you passed an invalid argument to a function.`);
        }
    }

    toPrimitiveString(value: string, type: SimpleType): string {
        if (type.type === 'object') {
            return `object_to_primitive(${type})`;
        } else if (type.type === 'union') {
            return this.getUnionFunc('to_primitive', type) + '(' + value + ')';
        } else {
            return `create_primitive_union_from_${type.type.replace('_value', '').replace('unique_', '')}(${value})`;
        }
    }

    typeof(value: string, type: SimpleType): string {
        switch (type.type) {
            case 'null':
                return `(${value}, "object")`;
            case 'any':
                return `typeof(${value})`;
            case 'union':
                return this.getUnionFunc('typeof', type) + '(' + value + ')';
            default:
                return `(${value}, "${type}")`;
        }
    }

    eq(x: string, xType: SimpleType, y: string, yType: SimpleType): string {
        let xt = xType.type;
        let yt = yType.type;
        if (xt === 'union' || yt === 'union') {
            return this.getUnionFunc('eq', xType, yType) + '(' + x + ', ' + y + ')';
        } else if (xt === 'any' || yt === 'any') {
            return `eq(${this.toAny(x, xType)}, ${this.toAny(y, yType)})`;
        } else if (xt === 'undefined' || xt === 'null' || yt === 'undefined' || yt === 'null') {
            return `(${x}, ${y}, ${(xt === 'undefined' || xt === 'null') && (yt === 'undefined' || yt === 'null')})`;
        } else if (xt === 'symbol' || yt === 'symbol') {
            if (xt === 'symbol' && yt === 'symbol') {
                return `(${x} == ${y})`;
            } else {
                return `(${x}, ${y}, false)`;
            }
        } else if (xt === 'object' || yt === 'object') {
            if (xt === 'object' && yt === 'object') {
                return `(${x} == ${y})`;
            } else {
                return `eq_primitive(${this.toPrimitiveString(x, xType)}, ${this.toPrimitiveString(y, yType)})`;
            }
        } else if (xt === 'string' || yt === 'string') {
            return `(strcmp(${this.toString(x, xType)}, ${this.toString(y, yType)}) == 0)`;
        } else {
            return `(${x} == ${y})`;
        }
    }

    seq(x: string, xType: SimpleType, y: string, yType: SimpleType): string {
        let xt = xType.type;
        let yt = yType.type;
        if (xt === 'union' || yt === 'union') {
            return this.getUnionFunc('seq', xType, yType) + '(' + x + ', ' + y + ')';
        } else if (xt === 'any' || yt === 'any') {
            return `seq(${this.toAny(x, xType)}, ${this.toAny(y, yType)})`;
        } else if (xt !== yt) {
            return `(${x}, ${y}, false)`;
        } else if (xt === 'undefined' || xt === 'null') {
            return `(${x}, ${y}, true)`;
        } else if (xt === 'string') {
            return `(strcmp(${x}, ${y}) == 0)`;
        } else {
            return `(${x} == ${y})`
        }
    }

    expression(node: b.Expression | b.PrivateName | b.V8IntrinsicIdentifier | b.FunctionDeclaration | b.ClassDeclaration | b.TSDeclareFunction): string {
        this.setSourceData(node);
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
                return `create_bigint(${this.string(node.value)})`;
            case 'DecimalLiteral':
                this.error('SyntaxError', 'BigDecimals are not supported');
            case 'Super':
                this.error('SyntaxError', 'Super is not supported');
            case 'Import':
                this.error('SyntaxError', 'Dynamic import is not supported');
            case 'ThisExpression':
                if (this.isGlobal) {
                    return 'js_global_globalThis';
                } else {
                    return 'this';
                }
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
                    return 'create_object(object_prototype, 0)';
                } else {
                    return 'create_object(object_prototype, ' + node.properties.length + ', ' + node.properties.map(prop => {
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
            case 'FunctionDeclaration':
                return this.function(node);
            case 'UnaryExpression':
                let arg = this.expression(node.argument);
                let type = this.simplify(this.infer.expression(node.argument));
                switch (node.operator) {
                    case '!':
                        return '!' + this.toBoolean(arg, type);
                    case '+':
                    case '-':
                    case '~':
                        return node.operator + this.toNumber(arg, type);
                    case 'typeof':
                        return this.typeof(arg, type);
                    case 'void':
                        return `(${arg}, NULL)`;
                    case 'throw':
                        return 'throw(' + arg + ')';
                    default:
                        this.error('InternalError', `The delete operator is not supported`);
                }
            case 'UpdateExpression':
                return (node.prefix ? '' : 'postfix_' + (node.operator === '++' ? 'inc' : 'dec')) + '(' + this.expression(node.argument) + ')';
            case 'BinaryExpression':
                let left = this.expression(node.left);
                let leftType = this.simplify(this.infer.expression(node.left));
                let right = this.expression(node.right);
                let rightType = this.simplify(this.infer.expression(node.right));
                switch (node.operator) {
                        case '==':
                            return this.eq(left, leftType, right, rightType);
                        case '!=':
                            return '!' + this.eq(left, leftType, right, rightType);
                        case '===':
                            return this.seq(left, leftType, right, rightType)
                        case '!==':
                            return '!' + this.seq(left, leftType, right, rightType);
                        case '+':
                            let type = this.infer.expression(node);
                            if (type.type === 'string') {
                                return `stradd(${this.toString(left, leftType)}, ${this.toString(right, rightType)})`;
                            } else {
                                return this.toNumber(left, leftType) + ' + ' + this.toNumber(right, rightType);

                            }
                        case '<':
                        case '<=':
                        case '>':
                        case '>=':
                        case '-':
                        case '*':
                        case '/':
                            return this.toNumber(left, leftType) + ' ' + node.operator + ' ' + this.toNumber(right, rightType);
                        case '%':
                            return `fmod(${this.toNumber(left, leftType)}, ${this.toNumber(right, rightType)})`;
                        case '**':
                            return `pow(${this.toNumber(left, leftType)}, ${this.toNumber(right, rightType)})`;
                        case '&':
                        case '^':
                        case '|':
                        case '<<':
                        case '>>>':
                            return `(double)((uint32_t)${this.toNumber(left, leftType)} ${node.operator} (uint32_t)${this.toNumber(right, rightType)})`;
                        case '>>':
                            return `(double)((int32_t)${this.toNumber(left, leftType)} >>> (int32_t)${this.toNumber(right, rightType)})`;
                        case 'instanceof':
                            if (leftType.type === 'object' && rightType.type === 'object') {
                                return `instanceof(${leftType}, ${rightType})`;
                            } else {
                                this.error('TypeError', `Cannot use instanceof operator on values of types ${leftType} and ${rightType}`);
                            }
                        case 'in':

                        default:
                            this.error('SyntaxError', 'The pipeline operator is not supported');
                    }
            case 'LogicalExpression':
                return this.expression(node.left) + ' ' + node.operator + ' ' + this.expression(node.right);
            case 'AssignmentExpression':
                return this.assignment(node.left, this.expression(node.right));
            case 'MemberExpression':
            case 'OptionalMemberExpression':
                let [prop, complexType] = this.property(node.property);
                type = this.simplify(complexType);
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
                } else if (objType.type === 'object' && objType.specialName === 'array' && prop === '"length"') {
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
                    } else if (funcType.call === undefined) {
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
                        let type = this.simplify(this.infer.expression(arg));
                        if (type.type === 'undefined' && call.params[i][2]) {
                            out = '(' + out + ', ' + this.expression(call.params[i][2]) + ')';
                        }
                        if (type.type === 'object' && type.specialName === 'array' && call.thisIsAnyArray) {
                            if (type.indexes.length > 0) {
                                out = `cast_array_to_any_array(${out}, ${this.string(type.indexes[0].value.type)})`;
                            } else {
                                if (0 in type.props) {
                                    let length = 0;
                                    let props: string[] = [];
                                    for (let i = 0; i in type.props; i++) {
                                        length++;
                                        props.push(this.toAny(`out->items[${i}]`, type));
                                    }
                                    return `create_array(${length}, ${props.join(', ')})`;
                                } else {

                                }
                            }
                        }
                        return this.to(this.simplify(call.params[i][1]), out, type);
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

    getImportData(path: string): [string, string, Scope] {
        this.error('InternalError', 'This error should not occur');
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
            case 'ImportDeclaration':
                let [path, id, scope] = this.getImportData(node.source.value);
                this.importIncludes.push(`#include "${path}.c"`);
                for (let spec of node.specifiers) {
                    if (spec.type === 'ImportNamespaceSpecifier') {
                        this.error('SyntaxError', 'Namespace imports are not supported');
                    }
                    let name = this.identifier(spec.local.name);
                    if (spec.type === 'ImportDefaultSpecifier') {
                        this.importIncludes.push(`#define ${name} js_defaultexport_${id}`);
                    } else {
                        let export_ = scope.exports.get(this.infer.importSpecifier(spec.imported));
                        if (!export_) {
                            this.error('InternalError', 'Does not export');
                        }
                        let type = export_[0];
                        let fv = type.type === 'object' && type.call ? 'function' : 'variable';
                        this.importIncludes.push(`#define ${name} js_${fv}_${id}_${export_[1]}`);
                    }
                }
                return '';
            case 'ExportNamedDeclaration':
                if (node.declaration) {
                    return this.statement(node.declaration);
                } else {
                    return '';
                }
            case 'ExportDefaultDeclaration':
                this.topLevel += `js_defaultexport_${this.id} = ${this.expression(node.declaration)}`;
                return `${this.type(this.infer.expression(node.declaration))} js_defaultexport_${this.id}`;
            default:
                this.error('InternalError', `Bad/unrecongnized AST node in Generator.statement() of type ${node.type}`);
        }
    }

    program(node: b.Program): string {
        this.importIncludes = [];
        this.functions = [];
        this.infer.program(node);
        for (let statement of node.body) {
            let code = this.statement(statement);
            if (code !== '') {
                this.topLevel += code;
            }
        }
        // @ts-ignore
        let dir = import.meta.dirname;
        let out = '\n';
        if (this.importIncludes.length > 0) {
            out += this.importIncludes.join('\n') + '\n\n';
        }
        let decls = this.getDeclarations();
        if (decls.length > 0) {
            out += decls + '\n\n';
        }
        if (this.functions.length > 0) {
            out += this.functions.join('\n\n') + '\n\n';
        }
        out += `void main_${this.id}() {\n${this.indent(this.topLevel.slice(0, -1))}\n}\n`;
        return out;
    }

}
