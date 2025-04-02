
import * as bt from '@babel/types';
import * as parser from '@babel/parser';
import * as t from './types';
import {Type} from './types';
import {highlight, HighlightColors} from './highlighter';
import * as fs from 'node:fs';
// import * as path from 'node:path';


const BUILTIN_CODE = fs.readFileSync('./builtins/index.ts').toString();
const BUILTIN_OPTIONS = {
    filename: 'builtins/index.ts',
    typescript: true,
    includeBuiltins: false,
    includeMain: false,
};


// type RegularFile = string;
// type Directory = {[key: string]: File | undefined};
// type File = Directory | RegularFile;

// function extractFiles(dir: string): Directory {
//     let out: Directory = {};
//     for (let subPath of fs.readdirSync(dir)) {
//         let fullPath = path.join(dir, subPath);
//         if (fs.statSync(fullPath).isDirectory()) {
//             out[subPath] = extractFiles(fullPath);
//         } else {
//             out[subPath] = (fs.readFileSync(fullPath)).toString();
//         }
//     }
//     return out;
// }

// let files = extractFiles(process.cwd());


class CompilerError extends Error {

    [Symbol.toStringTag] = 'CompilerError';

    compiler: Compiler;
    type: string;

    file: string;
    line: number;
    col: number;
    endCol: number;
    rawLine: string;

    constructor(compiler: Compiler, type: string, message: string, loc: bt.SourceLocation) {
        super(message);
        this.compiler = compiler;
        this.type = type;
        this.file = loc.filename;
        this.line = loc.start.line;
        this.col = loc.start.column;
        if (this.compiler.code === null) {
            throw new Error('this.compiler.code is null');
        }
        this.rawLine = this.compiler.code.split('\n')[this.line - 1];
        if (loc.end.line !== this.line) {
            this.endCol = this.rawLine.length;
        } else {
            this.endCol = loc.end.column;
        }
    }

    toString(): string {
        let out = `${this.type}: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + this.rawLine + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.endCol - this.col) + ' (here)';
        return out;
    }

    toStringColors(): string {
        let out = `\x1b[91m${this.type}\x1b[0m: ${this.message} (at ${this.file}:${this.line}:${this.col})\n`;
        out += '    ' + highlight(this.rawLine, this.compiler.options.colors) + '\n';
        out += '    ' + ' '.repeat(this.col) + '^'.repeat(this.endCol - this.col) + ' (here)';
        return out;
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
        let value = this.typeData.get(name);
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
    includeMain?: boolean;
    includeBuiltins?: boolean;
    colors?: HighlightColors;
    jsxPragma?: string;
    jsxPragmaFrag?: string;
}

export class Compiler {

    options: CompilerOptions;

    vars: VariableMap;
    code: string | null = null;
    currentNode: bt.Node | null = null;
    strictMode: boolean = false;
    thisType: Type = t.undefined;
    anonymousFunctions: string[] = [];

    builtinTopLevel: string[] = [];

    constructor(options: CompilerOptions = {}) {
        this.options = options;
        this.vars = new VariableMap(this);
        this.parseType = this.parseType.bind(this);
        this.compileExpression = this.compileExpression.bind(this);
        this.compileStatement = this.compileStatement.bind(this);
        if (options.includeBuiltins ?? true) {
            this.code = BUILTIN_CODE;
            let ast = this.parse(BUILTIN_CODE, BUILTIN_OPTIONS).body;
            let [decls] = this.hoistDeclarations(ast);
            this.builtinTopLevel.push(decls);
            this.code = null;
        }
    }

    
    formatType(type: Type) {
        return highlight(type.toString(), this.options.colors, true);
    }

    error(type: string, message: string): never {
        if (this.currentNode !== null) {
            throw new CompilerError(this, type, message, this.currentNode.loc as bt.SourceLocation);
        } else {
            throw new Error('currentNode is null');
        }
    }

    astNodeTypeError(node: bt.Node | never, func: string): never {
        this.error('NeutrinoBugError', `Unrecognized AST node type in ${func}: ${(node as bt.Node).type}`);
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
        try {
            return parser.parse(code, {
                createImportExpressions: true,
                createParenthesizedExpressions: true,
                sourceType: 'module',
                sourceFilename: options.filename ?? '<anonymous>',
                plugins,
            }).program;
        } catch (error) {
            let [type, msg_loc] = String(error).split(': ');
            let [msg, loc] = msg_loc.slice(0, -1).split('. (');
            let [line, col] = loc.split(':').map(x => parseInt(x));
            throw new CompilerError(this, type, msg, {
                filename: options.filename ?? '<anonymous>',
                start: {
                    line: line,
                    column: col,
                    index: 0,
                },
                end: {
                    line: line,
                    column: col + 1,
                    index: 0,
                },
                identifierName: '',
            });
        }
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
        return 'jt' + this.tempVarIndex;
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

    static readonly TYPE_TAGS: {[key: string]: number} = {
        undefined: 0,
        null: 1,
        boolean: 2,
        number: 3,
        string: 4,
        symbol: 5,
        bigint: 6,
        object: 7,
        function: 8,
        tuple: 9,
        record: 10,
    }

    static readonly INVERSE_TYPE_TAGS: {[key: number]: string} = {
        0: 'undefined',
        1: 'null',
        2: 'boolean',
        3: 'number',
        4: 'string',
        5: 'symbol',
        6: 'bigint',
        7: 'object',
        8: 'function',
        9: 'tuple',
        10: 'record',
    }

    getTypeTags(types: Type[]): string {
        let tags: string[] = [];
        for (let type of types) {
            if (type.type in Compiler.TYPE_TAGS) {
                tags.push(Compiler.TYPE_TAGS[type.type] + 'ul');
            } else if (type.tagIndex !== -1) {
                tags.push(`get_type_tag(tags, ${type.tagIndex})`);
            } else if (type.specialName === 'new.target') {
                tags.push('new_target_tag');
            } else {
                this.error('NeutrinoBugError', `Unable to get a type tag for ${this.formatType(type)}`);
            }
        }
        let out = '('.repeat(tags.length);
        for (let tag of tags) {
            out += tag + ') << 4 + ';
        }
        return '(' + out.slice(0, -8) + ')';
    }

    getSingleTag(type: Type): string {
        if (type.specialName === 'new.target') {
            return 'new_target_tag';
        } else if (type.tagIndex !== -1) {
            return `get_type_tag((tags >> ${type.tagIndex * 4}) & 0xf)`;
        } else if (type instanceof t.union) {
            this.error('TypeError', 'Cannot perform operations on unions whose type is unknown at runtime, use type casting.');
        } else if (type.type in Compiler.TYPE_TAGS) {
            return String(Compiler.TYPE_TAGS[type.type]);
        } else {
            this.error('NeutrinoBugError', `Unable to get a type tag for ${this.formatType(type)}`);
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
    
    parseTypeParameters(node: bt.Noop | bt.TSTypeParameterDeclaration | bt.TypeParameterDeclaration, addToScope: boolean = true): t.typevar[] {
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
                if (addToScope) {
                    this.vars.setType(param.name, constraint ?? t.any);
                }
            }
            return out;
        }
    }

    parseParameters(parameters: (bt.Identifier | bt.RestElement | bt.Pattern | bt.TSParameterProperty)[]): [[string, Type][], null | [string, Type]] {
        let params: [string, Type][] = [];
        let restParam: null | [string, Type] = null;
        for (let i = 0; i < parameters.length; i++) {
            let arg = parameters[i];
            if (arg.type === 'Identifier') {
                if (!arg.typeAnnotation) {
                    this.error('SyntaxError', 'Function arguments must have type annotations');
                }
                let type = this.parseType(arg.typeAnnotation);
                type.tagIndex = i;
                params.push([arg.name, type]);
            } else if (arg.type === 'RestElement') {
                if (arg.argument.type !== 'Identifier') {
                    this.error('SyntaxError', 'Destructuring is not supported for rest parameters');
                }
                if (!arg.typeAnnotation) {
                    this.error('SyntaxError', 'Rest parameters must have type annotatin');
                }
                restParam = [arg.argument.name, this.parseType(arg.typeAnnotation)];
            } else {
                this.error('SyntaxError', 'Destructuring is not supported for parameters');
            }
        }
        return [params, restParam];
    }

    parseObjectType(nodes: bt.TSTypeElement[]): Type {
        let out = new t.object();
        for (let node of nodes) {
            this.currentNode = node;
            if (node.type === 'TSPropertySignature' || node.type === 'TSMethodSignature') {
                if (node.key.type !== 'Identifier') {
                    this.error('SyntaxError', 'Computed properties in object types are not supported');
                }
                let value: Type;
                if (node.type === 'TSPropertySignature') {
                    if (!node.typeAnnotation) {
                        this.error('SyntaxError', 'Object type keys must have type annotations');
                    }
                    value = this.parseType(node.typeAnnotation);
                } else {
                    let func = new t.functionsig();
                    if (node.typeParameters) {
                        func.typeVars = this.parseTypeParameters(node.typeParameters);
                    }
                    if (!node.typeAnnotation) {
                        this.error('SyntaxError', 'Method signatures must have return types');
                    }
                    func.returnType = this.parseType(node.typeAnnotation);
                    let [params, restParam] = this.parseParameters(node.parameters);
                    func.params = params;
                    func.restParam = restParam;
                    value = Object.assign(new t.object(), {call: func});
                }
                out.props[node.key.name] = value;
            } else if (node.type === 'TSCallSignatureDeclaration' || node.type === 'TSConstructSignatureDeclaration') {
                let func = new t.functionsig();
                this.pushScope();
                if (node.typeParameters) {
                    func.typeVars = this.parseTypeParameters(node.typeParameters);
                }
                if (!node.typeAnnotation) {
                    this.error('SyntaxError', 'Method signatures must have return types');
                }
                func.returnType = this.parseType(node.typeAnnotation);
                let [params, restParam] = this.parseParameters(node.parameters);
                func.params = params;
                func.restParam = restParam;
                this.popScope();
                if (node.type === 'TSCallSignatureDeclaration') {
                    out.call = func;
                } else {
                    out.construct = func;
                }
            } else if (node.type === 'TSIndexSignature') {
                if (!node.typeAnnotation || !node.parameters[0].typeAnnotation) {
                    this.error('SyntaxError', 'Index signatures must have type annotations');
                }
                out.indexes.push([node.parameters[0].name, this.parseType(node.parameters[0].typeAnnotation), this.parseType(node.typeAnnotation)]);
            } else {
                this.astNodeTypeError(node, 'parseObjectType');
            }
        }
        return out;
    }

    parseType(node: bt.TSType | bt.Noop | bt.TSTypeAnnotation | bt.TypeAnnotation): Type {
        this.currentNode = node;
        if (node.type === 'Noop') {
            return t.unknown;
        } else if (node.type === 'TSTypeAnnotation') {
            return this.parseType(node.typeAnnotation);
        } else if (node.type === 'TypeAnnotation') {
            this.error('SyntaxError', 'Flow is not suported');
        } else if (node.type === 'TSTypeReference') {
            if (node.typeName.type === 'TSQualifiedName') {
                this.error('SyntaxError', 'Qualified names are not supported');
            }
            return this.vars.getType(node.typeName.name);
        } else if (node.type === 'TSIntrinsicKeyword') {
            this.error('SyntaxError', 'The intrinsic keyword is not supported');
        } else if (node.type === 'TSAnyKeyword') {
            return new t.any();
        } else if (node.type === 'TSUnknownKeyword') {
            return new t.unknown();
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
        } else if (node.type === 'TSTupleType') {
            let elts = node.elementTypes.map(type => this.parseType(type as bt.TSType));
            let base = this.vars.getType('Array').with({T: new t.union(...elts)});
            return new t.object(Object.assign((base as t.object).props, Object.fromEntries(elts.map((x, i) => [i, x]))));
        } else {
            this.astNodeTypeError(node, 'parseType');
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
            return 'long';
        } else if (type.type === 'bigint') {
            return 'mpz_t';
        } else if (type.extends(this.vars.getType('Array'))) {
            return 'array*';
        } else if (type.type === 'object') {
            return 'object*';
        } else {
            this.error('NeutrinoBugError', `Unrecognized type type in compileType: ${type.type}`);
        }
    }

    compileAssignment(node: bt.LVal, value: string, type: Type, declaration: boolean, declare: boolean = false): string {
        let tempVar = this.getTempVar();
        let out: string;
        if (node.type === 'Identifier') {
            this.vars.set(node.name, node.typeAnnotation ? this.parseType(node.typeAnnotation) : type);
            if (declaration) {
                out = `${this.compileType(type)} jv${node.name} = ${value};\n`;
            } else {
                out = `jv${node.name} = ${value}`;
            }
        } else if (node.type === 'ObjectPattern') {
            out = '';
            for (let prop of node.properties) {
                if (prop.type === 'ObjectProperty') {
                    if (prop.key.type !== 'Identifier') {
                        this.error('SyntaxError', 'Computed property keys in object destructuring assignments are not supported');
                    }
                    let value = `get_key(${tempVar}, ${this.compileString(prop.key.name)})`;
                    let valueType = (type as t.object).props[prop.key.name];
                    out += this.compileAssignment(prop.value as bt.LVal, value, valueType, declaration, declare);
                } else {
                    this.error('SyntaxError', 'Rest elements in object destructuring assignments are not supported');
                }
            }
        } else if (node.type === 'ArrayPattern') {
            out = '';
            for (let i = 0; i < node.elements.length; i++) {
                let item = node.elements[i];
                if (item === null) {
                    continue;
                }
                let value = `${tempVar}->items[${i}]`;
                let valueType = (type as t.object).props[i];
                if (item.type === 'RestElement') {
                    value = `array_slice(${tempVar}, ${((type as t.object).props.length as t.number).value})`;
                    valueType = this.vars.getType('Array').with({T: type.getResolvedTypeVar('T')});
                    item = item.argument;
                }
                out += this.compileAssignment(item, value, valueType, declare);
            }
        } else {
            this.astNodeTypeError(node, 'compileAssignment');
        }
        return out;
    }

    getFunctionType(node: bt.Function, pushScope: boolean = true): t.object & {call: t.functionsig} {
        let func = new t.functionsig();
        if (pushScope) {
            this.pushScope();
        }
        if (node.typeParameters) {
            func.typeVars = this.parseTypeParameters(node.typeParameters);
        }
        let [params, restParam] = this.parseParameters(node.params);
        func.params = params;
        func.restParam = restParam;
        if (!node.returnType) {
            this.error('SyntaxError', 'Methods must have return types');
        }
        func.returnType = this.parseType(node.returnType);
        if (pushScope) {
            this.popScope();
        }
        return Object.assign(new t.object((this.vars.getType('Function') as t.object).props), {call: func});
    }

    parsedJSXPragma: bt.Expression | null = null;
    parsedJSXPragmaFrag: bt.Expression | null = null;

    transformJSX(node: bt.JSXElement | bt.JSXFragment | bt.JSXIdentifier | bt.JSXMemberExpression | bt.JSXNamespacedName | bt.JSXExpressionContainer | bt.JSXText | bt.JSXSpreadChild | bt.Expression): bt.Expression {
        this.currentNode = node;
        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            if (this.parsedJSXPragma === null) {
                this.parsedJSXPragma = (this.parse(this.options.jsxPragma ?? 'React.createElement').body[0] as bt.ExpressionStatement).expression;
                this.currentNode = node;
            }
            let args: bt.Expression[] = [];
            if (node.type === 'JSXElement') {
                let open = node.openingElement;
                args.push(this.transformJSX(open.name));
                if (open.attributes.length === 0) {
                    args.push({type: 'NullLiteral', loc: open.loc});
                } else {
                    let props: (bt.ObjectProperty | bt.SpreadElement)[] = [];
                    for (let attr of open.attributes) {
                        if (attr.type === 'JSXAttribute') {
                            props.push({type: 'ObjectProperty', loc: attr.loc, computed: false, shorthand: false, key: this.transformJSX(attr.name), value: this.transformJSX(attr.value ?? attr.name)});
                        } else {
                            props.push({type: 'SpreadElement', loc: attr.loc, argument: attr.argument});
                        }
                    }
                    args.push({type: 'ObjectExpression', loc: open.loc, properties: props})
                }
            } else {
                if (this.parsedJSXPragmaFrag === null) {
                    this.parsedJSXPragmaFrag = (this.parse((this.options.jsxPragma ?? 'React.createElement') + ';').body[0] as bt.ExpressionStatement).expression;
                    this.currentNode = node;
                }
                args.push(this.parsedJSXPragmaFrag, {type: 'NullLiteral', loc: node.loc});
            }
            for (let child of node.children) {
                this.currentNode = child;
                args.push(this.transformJSX(child));
            }
            return {
                type: 'CallExpression',
                loc: node.loc,
                callee: this.parsedJSXPragma,
                arguments: args,
            };
        } else if (node.type === 'JSXIdentifier') {
            if (node.name[0] === node.name[0].toUpperCase()) {
                return {type: 'Identifier', loc: node.loc, name: node.name};
            } else {
                return {type: 'StringLiteral', loc: node.loc, value: node.name};
            }
        } else if (node.type === 'JSXExpressionContainer') {
            if (node.expression.type === 'JSXEmptyExpression') {
                this.astNodeTypeError(node.expression, 'transformJSX');
            }
            return node.expression;
        } else if (node.type === 'JSXText') {
            return {type: 'StringLiteral', loc: node.loc, value: node.value};
        } else if (node.type === 'JSXMemberExpression' || node.type === 'JSXNamespacedName' || node.type === 'JSXSpreadChild') {
            this.astNodeTypeError(node, 'transformJSX');
        } else {
            return node;
        }
    }

    compileExpression(node: bt.Expression | bt.PrivateName | bt.V8IntrinsicIdentifier): [string, Type] {
        this.currentNode = node;
        if (node.type === 'Identifier') {
            return ['jv' + node.name, this.vars.get(node.name)];
        } else if (node.type === 'PrivateName') {
            return ['jp' + node.id.name, t.unknown];
        } else if (node.type === 'RegExpLiteral') {
            this.error('SyntaxError', 'Regular expressions are not supported');
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
            this.error('SyntaxError', 'super; is not supported');
        } else if (node.type === 'ThisExpression') {
            return ['this', this.thisType];
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
                return ['create_array(0)', this.vars.get('Array').with({T: t.any})];
            } else {
                return [
                    `create_array_with_items(${elts.length}, ${elts.join(', ')})`,
                    this.vars.get('Array').with({T: new t.union(...types)})
                ];
            }
        } else if (node.type === 'ObjectExpression') {
            let data: string[] = [];
            let props: {[key: PropertyKey]: Type} = (this.vars.getType('Object') as t.object).props;
            let types: Type[] = [];
            let methods: bt.FunctionDeclaration[] = [];
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
                    if (prop.key.type !== 'Identifier') {
                        this.error('SyntaxError', 'Methods cannot have computed keys');
                    }
                    props[prop.key.name] = this.getFunctionType(prop);
                    methods.push(Object.assign({}, prop, {
                        type: 'FunctionDeclaration',
                        id: {type: 'Identifier', loc: prop.key.loc, name: `__anonymous_${this.anonymousFunctions.length}`},
                    } as const));
                } else {
                    this.error('SyntaxError', 'Spread elements are not supported in object literals');
                }
            }
            this.thisType = new t.object(props);
            for (let method of methods) {
                this.anonymousFunctions.push(this.compileStatement(method));
            }
            this.currentNode = node;
            this.thisType = t.undefined;
            if (data.length === 0) {
                return ['create_object(jvObject, 0)', new t.object()];
            } else {
                return [`create_object(jvObject, ${data.length}, ${data.join(', ')})`, new t.object(props)];
            }
        } else if (node.type === 'RecordExpression') {
            this.error('SyntaxError', 'Records are not supported');
        } else if (node.type === 'TupleExpression') {
            this.error('SyntaxError', 'Tuples are not supported');
        } else if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            let name = 'id' in node && node.id ? node.id.name : `__anonymous_${this.anonymousFunctions.length}`;
            this.anonymousFunctions.push(this.compileStatement(Object.assign(node, {
                type: 'FunctionDeclaration',
                id: {type: 'Identifier', loc: node.loc, name},
            } as const)));
            return ['jv' + name, this.vars.get(name)];
        } else if (node.type === 'UnaryExpression') {
            let [expr, type] = this.compileExpression(node.argument);
            if (node.prefix) {
                if (node.operator === 'typeof') {
                    if (type.tagIndex !== -1) {
                        return [`typeof_from_tag(tags, get_tag(${type.tagIndex}))`, t.string];
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
            this.currentNode = node;
            if (node.operator === '==' || node.operator === '!=' || node.operator === '===' || node.operator === '!==') {
                let code: string;
                let isStrict = node.operator.length === 3;
                if (leftType.tagIndex !== -1 || rightType.tagIndex !== -1) {
                    if (rightType.type === 'undefined') {
                        return [`${left} == NULL`, t.boolean];
                    }
                    code = `${isStrict ? 'strict_' : ''}equal(tags, ${left}, ${this.getSingleTag(leftType)}, ${right}, ${this.getSingleTag(rightType)})`;
                } else if (leftType.type === rightType.type) {
                    if (leftType.type === 'boolean' || leftType.type === 'number' || leftType.type === 'object') {
                        code = `${left} == ${right}`;
                    } else if (leftType.type === 'string') {
                        code = `strcmp(${left}, ${right}) != 0`;
                    } else if (leftType.type === 'undefined' || leftType.type === 'null') {
                        code = 'true';
                    } else {
                        this.error('TypeError', `Unsupported operand type for equality: ${this.formatType(leftType)}`);
                    }
                } else if (isStrict) {
                    code = 'false';
                } else if (leftType.extends(t.null) || leftType.extends(t.undefined) || rightType.extends(t.null) || rightType.extends(t.undefined)) {
                    code = `${left} == ${right}`;
                } else {
                    if (leftType.extends(t.object) || rightType.extends(t.object)) {
                        code = `equal(${left}, ${this.getSingleTag(leftType)}, ${right}, ${this.getSingleTag(rightType)})`;
                    } else if (leftType.extends(t.string)) {
                        code = `jvNumber(5, ${left}) == ${right}`;
                    } else if (rightType.extends(t.string)) {
                        code = `${left} == jvNumber(${right})`;
                    } else {
                        this.error('TypeError', `Unsupported types: ${this.formatType(leftType)} and/or ${this.formatType(rightType)}`);
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
                    left = `jvNumber(${this.getSingleTag(leftType)}, ${right})`;
                }
                if (!(rightType.type === 'number')) {
                    left = `jvNumber(${this.getSingleTag(leftType)}, ${right})`;
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
            let left = node.left;
            if (left.type === 'MemberExpression' || left.type === 'OptionalMemberExpression') {
                let out: string;
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
                if (objectType instanceof t.object && objectType.call !== null && right.startsWith('jv')) {
                    right = 'jo' + right.slice(2);
                }
                let prop: string;
                if (left.property.type === 'Identifier') {
                    prop = this.compileString(left.property.name);
                    if (left.property.name === 'prototype' && objectType instanceof t.object && objectType.construct) {
                        objectType.props['prototype'] = rightType;
                        objectType.construct.returnType = objectType.props['prototype'];
                    }
                    let propType = (objectType as t.object).props[left.property.name];
                    if (!propType.extends(rightType)) {
                        this.error('TypeError', `Cannot assign value of type ${this.formatType(rightType)} to property of type ${this.formatType(propType)}`)
                    }
                } else {
                    prop = this.compileExpression(left.property)[0];
                }
                if (left.optional) {
                    out = `(${object} == NULL ? ${right} : set_key(${object}, ${prop}, ${right}))`;
                } else {
                    out = `set_key(${object}, ${prop}, ${right}`;
                }
                return [out, rightType];
            } else {
                return [this.compileAssignment(left, right, rightType, false), rightType];
            }
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
                    this.error('TypeError', `Property ${prop} does not exist on type ${this.formatType(objectType)}`);
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
            if (calleeType instanceof t.object && calleeType.call !== null) {
                let out = `${callee}(${this.getTypeTags(args.map(arg => arg[1]))}, ${args.map(arg => arg[0]).join(', ')})`;
                if (node.optional) {
                    return [`(${callee} == NULL ? NULL : ${out})`, new t.union(calleeType.call.returnType, t.undefined)];
                } else {
                    return [out, calleeType.call.returnType];
                }
            } else {
                this.error('TypeError', `Object of type ${this.formatType(calleeType)} is not callable`);
            }
        } else if (node.type === 'SequenceExpression') {
            let exprs = node.expressions.map(this.compileExpression);
            return [exprs.map(expr => expr[0]).join(', '), exprs[exprs.length - 1][1]];
        } else if (node.type === 'ParenthesizedExpression') {
            let expr = this.compileExpression(node.expression);
            return ['(' + expr[0] + ')', expr[1]];
        } else if (node.type === 'NewExpression') {
            let args = node.arguments.map(arg => this.compileExpression(arg as bt.Expression));
            if (node.callee.type !== 'Identifier') {
                this.error('SyntaxError', 'Constructors for new() must be identifiers');
            }
            let callee = node.callee.name;
            let calleeType = this.vars.get(callee);
            if (calleeType instanceof t.object && calleeType.construct !== null) {
                let out = `new(jo${callee}, jv${callee}, ${this.getTypeTags(args.map(arg => arg[1]))}, ${args.map(arg => arg[0]).join(', ')})`;
                let outType = calleeType.construct.returnType;
                if (outType instanceof t.object) {
                    Object.assign(outType.props, {constructor: calleeType});
                }
                if (node.optional) {
                    return [`(${callee} == NULL ? NULL : ${out})`, new t.union(outType, t.undefined)];
                } else {
                    return [out, outType];
                }
            } else {
                this.error('TypeError', `Object of type ${this.formatType(calleeType)} is not a constructor`);
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
                out.push(node.quasis[i].value.raw);
                if (i !== node.quasis.length - 1) {
                    out.push(`jvString(${this.compileExpression(node.expressions[i] as bt.Expression)[0]})`);
                }
            }
            return [`default_template_tag(${out.length}, ${out.join(', ')})`, t.string];
        } else if (node.type === 'TaggedTemplateExpression') {
            let out: string[] = [];
            let {quasi, tag} = node;
            let isNeutrinoDotC = tag.type === 'MemberExpression' && tag.object.type === 'Identifier' && tag.object.name === 'neutrino' && tag.property.type === 'Identifier' && tag.property.name === 'c';
            for (let i = 0; i < quasi.quasis.length; i++) {
                out.push(quasi.quasis[i].value.raw);
                if (i !== quasi.quasis.length - 1) {
                    let expr = this.compileExpression(quasi.expressions[i] as bt.Expression)[0];
                    out.push(isNeutrinoDotC ? expr : `jvString(${expr})`);
                }
            }
            if (isNeutrinoDotC) {
                return [out.join(''), t.any];
            } else {
                let [tagCode, tagType] = this.compileExpression(tag);
                if (!(tagType instanceof t.object) || tagType.call === null) {
                    this.error('TypeError', `Value of type ${this.formatType(tagType)} is not callable`);
                }
                return [tagCode + '(' + out.join(', ') + ')', tagType.call.returnType];
            }
        } else if (node.type === 'MetaProperty') {
            let meta = node.meta.name;
            let prop = node.property.name;
            if (meta === 'new' && prop === 'target') {
                return ['new_target', Object.assign(new t.union(t.object, t.undefined), {specialName: 'new.target'})];
            } else {
                this.error('SyntaxError', `Unrecognized meta property ${meta}.${prop}`);
            }
        } else if (node.type === 'V8IntrinsicIdentifier') {
            this.error('SyntaxError', 'Neutrino is not V8');
        } else if (node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion' || node.type === 'TSSatisfiesExpression') {
            let [expr, exprType] = this.compileExpression(node.expression);
            let type = this.parseType(node.typeAnnotation);
            if (!exprType.extends(type)) {
                this.error('TypeError', `Value of type ${this.formatType(exprType)} does not satisfy constraint of ${this.formatType(type)}`)
            }
            return [expr, node.type === 'TSSatisfiesExpression' ? exprType : type];
        } else if (node.type === 'TSNonNullExpression') {
            let [out, outType] = this.compileExpression(node.expression);
            if (outType instanceof t.union) {
                return [`ts_non_null_tag(argument_types[${outType.tagIndex}]))`, t.bigint];
            } else if (outType.extends(t.undefined) || outType.extends(t.null)) {
                return ['true', new t.boolean(true)];
            } else {
                return ['false', new t.boolean(false)];
            }
        } else if (node.type === 'TSInstantiationExpression') {
            this.error('SyntaxError', 'Instantiation expressions are not supported');
        } else if (node.type === 'PipelineBareFunction' || node.type === 'PipelinePrimaryTopicReference' || node.type === 'PipelineTopicExpression') {
            this.error('SyntaxError', 'The pipeline operator is not supported');
        } else if (node.type === 'TypeCastExpression') {
            this.error('SyntaxError', 'Flow is not supported');
        } else if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            return this.compileExpression(this.transformJSX(node));
        } else if (node.type === 'ImportExpression') {
            this.error('SyntaxError', 'Modules are not supported');
        } else if (node.type === 'ClassExpression') {
            let name = 'id' in node && node.id ? node.id.name : `__anonymous_${this.anonymousFunctions.length}`;
            this.anonymousFunctions.push(this.compileStatement(Object.assign({}, node, {
                type: 'ClassDeclaration',
                id: {type: 'Identifier', loc: node.loc, name},
            } as const)));
            return ['jv' + name, this.vars.get(name)];
        } else {
            this.astNodeTypeError(node, 'compileExpression');
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
            out += this.compileAssignment(decl.id, value, type, true, node.declare ?? false);
        }
        return out.trimEnd();
    }

    compileStatement(node: bt.Statement): string {
        this.currentNode = node;
        if (node.type === 'ExpressionStatement') {
            return this.compileExpression(node.expression)[0] + ';';
        } else if (node.type === 'BlockStatement') {
            this.pushScope();
            let out: string[] = [];
            for (let statement of node.body) {
                out.push(...this.compileStatement(statement).split('\n'));
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
        } else if (node.type === 'IfStatement') {
            let out = 'if (' + this.compileExpression(node.test)[0] + ') ' + this.compileStatement(node.consequent);
            if (node.alternate) {
                if (node.consequent.type === 'BlockStatement') {
                    out += ' else ';
                } else {
                    out += '\nelse ';
                }
                out += this.compileStatement(node.alternate);
            }
            return out;
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
            let out = `array* ${arrayVar} = ${right};\n`;
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
            this.pushScope();
            let type = this.getFunctionType(node, false);
            type.construct = new t.functionsig(type.call.params, t.any);
            for (let [name, paramType] of type.call.params) {
                this.vars.set(name, paramType);
            }
            let start = `${this.compileType(type.call.returnType)} jv${node.id.name}(long tags, ...) {\n`;
            let out = ['start_args();'];
            for (let [name, paramType] of type.call.params) {
                out.push(`get_arg(${this.compileType(paramType)}, jv${name});`);
            }
            if (type.call.restParam !== null) {
                out.push(`get_rest_arg(jv${type.call.restParam[0]});`);
            }
            out.push('end_args();');
            for (let statement of node.body.body) {
                out.push(...this.compileStatement(statement).split('\n'));
            }
            this.popScope();
            this.vars.set(node.id.name, type);
            return start + out.map(line => '    ' + line).join('\n') + '\n}\n' + `jo${node.id.name} = create_object(jvFunction, 1, "prototype", create_object(jvObject, 1, "constructor", jv${node.id.name}))`;
        } else if (node.type === 'TypeAlias') {
            this.error('SyntaxError', 'Flow is not supported');
        } else if (node.type === 'ClassDeclaration') {
            this.pushScope();
            if (node.typeParameters !== null) {

            }
            let constructor: bt.FunctionDeclaration | null;
            let body: (bt.ObjectMethod | bt.ObjectProperty)[];
            for (let prop of node.body.body) {
                
            }
            if (node.superClass !== null) {

            }
            this.popScope();
            this.error('SyntaxError', 'Classes are not supported');
        } else {
            this.astNodeTypeError(node, 'compileStatement');
        }
    }

    hoistDeclarations(nodes: bt.Statement[]): [string, bt.Statement[]] {
        let out: string[] = [];
        let stmts: bt.Statement[] = [];
        for (let node of nodes) {
            if (node.type === 'VariableDeclaration') {
                for (let decl of node.declarations) {
                    out.push(this.compileAssignment(decl.id, '', t.undefined, true, true).split(' =')[0] + ';');
                }
                stmts.push(node);
            } else if (node.type === 'FunctionDeclaration') {
                out.push(this.compileType(this.getFunctionType(node)));
                stmts.push(node);
            } else if (node.type === 'TSTypeAliasDeclaration') {
                this.pushScope();
                if (node.typeParameters) {
                    this.parseTypeParameters(node.typeParameters, true);
                }
                let parsed = this.parseType(node.typeAnnotation);
                this.popScope();
                this.vars.setType(node.id.name, parsed);
            } else if (node.type === 'TSInterfaceDeclaration') {
                this.pushScope();
                if (node.typeParameters) {
                    this.parseTypeParameters(node.typeParameters, true);
                }
                let parsed = this.parseObjectType(node.body.body);
                this.popScope();
                this.vars.setType(node.id.name, parsed);
            } else {
                stmts.push(node);
            }
        }
        return [out.join('\n'), stmts];
    }

    compile(code: string): string {
        this.code = BUILTIN_CODE + code;
        let funcs: string[] = [];
        let topLevel: string[] = [];
        let topLevelVars: string[] = [];
        let ast = this.parse(code).body;
        let [decls, nodes] = this.hoistDeclarations(ast);
        topLevel.push(decls);
        for (let node of nodes) {
            let code = this.compileStatement(node);
            if (node.type === 'FunctionDeclaration') {
                funcs.push(code);
            } else {
                topLevel.push(code);
            }
        }
        let out = '\n#include "neutrino.c"\n\n'
        if (this.options.includeBuiltins ?? true) {
            if (this.builtinTopLevel.length > 0) {
                out += '\n\n' + this.builtinTopLevel.join('\n');
            }
            out += '\n\n' + COMPILED_BUILTIN_CODE;
        }
        if (topLevelVars.length > 0) {
            out += '\n\n' + topLevelVars.join('\n');
        }
        if (this.anonymousFunctions.length > 0) {
            out += '\n\n' + this.anonymousFunctions.join('\n\n');
            this.anonymousFunctions = [];
        }
        if (funcs.length > 0) {
            out += '\n\n' + funcs.join('\n\n');
        }
        if (topLevel.length > 0 && (this.options.includeMain ?? true)) {
            out += '\n\nint main(int argc, char** argv) {\n';
            for (let lines of topLevel) {
                for (let line of lines.split('\n')) {
                    out += '    ' + line + '\n';
                }
            }
            out += '}\n';
        }
        return out;
    }

}


const COMPILED_BUILTIN_CODE = (new Compiler(BUILTIN_OPTIONS)).compile(BUILTIN_CODE);
