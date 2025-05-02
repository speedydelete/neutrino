
import * as a from './ast';
import * as t from './types';
import {Type} from './types';


export type Language = 'js' | 'ts' | 'c';

export const LANGS: {[K in Language]: string} = {
    js: 'JavaScript',
    ts: 'TypeScript',
    c: 'C',
};

export const UNARY_OP_FUNCS: {[K in Exclude<a.UnaryOperator, 'void' | 'throw' | 'delete'>]: string} = {
    '-': 'minus',
    '+': 'plus',
    '!': 'not',
    '~': 'lnot',
    typeof: 'js_typeof',
    '++': 'inc',
    '--': 'dec',
    '*': 'deref',
    '&': 'ref',
};

export const BINARY_OP_FUNCS: {[K in Exclude<a.BinaryOperator, ','>]: string} = {
    '==': 'eq',
    '!=': 'neq',
    '===': 'seq',
    '!==': 'nseq',
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
    '&&': 'land',
    '||': 'lor',
    '??': 'nc',
    'in': 'in',
    'instanceof': 'instanceof',
};


export class Generator extends a.NodeGenerator {

    lang: Language;
    pretty: boolean;

    constructor(lang: Language = 'js', pretty: boolean = false) {
        super();
        this.lang = lang;
        this.pretty = pretty;
    }

    indent(code: string): string {
        return this.pretty ? code.split('\n').map(x => '    ' + x).join('\n') : code;
    }

    escapeString(str: string, quote?: string): string {
        quote ??= this.lang === 'c' ? '"' : "'";
        // @ts-ignore
        return quote + str.replaceAll(quote, '\\"').replaceAll('\xa0', '\\xa0') + quote;
    }

    functionParams(node: a.Function): string {
        let out = '(';
        for (let param of node.params) {
            if (this.lang === 'c') {
                out += this.type(param[1]) + ' ';
            }
            out += this.lvalue(param[0]) + ',\xa0';
        }
        if (node.restParam) {
            if (this.lang === 'c') {
                this.error('IncompatibleNodeError', `Rest parameters are not compatible with C`);
            }
            out += '...' + this.lvalue(node.restParam[0]);
        } else {
            out = out.slice(0, -2);
        }
        return out + ')';
    }

    functionBody(node: a.Function): string {
        if (node.body instanceof Array) {
            return '{\n' + this.indent(node.body.map(x => this.statement(x)).join('\n')) + '}';
        } else if (this.lang === 'js') {
            return this.expression(node.body);
        } else {
            return '{return ' + this.expression(node.body) + ';}';
        }
    }

    type(type: Type): string {
        if (this.lang === 'c') {
            let t = type;
            if (t.type === 'any' || t.type === 'unknown' || t.type === 'never' || t.type === 'union') {
                return 'any';
            } else if (t.type === 'void') {
                return 'void';
            } else if (t.type === 'undefined' || t.type === 'null') {
                return 'void*';
            } else if (t.type === 'boolean') {
                return 'bool';
            } else if (t.type === 'number') {
                return 'double';
            } else if (t.type === 'string') {
                return 'char*';
            } else if (t.type === 'symbol') {
                return 'symbol';
            } else if (t.type === 'bigint') {
                return 'bigint';
            } else if (t.type === 'object' || t.type === 'intersection') {
                if ('isArray' in t) {
                    return 'array*';
                } else {
                    return 'object*';
                }
            } else if (t.type === 'import') {
                return 'any';
            } else if (t.type === 'pointer') {
                return this.type(t.value) + '*';
            } else if (t.type === 'array') {
                return this.type(t.elts) + '[' + (t.length ?? '') + ']';
            } else {
                return t.type;
            }
        } else if (this.lang === 'ts') {
            return t.toString(type);
        } else {
            this.error('IncompatibleLanguageError', `Type annotations are not compatible with ${LANGS[this.lang]}`);
        }
    }

    expression(node: a.Expression): string {
        this.src = node.src;
        if (node.type === 'BooleanLiteral') {
            return String(node.value);
        } else if (node.type === 'StringLiteral') {
            return this.escapeString(node.value);
        } else if (node.type === 'ParenthesizedExpression') {
            return '(' + this.expression(node.expr) + ')';
        } else if (this.lang === 'js' || this.lang === 'ts') {
            if (node.type === 'Identifier') {
                return node.name;
            } else if (node.type === 'NullLiteral') {
                return 'null';
            } else if (node.type === 'NumberLiteral') {
                return String(node.value);
            } else if (node.type === 'BigIntLiteral') {
                return String(node.value) + 'n';
            } else if (node.type === 'ArrayLiteral') {
                return '[' + node.elts.map(elt => {
                    if (!elt) {
                        return '';
                    } else if (elt.type === 'SpreadElement') {
                        return '...' + this.expression(elt.argument);
                    } else {
                        return this.expression(node);
                    }
                }).join(',\xa0') + ']';
            } else if (node.type === 'ObjectLiteral') {
                return '{' + node.props.map(prop => {
                    if (prop.type === 'SpreadElement') {
                        return '...' + this.expression(prop.argument);
                    }
                    let out: string;
                    if (prop.computed) {
                        out = '[' + this.expression(prop.key) + ']';
                    } else {
                        out = (prop.key as a.Identifier).name;
                    }
                    if (prop.type === 'ObjectMethod') {
                        out += this.functionParams(prop) + '\xa0' + this.functionBody(prop);
                    } else {
                        out += ':\xa0' + this.expression(prop.value);
                    }
                }).join(',\xa0') + '}';
            } else if (node.type === 'TemplateLiteral') {
                let out = (node.tag ? this.expression(node.tag) : '') + '`';
                for (let i = 0; i < node.exprs.length; i++) {
                    out += node.parts[i] + '${' + this.expression(node.exprs[i]) + '}';
                }
                out += node.parts[node.parts.length - 1];
                return out + '`';
            } else if (node.type === 'RegExpLiteral') {
                return '/' + node.pattern + '/' + node.flags;
            } else if (node.type === 'UnaryExpression') {
                let arg = this.expression(node.arg);
                let op: string = node.op;
                if (op === 'typeof' || op === 'void' || op === 'delete' || op === 'throw') {
                    op += ' ';
                }
                return node.postfix ? op + arg : arg + op;
            } else if (node.type === 'BinaryExpression') {
                return this.expression(node.left) + '\xa0' + node.op + '\xa0' + this.expression(node.right);
            } else if (this.lang === 'ts' && node.type === 'AsExpression') {
                return this.expression(node.value) + ' as ' + this.type(node.newType);
            } else {
                this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
            }
        } else {
            if (node.type === 'NullLiteral') {
                return 'NULL';
            } else if (node.type === 'NumberLiteral') {
                let out = String(node.value);
                if (!out.includes('.')) {
                    out += '.0';
                }
                return out;
            } else if (node.type === 'ArrayLiteral') {
                if (node.elts.length === 0) {
                    return 'create_array(0)';
                } else {
                    return 'create_array_with_items(' + node.elts.length + ',\xa0' + node.elts.map(elt => {
                        if (!elt) {
                            return 'NULL';
                        } else if (elt.type === 'SpreadElement') {
                            this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
                        } else {
                            return this.expression(elt);
                        }
                    }).join(',\xa0') + ')';
                }
            } else if (node.type === 'ObjectLiteral') {
                if (node.props.length === 0) {
                    return 'create_object(0)';
                } else {
                    return 'create_object(' + node.props.length + ',\xa0' + node.props.map(prop => {
                        if (prop.type !== 'ObjectProperty') {
                            this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
                        }
                        return this.expression(prop.key) + ',\xa0' + this.expression(prop.value);
                    }).join(',\xa0') + ')';
                }
            } else if (node.type === 'TemplateLiteral') {
                if (node.tag) {
                    this.error('IncompatibleLanguageError', `Tagged template literals are not compatible with ${LANGS[this.lang]}`);
                }
                // @ts-ignore
                let parts = node.parts.map(part => part.cooked.replaceAll('\n', '\\n'));
                if (parts.length === 1) {
                    return this.escapeString(parts[0]);
                }
                let out = 'strcat(' + this.escapeString(parts[0]) + ',\xa0' + this.expression(node.exprs[0]) + ')';
                for (let i = 1; i < node.exprs.length; i++) {
                    out = 'strcat(strcat(' + out + ',\xa0' + node.parts[i] + '),\xa0' + this.expression(node.exprs[i]) + ')';
                }
                return out;
            } else if (node.type === 'UnaryExpression') {
                let arg = this.expression(node.arg);
                if (node.op === 'void') {
                    return '(' + arg + ',\xa0NULL)';
                } else if (node.op === 'delete') {
                    if (node.arg.type !== 'PropertyExpression') {
                        return '(' + arg + ',\xa0true)';
                    } else {
                        return 'delete(' + this.expression(node.arg.object) + ',\xa0' + this.expression(node.arg.property) + ')';
                    }
                } else if (node.op === 'throw') {
                    this.error('IncompatibleLanguageError', `Throw expressions are not compatible with ${LANGS[this.lang]}`);
                } else {
                    let func = UNARY_OP_FUNCS[node.op];
                    if (node.op === '++' || node.op === '--') {
                        if (node.postfix) {
                            func = 'postfix_' + func;
                        }
                    }
                    return func + '(' + arg + ')';
                }
            } else if (node.type === 'BinaryExpression') {
                let left = this.expression(node.left);
                let right = this.expression(node.right);
                if (node.op === ',') {
                    return left + ',\xa0' + right;
                } else {
                    return BINARY_OP_FUNCS[node.op];
                }
            } else {
                this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
            }
        }
    }

    pattern(node: a.Pattern): string {
        this.src = node.src;
        if (node.type === 'Identifier') {
            return node.name;
        } else if (node.type === 'DefaultPattern') {
            return this.lvalue(node.value) + '\xa0=\xa0' + this.expression(node.default);
        } else if (node.type === 'ArrayPattern') {
            let out = '[';
            for (let elt of node.elts) {
                if (!elt) {
                    out += '';
                } else if (elt.type === 'RestElement') {
                    out += '...' + this.lvalue(elt.argument);
                } else {
                    out += this.pattern(elt);
                }
                out += ',\xa0';
            }
            return out.slice(0, -2) + ']';
        } else if (node.type === 'ObjectPattern') {
            let out = '{';
            for (let prop of node.props) {
                if (prop.type === 'RestElement') {
                    out += '...' + this.lvalue(prop.argument);
                } else if (prop.value) {
                    out += prop.key + ':\xa0' + this.pattern(prop.value);
                } else {
                    out += prop.key;
                }
                out += ',\xa0';
            }
            return out.slice(0, -2) + '}';
        } else {
            // @ts-ignore
            this.error('NeutrinoBugError', `Unrecognized AST node type in Generator.lvalue: ${node.type}`);
        }
    }

    lvalue(node: a.LValue): string {
        this.src = node.src;
        if (this.lang === 'c') {
            if (node.type === 'Identifier') {
                return 'jv_' + node;
            } else {
                this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
            }
        } else if (node.type === 'Identifier') {
            return node.name;
        } else if (node.type === 'PropertyExpression') {
            return this.expression(node);
        } else {
            return this.pattern(node);
        }
    }

    statement(node: a.Statement): string {
        this.src = node.src;
        if (node.type === 'EmptyStatement') {
            return ';\n';
        } else if (node.type === 'BlockStatement') {
            let body = node.body.map(x => this.statement(x)).join('\n');
            return '{\n' + this.indent(body) + '}';
        } else if (node.type === 'ExpressionStatement') {
            return this.expression(node.expr) + ';\n';
        } else if (node.type === 'IfStatement') {
            let out = `if\xa0(` + this.expression(node.test) + ')\xa0' + this.statement(node.true);
            if (node.false) {
                out += '\xa0else\xa0' + this.statement(node.false);
            }
            return out;
        } else if (node.type === 'SwitchStatement') {
            let out = '';
            for (let x of node.cases) {
                if (x.test) {
                    out += 'case ' + this.expression(x.test) + ':\n';
                } else {
                    out += 'default:\n';
                }
                out += this.indent(x.body.map(x => this.statement(x)).join('\n'));
            }
            return 'switch\xa0(' + this.expression(node.test) + ')\xa0{' + this.indent(out) + '\n}';
        } else if (node.type === 'WhileStatement') {
            return 'while\xa0(' + this.expression(node.test) + ')\xa0' + this.statement(node.body);
        } else if (node.type === 'DoWhileStatement') {
            return 'do\xa0' + this.statement(node.body) + '\xa0while\xa0(' + this.expression(node.test) + ');';
        } else if (node.type === 'ForStatement') {
            let out = 'for\xa0(';
            if (node.init) {
                out += node.init.type === 'VariableDeclaration' ? this.statement(node.init).slice(0, -1) : this.expression(node.init);
            }
            out += ';';
            if (node.test) {
                out += '\xa0' + this.expression(node.test);
            }
            out += ';';
            if (node.update) {
                out += '\xa0' + this.expression(node.update);
            }
            return out + ')\xa0' + this.statement(node.body);
        } else if (node.type === 'BreakStatement' || node.type === 'ContinueStatement') {
            let start = node.type === 'BreakStatement' ? 'break' : 'continue';
            if (node.label) {
                if (this.lang === 'c') {
                    return 'goto ' + node.label.name + ';';
                } else {
                    return start + ' ' + node.label.name + ';';
                }
            } else {
                return start + ';';
            }
        } else if (node.type === 'ReturnStatement') {
            if (node.value) {
                return 'return ' + this.expression(node.value) + ';';
            } else {
                return 'return;';
            }
        } else if (this.lang === 'js' || this.lang === 'ts') {
            if (node.type === 'LabeledStatement') {
                return node.label.name + ': ' + this.statement(node.statement);
            } else if (node.type === 'VariableDeclaration') {
                return node.kind + ' ' + node.vars.map(x => {
                    let out = this.lvalue(x.left);
                    if (this.lang === 'ts') {
                        out += ':\xa0' + this.type(x.resultType);
                    }
                    if (x.value) {
                        out += '\xa0=\xa0' + this.expression(x.value);
                    }
                    return out;
                }).join(', ') + ';\n';
            } else if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
                return 'for\xa0(' + (node.left.type === 'VariableDeclaration' ? this.statement(node.left).slice(0, -1) : this.lvalue(node.left)) + '\xa0' + (node.type === 'ForInStatement' ? 'in' : 'of') + '\xa0' + this.expression(node.right) + ')\xa0' + this.statement(node.body);
            } else if (node.type === 'FunctionDeclaration') {
                let out = 'function ' + node.id.name + this.functionParams(node);
                if (this.lang === 'ts') {
                    out += ':\xa0' + this.type(node.returnType);
                }
                return out + '\xa0' + this.functionBody(node);
            } else {
                this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
            }
        } else {
            if (node.type === 'LabelStatement') {
                return node.label.name + ':\n';
            } else if (node.type === 'VariableDeclaration') {
                return node.vars.map(x => {
                    let out = this.type(x.resultType) + ' ' + this.lvalue(x.left);
                    if (x.value) {
                        out += ' = ' + this.expression(x.value);
                    }
                    return x;
                }).join(';\n') + ';\n';
            } else if (node.type === 'FunctionDeclaration') {
                return this.type(node.returnType) + ' ' + node.id.name + this.functionParams(node) + '\xa0' + this.functionBody(node);
            } else if (node.type === 'DebuggerStatement') {
                return 'debugger;';
            } else if (node.type === 'WithStatement') {
                return 'with\xa0(' + this.expression(node.object) + ')\xa0' + this.statement(node.body);
            } else {
                this.error('IncompatibleLanguageError', `Node of type ${node.type} are not compatible with ${LANGS[this.lang]}`);
            }
        }
    }

    program(node: a.Program): string {
        let out = node.body.map(x => this.statement(x)).join('\n');
        if (this.pretty) {
            // @ts-ignore
            out = out.replaceAll('\xa0', ' ');
        } else {
            // @ts-ignore
            out = out.replaceAll('\n', '').replaceall('\xa0', '');
        }
        return out;
    }

}
