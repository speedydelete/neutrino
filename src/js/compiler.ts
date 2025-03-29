
import type * as bt from '@babel/types';
import * as parser from '@babel/parser';
import * as t from './types';
import {Type} from './types';
import * as fs from 'node:fs';


const TEMPLATE_CODE = fs.readFileSync('template.c').toString();

const BUILTIN_CODE = fs.readFileSync('builtins/index.ts').toString();
const BUILTIN_OPTIONS = {
    filename: 'builtins/index.ts',
    typescript: true,
};


class CompilerError extends Error {

    [Symbol.toStringTag]: 'CompilerError';

    compiler: Compiler;
    type: string;

    file: string;
    line: number;
    col: number;
    endCol: number;
    rawLine: string;

    constructor(compiler: Compiler, type: string, message: string, node: bt.Node) {
        super(message);
        this.compiler = compiler;
        this.type = type;
        if (!node.loc) {
            throw new Error('There is a bug in Neutrino (node.loc is undefined)');
        }
        this.file = node.loc.filename;
        this.line = node.loc.start.line;
        this.col = node.loc.start.column;
        this.rawLine = this.compiler.code.split('\n')[this.line - 1];
        if (node.loc.end.line !== this.line) {
            this.endCol = this.rawLine.length;
        } else {
            this.endCol = node.loc.end.column;
        }
    }

    toString() {
        let out = `${this.type}: ${this.message} (at ${this.file}${this.line}:${this.col})`;
        out += '    ' + this.rawLine + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.endCol - this.col) + ' (here)';
    }

}


class VariableMap {

    compiler: Compiler;

    data: Map<string, Type> = new Map();
    typeData: Map<string, Type> = new Map();
    parent: VariableMap | null;

    constructor(compiler: Compiler, parent: VariableMap | null = null) {
        this.compiler = compiler;
        this.parent = parent;
    }

    get(name: string): Type {
        let value = this.data.get(name);
        if (value !== undefined) {
            return value;
        } else if (this.parent !== null) {
            return this.parent.get(name);
        } else {
            this.compiler.error('ReferenceError', `${name} is not defined`);
        }
    }

    set(name: string, type: Type) {
        this.data.set(name, type);
    }

    getType(name: string): Type {
        let value = this.data.get(name);
        if (value !== undefined) {
            return value;
        } else if (this.parent !== null) {
            return this.parent.getType(name);
        } else {
            this.compiler.error('ReferenceError', `${name} is not defined`);
        }
    }

    setType(name: string, type: Type) {
        this.typeData.set(name, type);
    }

}


export interface CompilerOptions {
    filename?: string;
    typescript?: boolean;
    jsx?: boolean;
    async?: boolean;
    includeBuiltins?: boolean;
}

export class Compiler {

    code: string;
    ast: bt.Program;
    options: CompilerOptions;

    vars: VariableMap;
    currentNode: bt.Node;
    thisType: Type = t.undefined;

    topLevel: string[];
    topLevelVars: string[];
    funcs: string[];

    constructor(code: string, options: CompilerOptions = {}) {
        this.code = code;
        this.options = options;
        this.ast = this.parse(code);
        this.vars = new VariableMap(this);
        this.currentNode = this.ast;
        if (options.includeBuiltins ?? true) {
            for (let node of this.parse(BUILTIN_CODE, BUILTIN_OPTIONS).body) {
                this.compileStatement(node);
            }
        }
    }

    error(type: string, message: string): never {
        throw new CompilerError(this, type, message, this.currentNode);
    }

    parse(code: string, options?: CompilerOptions): bt.Program {
        options ??= this.options;
        let plugins: parser.ParserPlugin[] = [];
        if (options.typescript) {
            plugins.push('typescript');
        }
        if (options.jsx) {
            plugins.push('jsx');
        }
        if (options.async) {
            plugins.push('topLevelAwait');
        }
        return parser.parse(code, {
            createImportExpressions: true,
            createParenthesizedExpressions: true,
            sourceType: 'module',
            sourceFilename: options.filename ?? '<anonymous>',
            plugins,
        }).program;
    }

    pushScope(): void {
        this.vars = new VariableMap(this, this.vars);
    }

    popScope(): void {
        if (this.vars.parent === null) {
            throw new TypeError('this error should not occur');
        }
        this.vars = this.vars.parent;
    }

    compileString(string: string): string {
        let out = '';
        for (let char of string) {
            let code = char.charCodeAt(0);
            if (code >= 0x20 && code < 0x7F) {
                out += char;
            } else if (char === '\n') {
                out += '\\n';
            } else if (code < 0xFFFF) {
                out += '\\u' + code.toString(16).padStart(4, '0');
            } else {
                out += '\\U' + code.toString(16).padStart(8, '0');
            }
        }
        return '"' + out + '"';
    }

    static readonly TYPE_TAGS = {
        undefined: 1,
        null: 2,
        boolean: 3,
        number: 4,
        string: 5,
        symbol: 6,
        bigint: 7,
        object: 8,
        function: 9,
    }

    static readonly INVERSE_TYPE_TAGS = {
        1: 'undefined',
        2: 'null',
        3: 'boolean',
        4: 'number',
        5: 'string',
        6: 'symbol',
        7: 'bigint',
        8: 'object',
        9: 'function',
    }

    getTypeTags(types: Type[]): string {
        let out = 0;
        for (let type of types) {
            out <<= 4;
            if (type.type in Compiler.TYPE_TAGS) {
                out += Compiler.TYPE_TAGS[type.type];
            } else {
                throw new Error(`Unable to get a type tag for ${type}`);
            }
        }
        return out + 'UL';
    }

    getSingleTag(type: Type): string {
        if (type instanceof t.union) {
            if (type.tagIndex === -1) {
                this.error('TypeError', 'Cannot perform operations on unions whose type is unknown at runtime, use type casting.');
            } else {
                return `get_type_tag((tags >> ${type.tagIndex * 4}) & 0xf)`;
            }
        } else if (type.type in Compiler.TYPE_TAGS) {
            return String(Compiler.TYPE_TAGS[type.type]);
        } else {
            throw new Error(`Unable to get a type tag for ${type}`);
        }
    }

    compilePrimitivePropertyAccess(value: string, type: Type, prop: string): [string, Type] {
        if (type.extends(t.undefined) || type.extends(t.null)) {
            this.error('TypeError', `Cannot read properties of ${type.type} (reading '${prop}')`);            
        } else if (type.extends(t.string)) {
            if (prop === 'length') {
                return [`strlen(${value})`, t.string];
            }
        }
        return ['NULL', t.undefined];
    }

    compilePrimitiveMethodCall(value: string, type: Type, method: string, args: [string, Type][]): [string, Type] {
        if (type.extends(t.undefined) || type.extends(t.null)) {
            this.error('TypeError', `Cannot read properties of ${type.type} (reading '${method}')`);
        } else if (type.extends(t.number)) {
            if (method === 'toString') {
                return [`Number_toString(${value})`, t.string];
            } else if (method === 'valueOf') {
                return [value, t.number];
            }
        }
        this.error('TypeError', 'undefined is not a function');
    }

    compileExpression(node: bt.Expression | bt.PrivateName | bt.V8IntrinsicIdentifier): [string, Type] {
        this.currentNode = node;
        if (node.type === 'Identifier') {
            return ['v' + node.name, this.vars.get(node.name)];
        } else if (node.type === 'PrivateName') {
            return ['p' + node.id.name, t.unknown];
        } else if (node.type === 'RegExpLiteral') {
            this.error('SyntaxError', 'RegExps are not supported');
        } else if (node.type === 'NullLiteral') {
            return ['NULL', t.null];
        } else if (node.type === 'StringLiteral') {
            return [this.compileString(node.value), new t.string(node.value)];
        } else if (node.type === 'BooleanLiteral') {
            return [node.value ? 'true' : 'false', new t.boolean(node.value)];
        } else if (node.type === 'NumericLiteral') {
            let value = node.value.toString();
            if (!value.includes('.')) {
                value += '.0';
            }
            return [value, new t.number(node.value)];
        } else if (node.type === 'BigIntLiteral') {
            this.error('SyntaxError', 'BigInts are not supported');
        } else if (node.type === 'DecimalLiteral') {
            this.error('SyntaxError', 'Decimals are not supported');
        } else if (node.type === 'Import') {
            this.error('SyntaxError', 'Modules are not supported');
        } else if (node.type === 'Super') {
            this.error('SyntaxError', 'super() is not supported');
        } else if (node.type === 'ThisExpression') {
            return ['this', this.thisType];
        } else if (node.type === 'ArrowFunctionExpression') {
            this.error('SyntaxError', 'Arrow functions are not supported');
        } else if (node.type === 'YieldExpression') {
            this.error('SyntaxError', 'Generators are not supported');
        } else if (node.type === 'AwaitExpression') {
            this.error('SyntaxError', 'Asynchronous functions are not supported');
        } else if (node.type === 'ArrayExpression') {
            let elts: string[] = [];
            let types: Type[] = [];
            for (let elt of node.elements) {
                if (elt === null) {
                    elts.push('NULL');
                    types.push(t.undefined);
                } else {
                    this.currentNode = elt;
                    if (elt.type === 'SpreadElement') {
                        this.error('SyntaxError', 'Spread elements are not supported');
                    } else {
                        let [code, type] = this.compileExpression(elt);
                        elts.push(code);
                        types.push(type);
                    }
                }
            }
            this.currentNode = node;
            if (elts.length === 0) {
                return ['create_array("")', (this.vars.get('Array') as t.generic).resolve(t.any)];
            } else {
                return [
                    `create_array(${this.getTypeTags(types)}, ${elts.join(', ')})`,
                    (this.vars.get('Array') as t.generic).resolve(new t.union(...types))
                ];
            }
        } else if (node.type === 'ObjectExpression') {
            let data: string[] = [];
            let props: {[key: PropertyKey]: Type} = {};
            let types: Type[] = [];
            for (let prop of node.properties) {
                this.currentNode = prop;
                types.push(t.string);
                if (prop.type === 'ObjectProperty') {
                    if (prop.key.type === 'PrivateName') {
                        this.error('SyntaxError', 'Private properties are not supported');
                    } else {
                        if (prop.key.type === 'Identifier') {
                            data.push(prop.key.name);
                        } else {
                            data.push(this.compileExpression(prop.key)[0]);
                        }
                        if (prop.value.type === 'ArrayPattern' || prop.value.type === 'AssignmentPattern' || prop.value.type === 'ObjectPattern' || prop.value.type === 'RestElement') {
                            this.error('SyntaxError', 'Patterns in object literals are not supported');
                        } else {
                            let [value, type] = this.compileExpression(prop.value);
                            data.push(value);
                            types.push(type);
                            if (prop.key.type === 'Identifier') {
                                props[prop.key.name] = type;
                            }
                        }
                    }
                } else if (prop.type === 'ObjectMethod') {
                    this.error('SyntaxError', 'Methods are not supported');
                } else {
                    this.error('SyntaxError', 'Spread elements are not supported');
                }
            }
            this.currentNode = node;
            if (data.length === 0) {
                return ['create_object()', new t.object()];
            } else {
                return [`create_object(${this.getTypeTags(types)}, ${data.join(', ')})`, new t.object(props)];
            }
        } else if (node.type === 'RecordExpression') {
            this.error('SyntaxError', 'Records are not supported');
        } else if (node.type === 'TupleExpression') {
            this.error('SyntaxError', 'Tuples are not supported');
        } else if (node.type === 'FunctionExpression') {
            this.error('SyntaxError', 'Anonymous functions are not supported');
        } else if (node.type === 'UnaryExpression') {
            let [expr, type] = this.compileExpression(node.argument);
            if (node.prefix) {
                if (node.operator === 'typeof') {
                    if (type instanceof t.union) {
                        return [`typeof_from_tag(argument_types[${type.tagIndex}]))`, t.string];
                    } else if (type.type === 'undefined') {
                        return ['"undefined"', new t.string('undefined')];
                    } else if (type.type === 'object' || type.type === 'null') {
                        return ['"object"', new t.string('undefined')];
                    } else if ('aeiou'.includes(type.type[0])) {
                        this.error('TypeError', `Cannot use typeof on a value that has an ${type.type} type`);
                    } else {
                        this.error('TypeError', `Cannot use typeof on a value that has a ${type.type} type`);
                    }
                } else if (node.operator === 'void') {
                    return [`((void)${expr}, NULL)`, t.undefined];
                } else if (node.operator === 'delete') {
                    this.error('SyntaxError', 'The delete operator is not supported');
                } else if (node.operator === 'throw') {
                    this.error('SyntaxError', 'Exceptions are not supported');
                } else {
                    let outType: Type;
                    if (node.operator === '!') {
                        outType = t.boolean;
                    } else if (type.type === 'bigint') {
                        outType = t.bigint;
                    } else {
                        outType = t.number;
                    }
                    return [node.operator + expr, outType];
                }
            } else {
                if (node.operator === '!') {
                    return [`(${expr} != NULL)`, t.boolean];
                } else {
                    this.error('SyntaxError', `The postfix unary operator ${node.operator} is not supported.`);
                }
            }
        } else if (node.type === 'UpdateExpression') {
            let [expr, type] = this.compileExpression(node.argument);
            if (node.prefix) {
                expr = node.operator + expr;
            } else {
                expr += node.operator;
            }
            return [expr, type.type === 'bigint' ? t.bigint : t.number];
        } else if (node.type === 'BinaryExpression') {
            let [left, leftType] = this.compileExpression(node.left as bt.Expression);
            let [right, rightType] = this.compileExpression(node.right);
            if (node.operator === '==' || node.operator === '!=' || node.operator === '===' || node.operator === '!==') {
                let code: string;
                let isStrict = node.operator.length === 3;
                if (leftType instanceof t.union || rightType instanceof t.union) {
                    code = `${isStrict ? 'strict_' : ''}equal(tags, ${left}, ${this.getSingleTag(leftType)}, ${right}, ${this.getSingleTag(rightType)})`;
                } else if (leftType.type === rightType.type) {
                    if (leftType.type === 'boolean' || leftType.type === 'number' || leftType.type === 'object') {
                        code = `${left} == ${right}`;
                    } else if (leftType.type === 'string') {
                        code = `strcmp(${left}, ${right}) != 0`;
                    } else if (leftType.type === 'undefined' || leftType.type === 'null') {
                        code = 'true';
                    } else {
                        this.error('TypeError', `Unsupported operand type for equality: ${leftType.type}`);
                    }
                } else if (isStrict) {
                    code = 'false';
                } else if (leftType.extends(t.null) || leftType.extends(t.undefined) || rightType.extends(t.null) || rightType.extends(t.undefined)) {
                    code = `${left} == ${right}`;
                } else {
                    if (leftType.extends(t.object) || rightType.extends(t.object)) {
                        code = `equal(${left}, ${this.getSingleTag(leftType)}, ${right}, ${this.getSingleTag(rightType)})`;
                    } else if (leftType.extends(t.string)) {
                        code = `vNumber(5, ${left}) == ${right}`;
                    } else if (rightType.extends(t.string)) {
                        code = `${left} == vNumber(${right})`;
                    } else {
                        this.error('TypeError', `Unsupported types: ${leftType.type} and/or ${rightType.type}`);
                    }
                }
                if (node.operator === '!=') {
                    if (code.includes('==')) {
                        // @ts-ignore
                        code = code.replaceAll('==', '!=');
                    } else if (code.includes('!=')) {
                        // @ts-ignore
                        code = code.replaceAll('!=', '==');
                    } else {
                        code = '!(' + code + ')';
                    }
                }
                return [code, t.boolean];
            } else if (node.operator === 'instanceof') {
                if (!leftType.extends(t.object) || !rightType.extends(t.object)) {
                    return ['false', new t.boolean(false)];
                } else {
                   return [`instanceof(${left}, ${this.getSingleTag(leftType)}, ${right}, ${this.getSingleTag(rightType)})`, t.boolean];
                }
            } else if (node.operator === 'in') {
                if (!leftType.extends(t.object) || !rightType.extends(t.object)) {
                    return ['false', new t.boolean(false)];
                } else {
                   return [`has_key(${left}, ${this.getSingleTag(leftType)}, ${right}, ${this.getSingleTag(rightType)})`, t.boolean];
                }
            } else if (node.operator === '|>') {
                this.error('SyntaxError', 'The pipe operator is not supported');
            } else {
                if (!(leftType.type === 'number')) {
                    left = `Number(${this.getSingleTag(leftType)}, ${right})`;
                }
                if (!(rightType.type === 'number')) {
                    left = `Number(${this.getSingleTag(leftType)}, ${right})`;
                }
                if (node.operator === '>>' || node.operator === '<<') {
                    return [`(double)((long)${left} ${node.operator} (long)${right})`, t.number];
                } else if (node.operator === '>>>') {
                    return [`(double)((unsigned long)${left} >> ${right})`, t.number];
                } else {
                    return [`${left} ${node.operator} ${right}`, t.number]
                }
            }
        } else if (node.type === 'AssignmentExpression') {
            let [right, rightType] = this.compileExpression(node.right);
            // todo: make this work
            // @ts-ignore
            return [`${this.compileLval(node.left)[0]} ${node.operator} ${right}`, rightType];
        } else if (node.type === 'LogicalExpression') {
            let [left, leftType] = this.compileExpression(node.left);
            let [right, rightType] = this.compileExpression(node.right);
            return [`${left} ${node.operator} ${right}`, new t.union(leftType, rightType)];
        } else if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
            let [object, objectType] = this.compileExpression(node.object);
            if (node.type === 'OptionalMemberExpression' && (objectType.extends(t.undefined) || objectType.extends(t.null))) {
                return ['NULL', t.null];
            }
            if (!objectType.extends(t.object)) {
                if (node.property.type !== 'Identifier') {
                    this.error('TypeError', 'Property accesses of primitives cannot be computed');
                } else {
                    return this.compilePrimitivePropertyAccess(object, objectType, node.property.name);
                }
            }
            let out: string;
            let type: Type;
            if (node.property.type === 'Identifier') {
                out = `get_key(${object}, ${this.compileString(node.property.name)})`
                type = (objectType as t.object).props[node.property.name];
            } else {
                let [prop, propType] = this.compileExpression(node.property)[0];
                out = `get_key(${object}, ${prop})`
                type = t.unknown;
            }
            if (node.optional) {
                return [`(${object} == NULL ? NULL : ${out})`, new t.union(type, t.undefined)];
            } else {
                return [out, type];
            }
        } else if (node.type === 'BindExpression') {
            this.error('SyntaxError', 'Bind expressions are not supported');
        } else if (node.type === 'ConditionalExpression') {
            let [a, aType] = this.compileExpression(node.consequent);
            let [b, bType] = this.compileExpression(node.consequent);
            return [`${this.compileExpression(node.test)} ? ${a} : ${b}`, new t.union(aType, bType)];
        } else if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
            let args = node.arguments.map(arg => this.compileExpression(arg as bt.Expression));
            if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier' && !this.compileExpression(node.callee.object)[1].extends(t.object)) {
                let [value, type] = this.compileExpression(node.callee.object);
                return this.compilePrimitiveMethodCall(value, type, node.callee.property.name, args);
            }
            let [callee, calleeType] = this.compileExpression(node.callee);
            if (calleeType instanceof t.object && calleeType.returnType !== null) {
                let out = callee + '(' + this.getTypeTags(args.map(arg => arg[1])) + args.map(arg => arg[0]).join(', ') + ')';
                if (node.optional) {
                    return [`(${callee} == NULL ? NULL : ${out})`, new t.union(calleeType.returnType, t.undefined)];
                } else {
                    return [out, calleeType.returnType];
                }
            } else {
                this.error('TypeError', `Object of type ${calleeType.type} is not callable`);
            }
        } else if (node.type === 'SequenceExpression') {
            let exprs = node.expressions.map(this.compileExpression);
            return [exprs.map(expr => expr[0]).join(', '), exprs[exprs.length - 1][1]];
        } else if (node.type === 'ParenthesizedExpression') {
            let expr = this.compileExpression(node.expression);
            return ['(' + expr[0] + ')', expr[1]];
        } else if (node.type === 'DoExpression') {
            this.error('SyntaxError', 'Do statements are not supported');
        } else if (node.type === 'ModuleExpression') {
            this.error('SyntaxError', 'Module expressions are not supported');
        } else if (node.type === 'TopicReference') {
            this.error('SyntaxError', 'Hack-style pipes are not supported');
        } else if (node.type === 'TemplateLiteral') {
            let out: string[] = [];
            for (let i = 0; i < node.quasis.length; i++) {
                out.push(node.quasis[i / 2].value.raw);
                if (i !== node.quasis.length - 1) {
                    out.push(`String(${this.compileExpression(node.expressions[i / 2 - 1] as bt.Expression)[0]})`);
                }
            }
            return [`default_template_tag(${out.length}, ${out.join(', ')})`, t.string];
        } else if (node.type === 'TaggedTemplateExpression') {
            let out: string[] = [];
            let {quasi, tag} = node;
            for (let i = 0; i < quasi.quasis.length; i++) {
                out.push(quasi.quasis[i].value.raw);
                if (i !== quasi.quasis.length - 1) {
                    out.push(this.compileExpression(quasi)[0]);
                }
            }
            if (tag.type === 'MemberExpression' && tag.object.type === 'Identifier' && tag.object.name === 'neutrino' && tag.property.type === 'Identifier' && tag.property.name === 'c') {
                return [out.join(''), t.any];
            } else {
                let [tagCode, tagType] = this.compileExpression(tag);
                if (!(tagType instanceof t.object) || tagType.returnType === null) {
                    this.error('TypeError', 'Is not callable');
                }
                return [tagCode + '(' + out.join(', ') + ')', tagType.returnType];
            }
        } else {
            throw new Error(`Unrecognized AST node type in compileExpression: ${node.type}`);
        }
    }

    compileStatement(node: bt.Statement): string {
        this.currentNode = node;
        if (node.type === 'ExpressionStatement') {
            return this.compileExpression(node.expression)[0];
        } else if (node.type === 'BlockStatement') {
            this.pushScope();
            let out = '';
            for (let statement of node.body) {
                out += this.compileStatement(statement)[0];
            }
            this.popScope();
            return out;
        } else if (node.type === 'EmptyStatement') {
            return ';';
        } else if (node.type === 'DebuggerStatement') {
            return ';';
        } else if (node.type === 'WithStatement') {
            this.error('SyntaxError', 'The with statement is not supported');
        } else if (node.type === 'ReturnStatement') {
            return 'return ' + (node.argument ? this.compileExpression(node.argument)[0] : '') + ';';
        } else if (node.type === 'LabeledStatement') {
            return node.label.name + ': ' + this.compileStatement(node.body);
        } else if (node.type === 'BreakStatement') {
            if (!node.label) {
                return 'break;';
            } else {
                return 'goto ' + node.label.name + ';';
            }
        } else if (node.type === 'ContinueStatement') {
            if (!node.label) {
                return 'continue;';
            } else {
                return 'goto ' + node.label.name + ';';
            }
        } else if (node.type === 'SwitchStatement') {
            let out = 'switch (' + this.compileExpression(node.discriminant) + ') {';
            // todo: finish this
            return out;
        } else {
            throw new Error(`Unrecognized AST node type in compileStatement: ${node.type}`);
        }
    }

    compile() {
        for (let node of this.ast.body) {
            this.compileStatement(node);
        }
        let code = TEMPLATE_CODE + this.funcs.join('\n\n') + 'int main(int argc, char** argv) {\n';
        for (let lines of this.topLevel) {
            for (let line of lines) {
                this.code += '    ' + line + '\n';
            }
        }
        return code + '}\n';
    }

}
