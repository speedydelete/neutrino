
import {SourceData, CompilerError} from './errors';
import * as t from './types';
import {Type, matches} from './types';


export class Scope {

    parent: Scope | null;
    vars: Map<string, Type> = new Map();
    types: Map<string, Type> = new Map();

    constructor(parent?: Scope | null) {
        this.parent = parent ?? null;
    }

    get(name: string, src: SourceData): Type {
        let type = this.vars.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.get(name, src);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, src);
        }
    }

    has(name: string): boolean {
        return this.vars.has(name) || (this.parent ? this.parent.has(name) : false);
    }

    set(name: string, type: Type): void {
        this.vars.set(name, type);
    }

    getType(name: string, src: SourceData): Type {
        let type = this.types.get(name);
        if (type !== undefined) {
            return type;
        } else if (this.parent) {
            return this.parent.getType(name, src);
        } else {
            throw new CompilerError('ReferenceError', `${name} is not defined`, src);
        }
    }

    hasType(name: string): boolean {
        return this.types.has(name) || (this.parent ? this.parent.hasType(name) : false);
    }

    setType(name: string, type: Type): void {
        this.types.set(name, type);
    }

    isShadowed(name: string, type: boolean = false): boolean {
        let scope: Scope | null = this;
        let wasFound = false;
        while (scope) {
            let vars = type ? scope.vars : scope.types;
            if (vars.has(name)) {
                if (wasFound) {
                    return true;
                } else {
                    wasFound = true;
                }
            }
            scope = scope.parent;
        }
        return false;
    }

}


export interface BaseNode<T extends string = string> {
    type: T;
    src: SourceData;
}

export interface Function<T extends string = string> extends BaseNode<T> {
    params: [LValue, Type][];
    restParam: [LValue, t.Array] | null;
    body: Statement[] | Expression;
    returnType: Type;
    scope: Scope;
}

export interface Program extends BaseNode<'Program'> {
    scope: Scope;
    body: Statement[];
}

export interface BaseExpression<T extends string = string> extends BaseNode<T> {
    resultType: Type;
}

export interface Identifier extends BaseExpression<'Identifier'> {
    name: string;
}

export interface NullLiteral extends BaseExpression<'NullLiteral'> {
}

export interface BooleanLiteral extends BaseExpression<'BooleanLiteral'> {
    value: boolean;
}

export interface NumberLiteral extends BaseExpression<'NumberLiteral'> {
    value: number;
}

export interface StringLiteral extends BaseExpression<'StringLiteral'> {
    value: string;
}

export interface BigIntLiteral extends BaseExpression<'BigIntLiteral'> {
    value: bigint;
}

export interface SpreadElement extends BaseExpression<'SpreadElement'> {
    argument: Expression;
}

export interface ArrayLiteral extends BaseExpression<'ArrayLiteral'> {
    elts: (Expression | null | SpreadElement)[];
}

export interface ObjectMember<T extends string = string, Computed extends boolean = boolean> extends BaseNode<T> {
    computed: Computed;
    key: Computed extends true ? Expression : Identifier;
}

export interface ObjectProperty<Computed extends boolean = boolean> extends ObjectMember<'ObjectProperty', Computed> {
    value: Expression;
}

export interface ObjectMethod<Computed extends boolean = boolean> extends ObjectMember<'ObjectMethod', Computed>, Function<'ObjectMethod'> {
    kind: 'get' | 'set' | 'method';
}

export interface ObjectLiteral extends BaseExpression<'ObjectLiteral'> {
    props: (ObjectProperty | ObjectMethod | SpreadElement)[];
}

export interface TemplateLiteral extends BaseExpression<'TemplateLiteral'> {
    parts: {raw: string, cooked: string}[];
    exprs: Expression[];
    tag?: Expression;
}


export interface RegExpLiteral extends BaseExpression<'RegExpLiteral'> {
    pattern: string;
    flags: string;
}

export type Literal = NullLiteral | BooleanLiteral | NumberLiteral | StringLiteral | BigIntLiteral | ArrayLiteral | ObjectLiteral | TemplateLiteral | RegExpLiteral;

export interface ParenthesizedExpression extends BaseExpression<'ParenthesizedExpression'> {
    expr: Expression;
}

export type UnaryOperator = '-' | '+' | '!' | '~' | 'typeof' | 'void' | 'delete' | '++' | '--' | 'throw' | '*' | '&';
export interface UnaryExpression extends BaseExpression<'UnaryExpression'> {
    op: UnaryOperator;
    arg: Expression;
    postfix: boolean;
}

export type BinaryOperator = '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%' | '**' | '&' | '|' | '^' | '<<' | '>>' | '>>>' | '&&' | '||' | '??' | 'in' | 'instanceof' | ',';
export interface BinaryExpression extends BaseExpression<'BinaryExpression'> {
    left: Expression;
    right: Expression;
    op: BinaryOperator;
}

export type AssignmentOperator = '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '**=' | '<<=' | '>>=' | '>>=' | '|=' | '^=' | '&=' | '||=' | '&&=' | '??=';
export interface AssignmentExpression extends BaseExpression<'AssignmentExpression'> {
    left: LValue;
    right: Expression;
    op: AssignmentOperator;
}

export interface ConditionalExpression extends BaseExpression<'ConditionalExpression'> {
    test: Expression;
    true: Expression;
    false: Expression;
}

export interface PropertyExpression<Computed extends boolean = boolean> extends BaseExpression<'PropertyExpression'> {
    object: Expression;
    computed: Computed;
    property: Computed extends true ? Expression : Identifier;
    optional: boolean;
}

export interface CallExpression extends BaseExpression<'CallExpression'> {
    func: Expression;
    args: (Expression | SpreadElement)[];
    optional: boolean;
}

export interface ImportExpression extends BaseExpression<'ImportExpression'> {
    module: Expression;
    options?: Expression;
}

export interface NewExpression extends BaseExpression<'NewExpression'> {
    class: Expression;
    args: (Expression | SpreadElement)[];
}

export interface ThisExpression extends BaseExpression<'ThisExpression'> {
}

export interface FunctionExpression extends Function<'FunctionExpression'>, BaseExpression<'FunctionExpression'> {
    id: Identifier | null;
}

export interface ArrowFunctionExpression extends Function<'ArrowFunctionExpression'>, BaseExpression<'ArrowFunctionExpression'> {
}

export interface AsExpression extends BaseExpression<'AsExpression'> {
    value: Expression;
    newType: Type;
}

export type Expression = Identifier | Literal | ParenthesizedExpression | UnaryExpression | BinaryExpression | AssignmentExpression | ConditionalExpression | PropertyExpression | CallExpression | ImportExpression | NewExpression | ThisExpression | FunctionExpression | AsExpression;

export interface RestElement extends BaseNode<'RestElement'> {
    argument: LValue;
}

export interface DefaultPattern extends BaseNode<'DefaultPattern'> {
    value: LValue;
    default: Expression;
}

export interface ArrayPattern extends BaseNode<'ArrayPattern'> {
    elts: (Pattern | RestElement | null)[];
}

export interface ObjectPatternProperty extends BaseNode<'ObjectPatternProperty'> {
    key: string;
    value?: Pattern;
}

export interface ObjectPattern extends BaseNode<'ObjectPattern'> {
    props: (ObjectPatternProperty | RestElement)[];
}

export type Pattern = Identifier | DefaultPattern | ArrayPattern | ObjectPattern;
export type LValue = Pattern | PropertyExpression;

export interface EmptyStatement extends BaseNode<'EmptyStatement'> {
}

export interface BlockStatement extends BaseNode<'BlockStatement'> {
    type: 'BlockStatement';
    body: Statement[];
    scope: Scope;
}

export interface LabeledStatement extends BaseNode<'LabeledStatement'> {
    label: Identifier;
    statement: Statement;
}

export interface LabelStatement extends BaseNode<'LabelStatement'> {
    label: Identifier;
}

export interface ExpressionStatement extends BaseNode<'ExpressionStatement'> {
    expr: Expression;
}

export interface VariableDeclarator extends BaseNode<'VariableDeclarator'> {
    left: LValue;
    value: Expression | null;
    resultType: Type;
}

export interface VariableDeclaration extends BaseNode<'VariableDeclaration'> {
    kind: 'var' | 'let' | 'const';
    vars: VariableDeclarator[];
}

export interface IfStatement extends BaseNode<'IfStatement'> {
    test: Expression;
    true: Statement;
    false: Statement | null;
}

export interface SwitchCase extends BaseNode<'SwitchCase'> {
    test: Expression | null;
    body: Statement[];
}

export interface SwitchStatement extends BaseNode<'SwitchStatement'> {
    type: 'SwitchStatement';
    test: Expression;
    cases: SwitchCase[];
}

export interface WhileStatement extends BaseNode<'WhileStatement'> {
    test: Expression;
    body: Statement;
}

export interface DoWhileStatement extends BaseNode<'DoWhileStatement'> {
    body: Statement;
    test: Expression;
}

export interface ForStatement extends BaseNode<'ForStatement'> {
    type: 'ForStatement';
    init: VariableDeclaration | Expression | null;
    test: Expression | null;
    update: Expression | null;
    body: Statement;
}

export interface ForInStatement extends BaseNode<'ForInStatement'> {
    left: VariableDeclaration | LValue;
    right: Expression;
    body: Statement;
}

export interface ForOfStatement extends BaseNode<'ForOfStatement'> {
    left: VariableDeclaration | LValue;
    right: Expression;
    body: Statement;
}

export interface BreakStatement extends BaseNode<'BreakStatement'> {
    label: Identifier | null;
}

export interface ContinueStatement extends BaseNode<'ContinueStatement'> {
    label: Identifier | null;
}

export interface FunctionDeclaration extends Function<'FunctionDeclaration'> {
    id: Identifier;
}

export interface ReturnStatement extends BaseNode<'ReturnStatement'> {
    value: Expression | null;
}

export interface DebuggerStatement extends BaseNode<'DebuggerStatement'> {
}

export interface WithStatement extends BaseNode<'WithStatement'> {
    object: Expression;
    body: Statement;
}

export type Statement = EmptyStatement | BlockStatement | LabeledStatement | LabelStatement | ExpressionStatement | VariableDeclaration | IfStatement | SwitchStatement | WhileStatement | DoWhileStatement | ForStatement | ForInStatement | ForOfStatement | BreakStatement | ContinueStatement | FunctionDeclaration | ReturnStatement | DebuggerStatement | WithStatement;

export type Node = Program | Expression | LValue | Statement | ObjectProperty | ObjectMethod | ObjectPatternProperty | VariableDeclarator | SwitchCase;


export function getFunctionType(node: Function): Type {
    return t.object({prototype: t.object({})}, {params: node.params.map(([name, type]) => [name.type === 'Identifier' ? name.name : '__destructured__', type]), restParam: node.restParam ? [node.restParam[0].type === 'Identifier' ? node.restParam[0].name : '__destructured__', node.restParam[1]] : null, returnType: node.returnType});
}

export function addFunctionType<T extends Function>(node: T): T & {resultType: Type} {
    return Object.assign(node, {resultType: getFunctionType(node)});
}


export class NodeGenerator {

    src: SourceData = {raw: '', file: '', line: -1, col: -1};
    scope: Scope = new Scope();
    thisType: Type = t.never;

    error(type: string, message: string): never {
        throw new CompilerError(type, message, this.src);
    }

    getVar(name: string): Type {
        return this.scope.get(name, this.src);
    }

    setVar(name: string, type: Type): void {
        this.scope.set(name, type);
    }

    getTypeVar(name: string): Type {
        return this.scope.getType(name, this.src);
    }

    setTypeVar(name: string, type: Type): void {
        this.scope.setType(name, type);
    }

    isShadowed(name: string): boolean {
        return this.scope.isShadowed(name);
    }

    isTypeShadowed(name: string): boolean {
        return this.scope.isShadowed(name, true);
    }

    setLValue(value: LValue, type: Type): void {
        if (value.type === 'Identifier') {
            this.setVar(value.name, type);
        } else if (value.type === 'DefaultPattern') {
            if (type.type === 'undefined') {
                this.setLValue(value.value, value.default.resultType);
            } else if (matches(type, t.undefined)) {
                this.setLValue(value.value, t.union(type, value.default.resultType));
            } else {
                this.setLValue(value.value, type);
            }
        } else if (value.type === 'ArrayPattern') {
            if (!t.isArray(type)) {
                this.error('TypeError', `Object of type ${type} is not constructible`);
            }
            for (let i = 0; i < value.elts.length; i++) {
                let node = value.elts[i];
                if (!node) {
                    continue;
                } else if (node.type === 'RestElement') {
                    if (type.elts instanceof Array) {
                        this.setLValue(node.argument, t.array(type.elts.slice(i)));
                    } else {
                        this.setLValue(node.argument, type);
                    }
                } else {
                    this.setLValue(node, t.arrayIndex(type, i));
                }
            }
        } else if (value.type === 'ObjectPattern') {
            if (type.type !== 'object') {
                this.error('TypeError', 'Cannot destructure non-object type');
            }
            for (let prop of value.props) {
                if (prop.type === 'RestElement') {
                    this.error('SyntaxError', 'Rest elements are not supported in object destructuring assignments');
                } else {
                    if (!(prop.key in type.props)) {
                        this.error('TypeError', `Key ${prop.key} does not exist in type ${type}`);
                    }
                    // @ts-ignore
                    this.setLValue(prop.value ?? this.createIdentifier(prop.key), type.props[prop.key]);
                }
            }
        } else {
            this.error('NeutrinoBugError', `Unrecognized AST node type in NodeGenerator.setLValue: ${value.type}`);
        }
    }

    pushScope(): void {
        this.scope = new Scope(this.scope);
    }

    popScope(): void {
        if (!this.scope.parent) {
            this.error('NeutrinoBugError', 'No scope parent');
        }
        this.scope = this.scope.parent;
    }

    _create<T extends {}, Type extends string>(type: Type, data: T): {type: Type, src: SourceData} & T {
        return {type, src: this.src, ...data};
    }

    createProgram(body: Statement[]): Program {
        return this._create('Program', {body, scope: this.scope});
    }

    createIdentifier(name: string, type: boolean | Type = false): Identifier {
        let resultType = typeof type === 'boolean' ? (type ? this.getTypeVar(name) : this.getVar(name)) : type;
        return this._create('Identifier', {name: name, resultType});
    }

    createNullLiteral(): NullLiteral {
        return this._create('NullLiteral', {resultType: t.null});
    }

    createBooleanLiteral(value: boolean): BooleanLiteral {
        return this._create('BooleanLiteral', {value, resultType: t.boolean(value)});
    }

    createNumberLiteral(value: number): NumberLiteral {
        return this._create('NumberLiteral', {value, resultType: t.number(value)});
    }

    createStringLiteral(value: string): StringLiteral {
        return this._create('StringLiteral', {value, resultType: t.string(value)});
    }

    createBigIntLiteral(value: bigint): BigIntLiteral {
        return this._create('BigIntLiteral', {value, resultType: t.bigint(value)});
    }

    createSpreadElement(argument: Expression): SpreadElement {
        if (!('isArray' in argument.resultType)) {
            this.error('TypeError', `Type ${argument.resultType} is not spreadable`)
        }
        return this._create('SpreadElement', {argument, resultType: argument.resultType});
    }

    createArrayLiteral(elts: (Expression | null | SpreadElement)[]): ArrayLiteral {
        let data = [];
        let union = t.union();
        let isTuple = true;
        for (let elt of elts) {
            if (elt === null) {
                data.push(t.undefined);
                union.types.push(t.undefined);
            } else if (elt.type === 'SpreadElement') {
                if (!('isArray' in elt.resultType) ){
                    this.error('NeutrinoBugError', 'Non-iterable argument of SpreadElement');
                }
                let elts = elt.resultType.elts;
                if (Array.isArray(elts)) {
                    data.push(...elts);
                    union.types.push(...elts);
                } else {
                    isTuple = false;
                    union.types.push(elts);
                }
            }
        }
        let resultType = t.array(isTuple ? data : union);
        return this._create('ArrayLiteral', {elts, resultType});
    }

    createObjectProperty<Computed extends boolean>(computed: Computed, key: Computed extends true ? Expression : Identifier, value: Expression): ObjectProperty<Computed> {
        return this._create('ObjectProperty', {key, value, computed});
    }

    seperateParams(params: [LValue | RestElement, Type][]): {params: [LValue, Type][], restParam: [LValue, t.Array] | null} {
        let newParams: [LValue, Type][] = [];
        let restParam: [LValue, t.Array] | null = null;
        for (let [lvalue, type] of params) {
            if (lvalue.type === 'RestElement') {
                if (restParam !== null) {
                    this.error('SyntaxError', 'Cannot have more than 1 rest parameter');
                }
                if (!('isArray' in type)) {
                    this.error('TypeErrror', 'A rest parameter must have an array type');
                }
                restParam = [lvalue.argument, type];
            } else {
                newParams.push([lvalue, type]);
            }
        }
        return {params: newParams, restParam};
    }

    createObjectMethod<Computed extends boolean>(computed: Computed, key: Computed extends true ? Expression : Identifier, kind: 'get' | 'set' | 'method', params: [Pattern | RestElement, Type][], body: Statement[] | Expression, returnType: Type, scope?: Scope): ObjectMethod {
        return this._create('ObjectMethod', {key, computed, kind, body, returnType, scope: scope ?? this.scope, ...this.seperateParams(params)});
    }

    createObjectLiteral(props: (ObjectProperty | ObjectMethod | SpreadElement)[]): ObjectLiteral {
        let resultType = t.object({});
        for (let prop of props) {
            if (prop.type === 'ObjectProperty') {
                if (prop.computed) {
                    continue;
                }
                resultType.props[(prop.key as Identifier).name] = prop.value.resultType;
            } else if (prop.type === 'ObjectMethod') {
                resultType.props[(prop.key as Identifier).name] = t.function(prop.params.map(param => {
                    if (param[0].type === 'Identifier') {
                        return [param[0].name, param[1]];
                    } else {
                        return ['_destructured', param[1]];
                    }
                }), prop.returnType);
            }
        }
        return this._create('ObjectLiteral', {props, resultType});
    }

    createTemplateLiteral(parts: {raw: string, cooked: string}[], exprs: Expression[], tag?: Expression | null): TemplateLiteral {
        let resultType: Type = t.string;
        if (tag) {
            if (tag.resultType.type !== 'object' || tag.resultType.call === null) {
                this.error('TypeError', `Cannot use value of type ${tag.resultType} as a template tag`);
            }
            resultType = tag.resultType;
        }
        return this._create('TemplateLiteral', {parts, exprs, tag: tag ?? undefined, resultType});
    }

    createRegExpLiteral(pattern: string, flags?: string): RegExpLiteral {
        return this._create('RegExpLiteral', {pattern, flags: flags ?? '', resultType: this.getVar('RegExp')});
    }

    createParenthesizedExpression(expr: Expression): ParenthesizedExpression {
        return this._create('ParenthesizedExpression', {expr, resultType: expr.resultType});
    }

    typeofOperator(type: Type): Type {
        if (type.type === 'any' || type.type === 'unknown' || type.type === 'never') {
            return t.union(t.string('undefined'), t.string('object'), t.string('boolean'), t.string('number'), t.string('string'), t.string('symbol'), t.string('bigint'));
        } else if (type.type === 'union') {
            return t.union(...type.types.map(this.typeofOperator));
        } else if (type.type === 'undefined' || type.type === 'void') {
            return t.string('undefined');
        } else if (type.type === 'boolean') {
            return t.string('boolean');
        } else if (type.type === 'number') {
            return t.string('number');
        } else if (type.type === 'string') {
            return t.string('string');
        } else if (type.type === 'symbol') {
            return t.string('symbol');
        } else if (type.type === 'bigint') {
            return t.string('bigint');
        } else if (type.type === 'null' || type.type === 'object' || type.type === 'intersection') {
            return t.string('object');
        } else {
            this.error('NeutrinoBugError', 'Invalid type');
        }
    }

    createUnaryExpression(op: UnaryOperator, arg: Expression, postfix: boolean = false): UnaryExpression {
        let type: Type;
        if (op === 'typeof') {
            type = this.typeofOperator(arg.resultType);
        } else if (op === 'delete' || op === '!') {
            type = t.boolean;
        } else if (op === 'void') {
            type = t.undefined;
        } else if (arg.resultType.type === 'bigint') {
            type = t.bigint;
        } else {
            type = t.number;
        }
        return this._create('UnaryExpression', {op, arg, postfix, resultType: type});
    }

    createBinaryExpression(left: Expression, op: BinaryOperator, right: Expression): BinaryExpression {
        let type: Type;
        if (op === '==' || op === '!=' || op === '===' || op === '!==' || op === '<' || op === '<=' || op === '>' || op === '>=' || op === 'in' || op === 'instanceof') {
            type = t.boolean;
        } else if (op === '&&' || op === '||') {
            type = t.union(left.resultType, right.resultType);
        } else if (left.resultType.type === 'bigint') {
            type = t.bigint;
        } else {
            type = t.number;
        }
        return this._create('BinaryExpression', {op, left, right, resultType: type});
    }

    createAssignmentExpression(left: LValue, op: AssignmentOperator, value: Expression): AssignmentExpression {
        return this._create('AssignmentExpression', {left, right: value, op, resultType: value.resultType});
    }

    createConditionalExpression(test: Expression, trueExpr: Expression, falseExpr: Expression): ConditionalExpression {
        return this._create('ConditionalExpression', {test, true: trueExpr, false: falseExpr, resultType: t.union(trueExpr.resultType, falseExpr.resultType)});
    }

    createPropertyExpression<Computed extends boolean>(obj: Expression, computed: Computed, prop: Computed extends true ? Expression : Identifier, optional: boolean = false): PropertyExpression {
        if (obj.resultType.type !== 'object') {
            this.error('TypeError', `Value of type ${obj.resultType} is not an object`);
        }
        if (!('props' in obj.resultType)) {
            this.error('TypeError', `Value of type ${obj.resultType} does not have properties`);
        }
        let resultType: Type | null = null;
        if (prop.type === 'Identifier') {
            // @ts-ignore
            if (obj.resultType.props[prop.name] === undefined) {
                this.error('TypeError', `Property ${prop.name} does not exist on type ${obj.resultType}`);
            }
            // @ts-ignore
            resultType = this.getVar(obj.resultType.props[prop.name]);
        } else {
            if (obj.resultType.indexes.length === 0) {
                this.error('TypeError', `Cannot access computed property on ${obj.resultType} because it does not have an index signature`);
            }
            for (let [_, key, value] of obj.resultType.indexes) {
                if (matches(prop.resultType, key)) {
                    resultType = value;
                }
            }
            if (resultType === null) {
                this.error('TypeError', `No compatible index signature found in ${obj.resultType} with ${prop.resultType}`);
            }
        }
        return this._create('PropertyExpression', {object: obj, property: prop, computed, optional, resultType});
    }

    createCallExpression(func: Expression, args: (Expression | SpreadElement)[], optional: boolean = false): CallExpression {
        if (func.resultType.type !== 'object' || func.resultType.call === null || typeof func.resultType.call === 'function') {
            this.error('TypeError', `Value of type ${func.resultType} is not callable`);
        }
        let call = func.resultType.call;
        for (let i = 0; i < args.length; i++) {
            let arg = args[i];
            if (arg.type === 'SpreadElement') {
                if (i !== args.length - 1) {
                    this.error('SyntaxError', 'A spread argument must be the last argument');
                } else {
                    if (!call.restParam) {
                        this.error('SyntaxError', 'No rest parameter for spread argument');
                    }
                    if (!matches(arg.resultType, call.restParam[1])) {
                        this.error('SyntaxError', `Spread argument of type ${arg.resultType} cannot be assigned to rest parameter of type ${call.restParam[1]}`);
                    }
                }
            }
            if (!matches(arg.resultType, call.params[i][1])) {
                this.error('TypeError', `Unable to pass argument of type ${arg.resultType} to parameter of type ${call.params[i][1]}`)
            }
        }
        return this._create('CallExpression', {func, args, optional, resultType: func.resultType.call.returnType});
    }

    createImportExpression(module: Expression, options?: Expression): ImportExpression {
        return this._create('ImportExpression', {module, options, resultType: t.import(module.resultType)});
    }

    createNewExpression(cls: Expression, args: (Expression | SpreadElement)[]): NewExpression {
        return Object.assign(this.createCallExpression(cls, args, false), {type: 'NewExpression' as const, class: cls});
    }

    createThisExpression(): ThisExpression {
        return this._create('ThisExpression', {resultType: this.thisType});
    }

    createFunctionExpression(id: Identifier | null, params: [Pattern | RestElement, Type][], body: Statement[], returnType: Type, scope?: Scope): FunctionExpression {
        return addFunctionType(this._create('FunctionExpression', {id, body, returnType, scope: scope ?? this.scope, ...this.seperateParams(params)}));
    }

    createArrowFunctionExpression(params: [Pattern | RestElement, Type][], body: Expression | Statement[], returnType: Type, scope?: Scope): ArrowFunctionExpression {
        return addFunctionType(this._create('ArrowFunctionExpression', {body, returnType, scope: scope ?? this.scope, ...this.seperateParams(params)}));
    }

    createAsExpression(value: Expression, type: Type): AsExpression {
        return this._create('AsExpression', {value, newType: type, resultType: type});
    }

    createRestElement(argument: LValue): RestElement {
        return this._create('RestElement', {argument});
    }

    createDefaultPattern(value: LValue, defaultValue: Expression): DefaultPattern {
        return this._create('DefaultPattern', {value, default: defaultValue});
    }

    createArrayPattern(elts: (Pattern | RestElement | null)[]): ArrayPattern {
        return this._create('ArrayPattern', {elts});
    }

    createObjectPatternProperty(key: string, value?: Pattern): ObjectPatternProperty {
        return this._create('ObjectPatternProperty', {key, value});
    }

    createObjectPattern(props: ObjectPatternProperty[]): ObjectPattern {
        return this._create('ObjectPattern', {props});
    }

    createEmptyStatement(): EmptyStatement {
        return this._create('EmptyStatement', {});
    }

    createBlockStatement(body: Statement[]): BlockStatement {
        return this._create('BlockStatement', {body, scope: this.scope});
    }

    createLabeledStatement(label: Identifier, statement: Statement): LabeledStatement {
        return this._create('LabeledStatement', {label, statement});
    }

    createLabelStatement(label: Identifier): LabelStatement {
        return this._create('LabelStatement', {label});
    }

    createExpressionStatement(expr: Expression): ExpressionStatement {
        return this._create('ExpressionStatement', {expr});
    }

    createVariableDeclarator(left: LValue, value: Expression, type?: Type | null): VariableDeclarator;
    createVariableDeclarator(left: LValue, value: Expression | null, type: Type): VariableDeclarator;
    createVariableDeclarator(left: LValue, value: Expression | null, type?: Type | null): VariableDeclarator {
        if (value) {
            this.setLValue(left, value.resultType);
        }
        // @ts-ignore
        return this._create('VariableDeclarator', {left, value, resultType: type ?? (value ? value.resultType : type)});
    }

    createVariableDeclaration(kind: 'var' | 'let' | 'const', vars: VariableDeclarator[]): VariableDeclaration {
        return this._create('VariableDeclaration', {kind, vars});
    }

    createIfStatement(test: Expression, true_: Statement, false_?: Statement | null): IfStatement {
        return this._create('IfStatement', {test, true: true_, false: false_ ?? null});
    }

    createSwitchCase(test: Expression | null, body: Statement[]): SwitchCase {
        return this._create('SwitchCase', {test, body});
    }

    createSwitchStatement(test: Expression, cases: SwitchCase[]): SwitchStatement {
        return this._create('SwitchStatement', {test, cases});
    }

    createWhileStatement(test: Expression, body: Statement): WhileStatement {
        return this._create('WhileStatement', {test, body});
    }

    createDoWhileStatement(body: Statement, test: Expression): DoWhileStatement {
        return this._create('DoWhileStatement', {body, test});
    }

    createForStatement(init: Expression | VariableDeclaration | null, test: Expression | null, update: Expression | null, body: Statement): ForStatement {
        return this._create('ForStatement', {init, test, update, body});
    }

    createForInStatement(left: VariableDeclaration | LValue, right: Expression, body: Statement): ForInStatement {
        return this._create('ForInStatement', {left, right, body});
    }

    createForOfStatement(left: VariableDeclaration | LValue, right: Expression, body: Statement): ForOfStatement {
        return this._create('ForOfStatement', {left, right, body});
    }

    createBreakStatement(label?: Identifier | null): BreakStatement {
        return this._create('BreakStatement', {label: label ?? null});
    }

    createContinueStatement(label?: Identifier | null): ContinueStatement {
        return this._create('ContinueStatement', {label: label ?? null});
    }

    createFunctionDeclaration(id: Identifier, params: [Pattern | RestElement, Type][], body: Statement[] | Expression, returnType: Type, scope: Scope) {
        return this._create('FunctionDeclaration', {id, body, returnType, scope: scope ?? this.scope, ...this.seperateParams(params)});
    }

    createReturnStatement(value?: Expression | null): ReturnStatement {
        return this._create('ReturnStatement', {value: value ?? null});
    }

    createDebuggerStatement(): DebuggerStatement {
        return this._create('DebuggerStatement', {});
    }

    createWithStatement(object: Expression, body: Statement): WithStatement {
        return this._create('WithStatement', {object, body});
    }

}
