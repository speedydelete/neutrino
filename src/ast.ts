
import type * as bt from '@babel/types';
import {SourceData} from './errors';
import t, {Type} from './types';


export interface BaseNode {
    type: string;
    src: SourceData;
    t: Type;
}

export interface SpreadElement extends BaseNode {
    type: 'SpreadElement';
    argument: LValue;
}

export interface Function extends BaseNode {
    generator: boolean;
    async: boolean;
    id: Identifier | null;
    params: (LValue | SpreadElement)[];
    body: Statement[];
}


export interface Identifier extends BaseNode {
    type: 'Identifier';
    name: string;
}

export interface NullLiteral extends BaseNode {
    type: 'NullLiteral';
}

export interface BooleanLiteral extends BaseNode {
    type: 'BooleanLiteral'
    value: boolean;
}

export interface StringLiteral extends BaseNode {
    type: 'StringLiteral'
    value: string;
}

export interface NumberLiteral extends BaseNode {
    type: 'NumberLiteral'
    value: number;
}

export interface BigIntLiteral extends BaseNode {
    type: 'BigIntLiteral';
    value: bigint;
}

export interface RegExpLiteral extends BaseNode {
    type: 'RegExpLiteral';
    pattern: string;
    flags: string;
}

export interface ArrayLiteral extends BaseNode {
    type: 'ArrayLiteral';
    elts: [Expression | null | SpreadElement][];
}

export interface ObjectMember<Computed extends boolean = boolean> extends BaseNode {
    computed: Computed;
    key: Computed extends true ? Expression : Identifier;
}

export interface ObjectProperty<Computed extends boolean = boolean> extends ObjectMember<Computed> {
    type: 'ObjectProperty';
    value: Expression;
}

export interface ObjectMethod<Computed extends boolean = boolean> extends ObjectMember<Computed>, Function {
    type: 'ObjectMethod';
    kind: 'get' | 'set' | 'method';
}

export interface ObjectLiteral extends BaseNode {
    type: 'ObjectLiteral';
    props: [ObjectProperty | ObjectMethod | SpreadElement][];
}

export interface TemplateLiteral extends BaseNode {
    type: 'TemplateLiteral';
    parts: string[];
    exprs: Expression[];
    tag?: Expression;
}

export type Literal = NullLiteral | BooleanLiteral | StringLiteral | NumberLiteral | BigIntLiteral | RegExpLiteral | ArrayLiteral | ObjectLiteral | TemplateLiteral;

export type UnaryOperator = '-' | '+' | '!' | '~' | 'typeof' | 'void' | 'delete' | '++' | '--';
export interface UnaryExpression extends BaseNode {
    type: 'UnaryExpression';
    operator: UnaryOperator;
    prefix: boolean;
}

export type BinaryOperator = '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%' | '**' | '&' | '|' | '^' | '<<' | '>>' | '>>>' | '&&' | '||' | 'in' | 'instanceof' | ',';
export interface BinaryExpression extends BaseNode {
    type: 'BinaryExpression';
    left: Expression;
    right: Expression;
    op: BinaryOperator;
}

export interface AssignmentExpression extends BaseNode {
    type: 'AssignmentExpression';
    left: LValue;
    right: Expression;
}

export interface ConditionalExpression extends BaseNode {
    type: 'ConditionalExpression';
    test: Expression;
    true: Expression;
    false: Expression;
}

export interface PropertyExpression<Computed extends boolean = boolean> extends BaseNode {
    object: Expression;
    computed: Computed;
    property: Computed extends true ? Expression : Identifier;
    optional: boolean;
}

export interface CallExpression extends BaseNode {
    type: 'CallExpression';
    func: Expression;
    args: (Expression | SpreadElement)[];
    optional: boolean;
}

export interface NewExpression extends BaseNode {
    type: 'NewExpression';
    class: Expression;
    args: (Expression | SpreadElement)[];
}

export interface ThisExpression extends BaseNode {
    type: 'ThisExpression';
}

export interface FunctionExpression extends Function {
    type: 'FunctionExpression';
}

export type Expression = Identifier | Literal | UnaryExpression | BinaryExpression | AssignmentExpression | ConditionalExpression | PropertyExpression | CallExpression | NewExpression | ThisExpression | FunctionExpression;


export interface RestElement extends BaseNode {
    type: 'RestElement';
    argument: Pattern;
}

export interface DefaultPattern extends BaseNode {
    type: 'DefaultPattern';
    value: Pattern;
    default: Expression;
}

export interface ObjectPatternProperty extends BaseNode {
    type: 'ObjectPatternProperty';
    value: Pattern;
    key?: string;
}

export interface ObjectPattern extends BaseNode {
    type: 'ObjectPattern';
    props: (ObjectPatternProperty | SpreadElement)[];
}

export interface ArrayPattern extends BaseNode {
    type: 'ArrayPattern';
    elts: (Pattern | SpreadElement)[];
}

export type Pattern = Identifier | DefaultPattern | ObjectPattern | ArrayPattern;

export type LValue = Pattern | PropertyExpression;



export interface EmptyStatement extends BaseNode {
    type: 'EmptyStatement';
}

export interface BlockStatement extends BaseNode {
    type: 'BlockStatement';
    body: Statement[];
}

export interface LabeledStatement extends BaseNode {
    type: 'LabeledStatement';
    label: string;
}

export interface ExpressionStatement extends BaseNode {
    type: 'ExpressionStatement';
    expression: Expression;
}

export interface VariableDeclarator extends BaseNode {
    type: 'VariableDeclarator';
    name: LValue;
    value: Expression | null;
}

export interface VariableDeclaration extends BaseNode {
    type: 'VariableDeclaration';
    kind: 'var' | 'let' | 'const';
    vars: VariableDeclarator[];
}

export interface IfStatement extends BaseNode {
    type: 'IfStatement';
    test: Expression;
    true: Statement;
    else: Statement | null;
}

export interface SwitchCase extends BaseNode {
    type: 'SwitchCase';
    test: Expression | null;
    body: Statement[];
}

export interface SwitchStatement extends BaseNode {
    type: 'SwitchStatement';
    test: Expression;
    cases: SwitchCase[];
}

export interface WhileStatement extends BaseNode {
    type: 'WhileStatement';
    test: Expression;
    body: Statement;
}

export interface DoWhileStatement extends BaseNode {
    type: 'DoWhileStatement';
    body: Statement;
    test: Expression;
}

export interface ForStatement extends BaseNode {
    type: 'ForStatement';
    init: VariableDeclaration | Expression;
    test: Expression;
    update: Expression;
    body: Statement;
}

export interface ForInStatement extends BaseNode {
    type: 'ForInStatement';
    left: VariableDeclaration | Expression;
    right: Expression;
    body: Statement;
}

export interface ForOfStatement extends BaseNode {
    type: 'ForOfStatement';
    left: VariableDeclaration | Expression;
    right: Expression;
    body: Statement;
}

export interface BreakStatement extends BaseNode {
    type: 'BreakStatement';
    label: string | null;
}

export interface ContinueStatement extends BaseNode {
    type: 'BreakStatement';
    label: string | null;
}

export interface FunctionDeclaration extends Function {
    type: 'FunctionDeclaration';
    id: Identifier;
}

export interface ReturnStatement extends BaseNode {
    type: 'ReturnStatement';
    value: Expression | null;
}

export interface DebuggerStatement extends BaseNode {
    type: 'DebuggerStatement';
}

export interface WithStatement extends BaseNode {
    type: 'WithStatement';
    object: Expression;
    body: Statement[];
}

export type Statement = EmptyStatement | BlockStatement | LabeledStatement | ExpressionStatement | VariableDeclaration | IfStatement | SwitchStatement | WhileStatement | DoWhileStatement | ForStatement | ForInStatement | ForOfStatement | FunctionDeclaration | ReturnStatement | DebuggerStatement | WithStatement;


export type Node = Expression | LValue | Statement | ObjectProperty | ObjectMethod | ObjectPatternProperty | VariableDeclarator | SwitchCase;
