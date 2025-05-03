
import type * as bt from '@babel/types';
import * as t from './types';
import {Type} from './types';
import * as a from './ast';


export class Converter extends a.NodeGenerator {

    raw: string | null = null;

    setSourceData({loc}: bt.Node): void {
        if (!loc) {
            throw new Error('loc is undefined');
        }
        if (!this.raw) {
            throw new Error('raw is undefined');
        }
        this.src = {
            raw: this.raw.slice(loc.start.index, loc.end.index),
            file: loc.filename,
            line: loc.start.line,
            col: loc.start.column,
        };
    }

    spreadElement(node: bt.SpreadElement): a.SpreadElement {
        this.setSourceData(node);
        return this.createSpreadElement(this.expression(node.argument));
    }

    type(node: bt.TSType | bt.TypeAnnotation | bt.Noop | bt.TSTypeAnnotation): Type {
        this.setSourceData(node);
        if (node.type === 'TSTypeAnnotation') {
            return this.type(node.typeAnnotation);
        } else if (node.type === 'TSAnyKeyword') {
            return t.any;
        } else if (node.type === 'TSUnknownKeyword') {
            return t.unknown;
        } else if (node.type === 'TSNeverKeyword') {
            return t.null;
        } else if (node.type === 'TSUndefinedKeyword') {
            return t.undefined;
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
            return t.array(this.type(node.elementType));
        } else if (node.type === 'TSTupleType') {
            return t.array(node.elementTypes.map(x => this.type(x as bt.TSType)));
        } else if (node.type === 'TSTypeLiteral') {
            let props: {[key: PropertyKey]: Type} = {};
            for (let prop of node.members) {
                this.setSourceData(prop);
            }
            return t.object(props);
        } else {
            this.error('NeutrinoBugError', `Unrecognized AST node type in Converter.type: ${node.type}`);
        }
    }

    function(node: bt.Function): [[a.Pattern | a.RestElement, Type][], a.Statement[] | a.Expression, Type, a.Scope] {
        if (!node.returnType) {
            this.error('SyntaxError', 'Functions must have a return type annotation');
        }
        let params: [a.Pattern | a.RestElement, Type][] = [];
        for (let param of node.params) {
            if (param.type === 'TSParameterProperty') {
                this.error('SyntaxError', 'I don\'t know what a TSParameterProperty is');
            }
            if (!param.typeAnnotation) {
                this.error('SyntaxError', 'Parameters must have type annotations');
            }
            let type = this.type(param.typeAnnotation);
            if (param.type === 'RestElement') {
                params.push([this.createRestElement(this.lvalue(param.argument)), type]);
            } else {
                params.push([this.pattern(param), type]);
            }
        }
        let body: a.Statement[] | a.Expression;
        this.pushScope()
        let scope = this.scope;
        if (node.body.type === 'BlockStatement') {
            body = node.body.body.map(x => this.statement(x));
        } else {
            body = this.expression(node.body);
        }
        this.popScope();
        return [params, body, this.type(node.returnType), scope];
    }

    expression(node: bt.Expression | bt.PrivateName | bt.V8IntrinsicIdentifier): a.Expression {
        this.setSourceData(node);
        if (node.type === 'Identifier') {
            return this.createIdentifier(node.name);
        } else if (node.type === 'PrivateName') {
            this.error('SyntaxError', 'Private names are not supported');
        } else if (node.type === 'RegExpLiteral') {
            return this.createRegExpLiteral(node.pattern, node.flags);
        } else if (node.type === 'NullLiteral') {
            return this.createNullLiteral();
        } else if (node.type === 'StringLiteral') {
            return this.createStringLiteral(node.value);
        } else if (node.type === 'BooleanLiteral') {
            return this.createBooleanLiteral(node.value);
        } else if (node.type === 'NumericLiteral') {
            return this.createNumberLiteral(node.value);
        } else if (node.type === 'BigIntLiteral') {
            return this.createBigIntLiteral(BigInt(node.value));
        } else if (node.type === 'DecimalLiteral') {
            this.error('SyntaxError', 'BigDecimals are not supported');
        } else if (node.type === 'Super') {
            this.error('SyntaxError', 'Super is not supported');
        } else if (node.type === 'ThisExpression') {
            return this.createThisExpression();
        } else if (node.type === 'ArrowFunctionExpression') {
            this.error('SyntaxError', 'Arrow functions are not supported');
        } else if (node.type === 'YieldExpression') {
            this.error('SyntaxError', 'Generators are not supported');
        } else if (node.type === 'AwaitExpression') {
            this.error('SyntaxError', 'Promises are not supported');
        } else if (node.type === 'ArrayExpression') {
            return this.createArrayLiteral(node.elements.map(elt => elt ? (elt.type === 'SpreadElement' ? this.spreadElement(elt) : this.expression(elt)) : null));
        } else if (node.type === 'ObjectExpression') {
            let props: (a.ObjectProperty | a.ObjectMethod | a.SpreadElement)[] = [];
            for (let prop of node.properties) {
                this.setSourceData(prop);
                if (prop.type === 'ObjectProperty') {
                    let newProp = this.createObjectProperty(prop.computed, this.expression(prop.key), this.expression(prop.value as bt.Expression));
                    props.push(newProp);
                } else if (prop.type === 'ObjectMethod') {
                    props.push(this.createObjectMethod(prop.computed, this.expression(prop.key), prop.kind, ...this.function(prop)));
                    this.error('SyntaxError', 'Methods are not supported');
                } else {
                    props.push(this.spreadElement(prop));
                }
            }
            this.setSourceData(node);
            return this.createObjectLiteral(props);
        } else if (node.type === 'FunctionExpression') {
            this.error('SyntaxError', 'Function expressions are not supported');
        } else if (node.type === 'UnaryExpression' || node.type === 'UpdateExpression') {
            return this.createUnaryExpression(node.operator, this.expression(node.argument), !node.prefix);
        } else if (node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
            if (node.operator === '|>') {
                this.error('SyntaxError', 'The pipeline operator is not supported');
            }
            return this.createBinaryExpression(this.expression(node.left), node.operator, this.expression(node.right));
        } else if (node.type === 'AssignmentExpression') {
            return this.createAssignmentExpression(this.lvalue(node.left), node.operator as a.AssignmentOperator, this.expression(node.right));
        } else if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
            return this.createPropertyExpression(this.expression(node.object), node.computed, this.expression(node.property), node.type === 'OptionalMemberExpression');
        } else if (node.type === 'BindExpression') {
            this.error('SyntaxError', 'Bind expressions are not supported');
        } else if (node.type === 'ConditionalExpression') {
            return this.createConditionalExpression(this.expression(node.test), this.expression(node.consequent), this.expression(node.alternate));
        } else if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression' || node.type === 'NewExpression') {
            if (node.callee.type === 'Import') {
                let module = this.expression(node.arguments[0] as bt.Expression);
                let options = node.arguments[1] ? this.expression(node.arguments[1] as bt.Expression) : undefined;
                return this.createImportExpression(module, options);
            }
            let func = this.expression(node.callee);
            let args = node.arguments.map(arg => arg.type === 'SpreadElement' ? this.spreadElement(arg) : this.expression(arg as bt.Expression));
            if (node.type === 'NewExpression') {
                return this.createNewExpression(func, args);
            } else {
                return this.createCallExpression(func, args, node.optional ?? undefined);
            }
        } else if (node.type === 'SequenceExpression') {
            let exprs = node.expressions.map(x => this.expression(x));
            let out: a.BinaryExpression = this.createBinaryExpression(exprs[0], ',', exprs[1]);
            for (let i = 2; i < exprs.length; i++) {
                out = this.createBinaryExpression(out, ',', exprs[i]);
            }
            return out;
        } else if (node.type === 'ParenthesizedExpression') {
            return this.createParenthesizedExpression(this.expression(node.expression));
        } else if (node.type === 'DoExpression') {
            this.error('SyntaxError', 'Do expressions are not supported');
        } else if (node.type === 'ModuleExpression') {
            this.error('SyntaxError', 'Module expressions are not supported');
        } else if (node.type === 'TopicReference') {
            this.error('SyntaxError', 'The pipeline operator is not supported');
        } else if (node.type === 'TemplateLiteral' || node.type === 'TaggedTemplateExpression') {
            let tag: a.Expression | null = null;
            if (node.type === 'TaggedTemplateExpression') {
                tag = this.expression(node.tag);
                node = node.quasi;
            }
            let parts = node.quasis.map(x => ({cooked: x.value.cooked ?? x.value.raw, raw: x.value.raw}));
            let exprs = node.expressions.map(x => this.expression(x as bt.Expression));
            return this.createTemplateLiteral(parts, exprs, tag);
        } else if (node.type === 'V8IntrinsicIdentifier') {
            this.error('SyntaxError', 'Intrinsic identifiers are not supported');
        } else if (node.type === 'TSAsExpression') {
            return this.createAsExpression(this.expression(node.expression), this.type(node.typeAnnotation));
        } else {
            this.error('NeutrinoBugError', `Unrecognized AST node type in Converter.expression: ${node.type}`);
        }
    }

    pattern(node: bt.Pattern | bt.Identifier): a.Pattern {
        this.setSourceData(node);
        if (node.type === 'Identifier') {
            return this.createIdentifier(node.name);
        } else if (node.type === 'ObjectPattern') {
            this.error('SyntaxError', 'Object destructuring is not supported');
        } else if (node.type === 'ArrayPattern') {
            return this.createArrayPattern(node.elements.map(x => x ? (x.type === 'RestElement' ? this.createRestElement(this.lvalue(x.argument)) : this.pattern(x as bt.Pattern)) : null));
        } else if (node.type === 'AssignmentPattern') {
            return this.createDefaultPattern(this.lvalue(node.left), this.expression(node.right));
        } else {
            // @ts-ignore
            this.error('NeutrinoBugError', `Unrecognized AST node type in Converter.pattern: ${node.type}`);
        }
    }

    lvalue(node: bt.LVal | bt.OptionalMemberExpression): a.LValue {
        this.setSourceData(node);
        if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
            return this.expression(node) as a.PropertyExpression;
        } else {
            return this.pattern(node as bt.Pattern | bt.Identifier);
        }
    }

    statement(node: bt.Statement): a.Statement {
        this.setSourceData(node);
        if (node.type === 'ExpressionStatement') {
            return this.createExpressionStatement(this.expression(node.expression));
        } else if (node.type === 'BlockStatement') {
            this.pushScope();
            let out = this.createBlockStatement(node.body.map(x => this.statement(x)));
            this.popScope();
            return out;
        } else if (node.type === 'EmptyStatement') {
            return this.createEmptyStatement();
        } else if (node.type === 'DebuggerStatement') {
            return this.createDebuggerStatement();
        } else if (node.type === 'ReturnStatement') {
            return this.createReturnStatement(node.argument ? this.expression(node.argument) : null);
        } else if (node.type === 'LabeledStatement') {
            return this.createLabeledStatement(this.createIdentifier(node.label.name), this.statement(node.body));
        } else if (node.type === 'BreakStatement') {
            return this.createBreakStatement(node.label ? this.createIdentifier(node.label.name) : null);
        } else if (node.type === 'ContinueStatement') {
            return this.createContinueStatement(node.label ? this.createIdentifier(node.label.name) : null);
        } else if (node.type === 'IfStatement') {
            return this.createIfStatement(this.expression(node.test), this.statement(node.consequent), node.alternate ? this.statement(node.alternate) : null);
        } else if (node.type === 'SwitchStatement') {
            return this.createSwitchStatement(this.expression(node.discriminant), node.cases.map(x => this.createSwitchCase(x.test ? this.expression(x.test) : null, x.consequent.map(x => this.statement(x)))));
        } else if (node.type === 'ThrowStatement') {
            this.error('SyntaxError', 'The throw statement is not supported');
        } else if (node.type === 'TryStatement') {
            this.error('SyntaxError', 'The try statement is not supported');
        } else if (node.type === 'WhileStatement') {
            return this.createWhileStatement(this.expression(node.test), this.statement(node.body));
        } else if (node.type === 'DoWhileStatement') {
            return this.createDoWhileStatement(this.statement(node.body), this.expression(node.test));
        } else if (node.type === 'ForStatement') {
            let init = node.init ? (node.init.type === 'VariableDeclaration' ? this.statement(node.init) as a.VariableDeclaration : this.expression(node.init)) : null;
            let test = node.test ? this.expression(node.test) : null;
            let update = node.update ? this.expression(node.update) : null;
           return this.createForStatement(init, test, update, this.statement(node.body));
        } else if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
            if ('await' in node && node.await) {
                this.error('SyntaxError', 'For/await loops are not supported');
            }
            let left = node.left.type === 'VariableDeclaration' ? this.statement(node.left) as a.VariableDeclaration : this.lvalue(node.left);
            let right = this.expression(node.right);
            let body = this.statement(node.body);
            if (node.type === 'ForInStatement') {
                return this.createForInStatement(left, right, body);
            } else {
                return this.createForOfStatement(left, right, body);
            }
        } else if (node.type === 'FunctionDeclaration') {
            if (!node.id) {
                throw new Error('Invalid AST');
            }
            let out = this.createFunctionDeclaration(this.createIdentifier(node.id.name, t.unknown), ...this.function(node));
            this.setVar(node.id.name, a.getFunctionType(out));
            return out;
        } else if (node.type === 'VariableDeclaration') {
            if (node.kind === 'using' || node.kind === 'await using') {
                this.error('SyntaxError', 'Using declarations are not supported');
            }
            let vars: a.VariableDeclarator[] = [];
            for (let decl of node.declarations) {
                let init = decl.init ? this.expression(decl.init) : null;
                if (decl.id.type !== 'Identifier') {
                    this.error('SyntaxError', 'Declared variables can only be identifiers');
                }
                let type = decl.id.typeAnnotation ? this.type(decl.id.typeAnnotation) : null;
                if (!type && !init) {
                    this.error('SyntaxError', 'Variable declarators must have either a type annotation or an initializer');
                }
                // @ts-ignore
                vars.push(this.createVariableDeclarator(this.lvalue(decl.id), init, type));
            }
            return this.createVariableDeclaration(node.kind, vars);
        } else {
            this.error('NeutrinoBugError', `Unrecognized AST node type in Converter.statement: ${node.type}`);
        }
    }

    program(raw: string, node: bt.Program): a.Program {
        this.raw = raw;
        this.scope = new a.Scope();
        let out: a.Statement[] = [];
        for (let statement of node.body) {
            out.push(this.statement(statement));
        }
        this.setSourceData(node);
        return this.createProgram(out);
    }

}


export function convert(raw: string, ast: bt.Program): a.Program {
    return (new Converter()).program(raw, ast);
}