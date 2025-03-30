
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
            throw new Error('node.loc is undefined');
        }
        this.file = node.loc.filename;
        this.line = node.loc.start.line;
        this.col = node.loc.start.column;
        if (this.compiler.code === null) {
            throw new Error('this.compiler.code is null');
        }
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

    set(name: string, type: Type): void {
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

    has(name: string): boolean {
        return this.data.has(name) || (this.parent ? this.parent.has(name) : false);
    }

    hasType(name: string): boolean {
        return this.typeData.has(name) || (this.parent ? this.parent.hasType(name) : false);
    }

    hasOwn(name: string): boolean {
        return this.data.has(name);
    }

    hasOwnType(name: string): boolean {
        return this.typeData.has(name);
    }

    get root(): VariableMap {
        let out: VariableMap = this;
        while (out.parent !== null) {
            out = out.parent;
        }
        return out;
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

    options: CompilerOptions;

    vars: VariableMap;
    code: string | null = null;
    currentNode: bt.Node | null = null;
    strictMode: boolean;
    thisType: Type = t.undefined;

    constructor(options: CompilerOptions = {}) {
        this.options = options;
        this.vars = new VariableMap(this);
        if (options.includeBuiltins ?? true) {
            for (let node of this.parse(BUILTIN_CODE, BUILTIN_OPTIONS).body) {
                this.compileStatement(node);
            }
        }
    }

    error(type: string, message: string): never {
        if (this.currentNode !== null) {
            throw new CompilerError(this, type, message, this.currentNode);
        } else {
            throw new Error('currentNode is null');
        }
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

    tempVarIndex: number = 0;
    getTempVar(): string {
        this.tempVarIndex++;
        return 't' + this.tempVarIndex;
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

    isPrimitive(type: Type): boolean {
        return !(type.extends(t.object)) || type.extends(this.vars.getType('Array'));
    }

    compilePrimitivePropertyAccess(value: string, type: Type, prop: string): [string, Type] {
        if (type.extends(t.undefined) || type.extends(t.null)) {
            this.error('TypeError', `Cannot read properties of ${type.type} (reading '${prop}')`);            
        } else if (type.extends(t.string)) {
            if (prop === 'length') {
                return [`strlen(${value})`, t.number];
            }
        } else if (type.extends(this.vars.getType('Array'))) {
            if (prop === 'length') {
                return [`(*${value})->length`, t.number];
            } else {
                return [`(*${value})->items[${prop}]`, type.getResolvedTypeVar('T')];
            }
        }
        return ['NULL', t.undefined];
    }

    compilePrimitiveMethodCall(value: string, type: Type, method: string, args: [string, Type][]): [string, Type] {
        if (type.extends(t.undefined) || type.extends(t.null)) {
            this.error('TypeError', `Cannot read properties of ${type.type} (reading '${method}')`);
        } else if (type.extends(t.number)) {
            if (method === 'toString') {
                return [`number_to_string(${value})`, t.string];
            } else if (method === 'valueOf') {
                return [value, t.number];
            }
        } else if (type.extends(this.vars.getType('Array'))) {

        }
        this.error('TypeError', 'undefined is not a function');
    }

    parseObjectType(node: bt.TSTypeElement[]): Type {
    }

    parseType(node: bt.TSType | bt.Noop | bt.TSTypeAnnotation | bt.TypeAnnotation): Type {
        if (node.type === 'Noop') {
            return t.unknown;
        } else if (node.type === 'TSTypeAnnotation') {
            return this.parseType(node.typeAnnotation);
        } else if (node.type === 'TypeAnnotation') {
            this.error('SyntaxError', 'Flow is not suported');
        } else if (node.type === 'TSIntrinsicKeyword') {
            this.error('SyntaxError', 'The intrinsic keyword is not supported');
        } else if (node.type === 'TSAnyKeyword') {
            return t.any;
        } else if (node.type === 'TSUnknownKeyword') {
            return t.unknown;
        } else if (node.type === 'TSUndefinedKeyword') {
            return t.undefined;
        } else if (node.type === 'TSNeverKeyword') {
            return t.never;
        } else if (node.type === 'TSVoidKeyword') {
            return t.void;
        } else if (node.type === 'TSNullKeyword') {
            return t.null;
        } else if (node.type === 'TSBooleanKeyword') {
            return t.boolean;
        } else if (node.type === 'TSNumberKeyword') {
            return t.number;
        } else if (node.type === 'TSStringKeyword') {
            return t.string;
        } else if (node.type === 'TSSymbolKeyword') {
            return t.symbol;
        } else if (node.type === 'TSBigIntKeyword') {
            return t.bigint;
        } else if (node.type === 'TSObjectKeyword') {
            return t.object;
        } else if (node.type === 'TSThisType') {
            return this.thisType;
        } else if (node.type === 'TSArrayType') {
            return this.vars.getType('Array').with({T: this.parseType(node.elementType)});
        } else if (node.type === 'TSTypeLiteral') {
            return this.parseObjectType(node.members);
        } else if (node.type === 'TSUnionType') {
            return new t.union(...node.types.map(this.parseType));
        } else if (node.type === 'TSIntersectionType') {
            return new t.intersection(...node.types.map(this.parseType));
        } else {
            throw new Error(`Unrecognized AST node type in parseType: ${node.type}`);
        }
    }

    parseTypeParameters(node: bt.Noop | bt.TSTypeParameterDeclaration | bt.TypeParameterDeclaration): t.typevar[] {
        if (node.type === 'Noop') {
            return [];
        } else if (node.type === 'TypeParameterDeclaration') {
            this.error('SyntaxError', 'Flow is not suported');
        } else {
            let out: t.typevar[] = [];
            for (let param of node.params) {
                let constraint = param.constraint ? this.parseType(param.constraint) : null;
                let defaultValue = param.default ? this.parseType(param.default) : null;
                out.push(new t.typevar(param.name, constraint, defaultValue));
            }
            return out;
        }
    }

    compileType(type: Type): string {
        if (type.type === 'undefined' || type.type === 'null') {
            return 'void*';
        } else if (type.type === 'boolean') {
            return 'bool';
        } else if (type.type === 'number') {
            return 'double';
        } else if (type.type === 'string') {
            return 'char*';
        } else if (type.type === 'symbol') {
            this.error('TypeError', 'Symbols are not supported');
        } else if (type.type === 'bigint') {
            this.error('TypeError', 'BigInts are not supported');
        } else if (type.extends(this.vars.getType('Array'))) {
            return 'array**';
        } else if (type.type === 'object') {
            return 'object*';
        } else {
            throw new Error(`Unrecognized type type in compileType: ${type.type}`);
        }
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
                return ['create_array("")', this.vars.get('Array').with({T: t.any})];
            } else {
                return [
                    `create_array(${this.getTypeTags(types)}, ${elts.join(', ')})`,
                    this.vars.get('Array').with({T: new t.union(...types)})
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
                this.error('SyntaxError', `The postfix unary operator ${node.operator} is not supported.`);
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
            let out: string;
            let left = node.left;
            if (left.type === 'Identifier') {
                if (!this.vars.has(left.name)) {
                    this.error('SyntaxError', 'All variables must be declared, even in non-strict mode');
                } else {
                    let varType = this.vars.get(left.name);
                    if (!varType.extends(rightType)) {
                        this.error('TypeError', `Cannot assign value of type ${rightType} to variable of ${varType}`);
                    }
                    out = `v${left.name} = ${right}`;
                }
            } else if (left.type === 'MemberExpression' || left.type === 'OptionalMemberExpression') {
                let [object, objectType] = this.compileExpression(left.object);
                if (left.type === 'OptionalMemberExpression' && (objectType.extends(t.undefined) || objectType.extends(t.null))) {
                    out = right;
                }
                if (!objectType.extends(t.object)) {
                    this.error('TypeError', 'Cannot assign to properties of primitives');
                }
                if (objectType.extends(this.vars.getType('Array'))) {
                    if (left.property.type !== 'Identifier') {
                        out = `${object}`;
                    }
                }
                let prop: string;
                if (left.property.type === 'Identifier') {
                    prop = this.compileString(left.property.name);
                    let propType = (objectType as t.object).props[left.property.name];
                    if (!propType.extends(rightType)) {
                        this.error('TypeError', `Cannot assign value of type ${rightType} to property of type ${propType}`)
                    }
                } else {
                    prop = this.compileExpression(left.property)[0];
                }
                if (left.optional) {
                    out = `(${object} == NULL ? ${right} : set_key(${object}, ${prop}, ${right}))`;
                } else {
                    out = `set_key(${object}, ${prop}, ${right}`;
                }
            } else {
                this.error('SyntaxError', 'Destructuring is not supported');
            }
            return [out, rightType];
        } else if (node.type === 'LogicalExpression') {
            let [left, leftType] = this.compileExpression(node.left);
            let [right, rightType] = this.compileExpression(node.right);
            return [`${left} ${node.operator} ${right}`, new t.union(leftType, rightType)];
        } else if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
            let [object, objectType] = this.compileExpression(node.object);
            if (node.type === 'OptionalMemberExpression' && (objectType.extends(t.undefined) || objectType.extends(t.null))) {
                return ['NULL', t.null];
            }
            if (this.isPrimitive(objectType)) {
                if (node.property.type !== 'Identifier') {
                    this.error('TypeError', 'Property accesses of primitives cannot be computed');
                } else {
                    return this.compilePrimitivePropertyAccess(object, objectType, node.property.name);
                }
            }
            let out: string;
            let type: Type;
            if (node.property.type === 'Identifier') {
                let prop = node.property.name;
                out = `get_key(${object}, ${this.compileString(prop)})`
                type = (objectType as t.object).props[prop];
                if (type === undefined) {
                    this.error('TypeError', `Property ${prop} does not exist on type ${objectType}`);
                }
            } else {
                let [prop, propType] = this.compileExpression(node.property)[0];
                out = `get_key(${object}, ${prop})`;
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
            if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier' && this.isPrimitive(this.compileExpression(node.callee.object)[1])) {
                let [value, type] = this.compileExpression(node.callee.object);
                return this.compilePrimitiveMethodCall(value, type, node.callee.property.name, args);
            }
            let [callee, calleeType] = this.compileExpression(node.callee);
            if (calleeType instanceof t.object && calleeType.returnType !== null) {
                let out = `${callee}(${this.getTypeTags(args.map(arg => arg[1]))}, ${args.map(arg => arg[0]).join(', ')})`;
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
        } else if (node.type === 'NewExpression') {
            let args = node.arguments.map(arg => this.compileExpression(arg as bt.Expression));
            let [callee, calleeType] = this.compileExpression(node.callee);
            if (calleeType instanceof t.object && calleeType.constructorReturnType !== null) {
                let out = `new(${callee}, ${this.getTypeTags(args.map(arg => arg[1]))}, ${args.map(arg => arg[0]).join(', ')})`;
                if (node.optional) {
                    return [`(${callee} == NULL ? NULL : ${out})`, new t.union(calleeType.constructorReturnType, t.undefined)];
                } else {
                    return [out, calleeType.constructorReturnType];
                }
            } else {
                this.error('TypeError', `Object of type ${calleeType} is not a constructor`);
            }
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
        } else if (node.type === 'V8IntrinsicIdentifier') {
            this.error('SyntaxError', 'Neutrino is not V8');
        } else if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion') {
            return [this.compileExpression(node.expression)[0], this.parseType(node.typeAnnotation)];
        } else if (node.type === 'TSNonNullExpression') {
            let [out, outType] = this.compileExpression(node.expression);
            if (outType instanceof t.union) {
                return [`ts_non_null_tag(argument_types[${outType.tagIndex}]))`, t.bigint];
            } else if (outType.extends(t.undefined) || outType.extends(t.null)) {
                return ['true', new t.boolean(true)];
            } else {
                return ['false', new t.boolean(false)];
            }
        } else if (node.type === 'TSSatisfiesExpression') {
            this.error('SyntaxError', 'The satisfies operator is not supported');
        } else if (node.type === 'TSInstantiationExpression') {
            this.error('SyntaxError', 'Instantiation expressions are not supported');
        } else {
            throw new Error(`Unrecognized AST node type in compileExpression: ${node.type}`);
        }
    }

    compileVariableDeclaration(node: bt.VariableDeclaration): string;
    compileVariableDeclaration(node: bt.VariableDeclaration, value: string, type: Type): string;
    compileVariableDeclaration(node: bt.VariableDeclaration, value?: string, type?: Type): string {
        let out: string = '';
        for (let decl of node.declarations) {
            if (value === undefined || type === undefined) {
                if (!decl.init) {
                    value = 'NULL';
                    type = t.undefined;
                } else {
                    [value, type] = this.compileExpression(decl.init);
                }
            }
            if (decl.id.type === 'Identifier') {
                if (this.vars.hasOwn(decl.id.name)) {
                    this.error('SyntaxError', `${decl.id.name} is already declared`);
                }
                if (decl.id.typeAnnotation) {
                    let annType = this.parseType(decl.id.typeAnnotation);
                    if (!annType.extends(type)) {
                        this.error('TypeError', `Cannot assign value of type ${type} to variable of type ${annType}`);
                    }
                    type = annType;
                }
                this.vars.set(decl.id.name, type);
                out += `${this.compileType(type)} = ${value};\n`;
            } else {
                this.error('SyntaxError', 'Destructuring is not supported');
            }
        }
        return out.trimEnd();
    }

    compileStatement(node: bt.Statement): string {
        this.currentNode = node;
        if (node.type === 'ExpressionStatement') {
            return this.compileExpression(node.expression)[0];
        } else if (node.type === 'BlockStatement') {
            this.pushScope();
            let out: string[] = [];
            for (let statement of node.body) {
                out.push(...this.compileStatement(statement)[0].split('\n'));
            }
            this.popScope();
            return '{\n' + out.map(x => '    ' + x).join('\n') + '\n}';
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
        } else if (node.type === 'ThrowStatement') {
            return `printf(String(${this.compileExpression(node.argument)[0]})); exit(1);`;
        } else if (node.type === 'TryStatement') {
            this.error('SyntaxError', 'Exception handling is not supported');
        } else if (node.type === 'WhileStatement') {
            return 'while (Boolean(' + this.compileExpression(node.test) + ')) ' + this.compileStatement(node.body);
        } else if (node.type === 'DoWhileStatement') {
            return 'do ' + this.compileStatement(node.body) + ' while (Boolean(' + this.compileExpression(node.test) + '));';
        } else if (node.type === 'ForStatement') {
            let out = 'for (';
            this.pushScope();
            if (!node.init) {
                out += ';';
            } else if (node.init.type === 'VariableDeclaration') {
                out += this.compileVariableDeclaration(node.init)
            } else {
                out += this.compileExpression(node.init);
            }
            if (node.test) {
                out += 'Boolean(' + this.compileExpression(node.test) + ')';
            } else {
                out += ';';
            }
            if (node.update) {
                out += this.compileExpression(node.update);
            }
            out += ') ' + this.compileStatement(node.body);
            this.popScope();
            return out;
        } else if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
            let arrayVar: string;
            let indexVar = this.getTempVar();
            let right = this.compileExpression(node.right)[0];
            if (node.type === 'ForInStatement') {
                arrayVar = this.getTempVar();
                right = `get_object_keys(${right})`;
            } else {
                arrayVar = right;
            }
            let out = `array** ${arrayVar} = ${right};\n`;
            out += `for (int ${indexVar} = 0; ${indexVar} < *${arrayVar}; ${indexVar}++) {\n`;
            this.pushScope();
            if (node.left.type !== 'VariableDeclaration') {
                this.error('SyntaxError', 'All variables must be declared, even in non-strict mode');
            }
            for (let decl of this.compileVariableDeclaration(node.left, `(*${arrayVar})->items[${indexVar}]`, t.string).split('\n')) {
                if (decl !== '') {
                    out += '    ' + decl + '\n';
                }
            }
            if (node.body.type === 'BlockStatement') {
                for (let statement of node.body.body) {
                    for (let line of this.compileStatement(statement).split('\n')) {
                        if (line !== '') {
                            out += '    ' + line + '\n';
                        }
                    }
                }
            } else {
                out += '    ' + this.compileStatement(node.body);
            }
            this.popScope();
            out += '\n}'
            return out;
        } else if (node.type === 'VariableDeclaration') {
            return this.compileVariableDeclaration(node);
        } else if (node.type === 'FunctionDeclaration') {
            if (!node.id) {
                throw new Error('Invalid AST');
            }
            if (node.async) {
                this.error('SyntaxError', 'Async functions are not supported');
            }
            if (node.generator) {
                this.error('SyntaxError', 'Generators are not supported');
            }
            let params: [string, Type][] = [];
            let restName: string | null = null;
            for (let arg of node.params) {
                if (arg.type === 'Identifier') {
                    if (!arg.typeAnnotation) {
                        this.error('SyntaxError', 'Function arguments must have type annotations');
                    }
                    params.push([arg.name, this.parseType(arg.typeAnnotation)]);
                } else if (arg.type === 'RestElement') {
                    if (arg.argument.type !== 'Identifier') {
                        this.error('SyntaxError', 'Destructuring is not supported');
                    }
                    restName = arg.argument.name;
                } else {
                    this.error('SyntaxError', 'Destructuring is not supported');
                }
            }
            if (node.returnType === null || node.returnType === undefined) {
                this.error('SyntaxError', 'Functions must have a return type');
            }
            let type = this.vars.getType('Function').copy() as t.object;
            type.params = params;
            type.returnType = this.parseType(node.returnType);
            type.constructorParams = params;
            if (node.typeParameters) {
                type.typeVars = this.parseTypeParameters(node.typeParameters);
            }
            let start = `${this.compileType(type.returnType)} v${node.id.name}(long tags, ...) {`;
            let out = ['args_setup();'];
            for (let [name, type] of params) {
                out.push(`${this.compileType(type)} v${name} = extract_arg()`);
            }
            if (restName !== null) {
                out.push(`array** v${restName} = extract_rest_arg()`);
            }
            for (let statement of node.body.body) {
                out.push(...this.compileStatement(statement).split('\n'));
            }
            return start + out.map(line => '    ' + line).join('\n') + '\n}';
        } else if (node.type === 'TypeAlias') {
            this.error('SyntaxError', 'Flow is not supported');
        } else if (node.type === 'TSTypeAliasDeclaration') {
            this.vars.setType(node.id.name, this.parseType(node.typeAnnotation));
            return '';
        } else if (node.type === 'TSInterfaceDeclaration') {
            this.vars.setType(node.id.name, this.parseObjectType(node.body.body));
            return '';
        } else {
            throw new Error(`Unrecognized AST node type in compileStatement: ${node.type}`);
        }
    }

    compile(code: string | bt.Program): string {
        let ast: bt.Program;
        if (typeof code === 'string') {
            ast = this.parse(code);
        } else {
            ast = code;
        }
        let funcs: string[] = [];
        let topLevel: string[] = [];
        let topLevelVars: string[] = [];
        for (let node of ast.body) {
            let code = this.compileStatement(node);
            if (node.type === 'VariableDeclaration') {
                topLevelVars.push(code);
            }
        }
        let out = '\n#include <neutrino.h>\n\n';
        if (topLevelVars.length > 0) {
            out += '\n\n' + topLevelVars.join('\n\n');
        }
        if (funcs.length > 0) {
            out += '\n\n' + funcs.join('\n\n');
        }
        if (topLevel.length > 0) {
            out += '\n\nint main(int argc, char** argv) {\n';
            for (let lines of topLevel) {
                for (let line of lines) {
                    out += '    ' + line + '\n';
                }
            }
            out += '}\n';
        }
        return out;
    }

}
