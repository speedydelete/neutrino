
import type * as bt from '@babel/types';
import {CompilerError, SourceData} from './errors';
import * as t from './types';
import {Scope, Type} from './types';
import * as a from './ast';


class Converter {

    currentNode: bt.Node = {type: 'Noop'};
    raw: string = '';
    scope: Scope = new Scope();
    thisType: Type = t.never;

    getSourceData(): SourceData {
        if (!this.currentNode.loc) {
            throw new Error('no source location');
        }
        return {
            file: this.currentNode.loc.filename,
            line: this.currentNode.loc.start.line,
            col: this.currentNode.loc.start.column,
            raw: this.raw.slice(this.currentNode.loc.start.index, this.currentNode.loc.end.index),
        }
    }

    getVar(name: string): Type {
        return this.scope.get(name, this.getSourceData());
    }

    setVar(name: string, type: Type): void {
        this.scope.set(name, type);
    }

    getTypeVar(name: string): Type {
        return this.scope.getType(name, this.getSourceData());
    }

    setTypeVar(name: string, type: Type): void {
        this.scope.setType(name, type);
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

    create<T extends a.Node>(type: T['type'], props: Omit<T, keyof a.BaseNode>): T {
        // @ts-ignore
        return {
            type: type,
            loc: this.getSourceData(),
            ...props,
        }
    }

    error(type: string, message: string): never {
        throw new CompilerError(type, message, this.getSourceData());
    }

    getFunctionType(node: bt.Function): t.object {

    }

    spreadElement(node: bt.SpreadElement): a.SpreadElement {

    }

    expression(node: bt.Expression | bt.PrivateName | bt.V8IntrinsicIdentifier | bt.SpreadElement): a.Expression | a.SpreadElement {
        if (node.type === 'Identifier') {
            return this.create<a.Identifier>('Identifier', {name: node.name, resultType: this.getVar(node.name)});
        } else if (node.type === 'PrivateName') {
            this.error('SyntaxError', 'Private names are not supported');
        } else if (node.type === 'RegExpLiteral') {
            return this.create<a.RegExpLiteral>('RegExpLiteral', {pattern: node.pattern, flags: node.flags, resultType: this.getTypeVar('RegExp')});
        } else if (node.type === 'NullLiteral') {
            return this.create<a.NullLiteral>('NullLiteral', {resultType: t.null});
        } else if (node.type === 'StringLiteral') {
            return this.create<a.StringLiteral>('StringLiteral', {value: node.value, resultType: t.string(node.value)});
        } else if (node.type === 'BooleanLiteral') {
            return this.create<a.BooleanLiteral>('BooleanLiteral', {value: node.value, resultType: t.boolean(node.value)});
        } else if (node.type === 'NumericLiteral') {
            return this.create<a.NumberLiteral>('NumberLiteral', {value: node.value, resultType: t.number(node.value)});
        } else if (node.type === 'BigIntLiteral') {
            return this.create<a.BigIntLiteral>('BigIntLiteral', {value: BigInt(node.value), resultType: t.bigint(BigInt(node.value))});
        } else if (node.type === 'DecimalLiteral') {
            this.error('SyntaxError', 'BigDecimals are not supported');
        } else if (node.type === 'Super') {
            this.error('SyntaxError', 'Super is not supported');
        } else if (node.type === 'Import') {
            this.error('SyntaxError', 'Dynamic import is not supported');
        } else if (node.type === 'ThisExpression') {
            return this.create<a.ThisExpression>('ThisExpression', {resultType: this.thisType});
        } else if (node.type === 'ArrowFunctionExpression') {
            let scope: Scope;
            let body: a.Statement[] = [];
            if (node.body.type === 'BlockStatement') {
                this.pushScope();
                scope = this.scope;
                for (let stmt of node.body.body) {
                    body.push(this.statement(stmt));
                }
                this.popScope();
            } else {
                scope = this.scope;
                body.push(this.create<a.ReturnStatement>('ReturnStatement', {value: this.expression(node.body)}));
            }
            let type = this.getFunctionType(node);
            return this.create<a.FunctionExpression>('FunctionExpression', {resultType: type, id: null, scope, body, params: type.params});
        } else if (node.type === 'YieldExpression') {
            this.error('SyntaxError', 'Generators are not supported');
        } else if (node.type === 'AwaitExpression') {
            this.error('SyntaxError', 'Promises are not supported');
        } else if (node.type === 'ArrayExpression') {
            return this.create<a.ArrayLiteral>('ArrayLiteral', {resultType: this.getVar('Array'), elts: node.elements.map(elt => elt ? (elt.type === 'SpreadElement' ? this.spreadElement(elt) : this.expression(elt)) : elt)});
        } else if (node.type === 'ObjectExpression') {
            return this.create<a.ObjectLiteral>('ObjectLiteral', {resultType:})
        } else {
            this.error('NeutrinoBugError', `Unrecognized AST node type in Converter.expression: ${node.type}`);
        }
    }

    statement(node: bt.Statement): a.Statement {
        this.error('NeutrinoBugError', `Unrecognized AST node type in Converter.expression: ${node.type}`);
    }

    program(raw: string, node: bt.Program): a.Program {
        this.raw = raw;
        this.scope = new Scope();
        let out: a.Statement[] = [];
        for (let statement of node.body) {
            out.push(this.statement(statement));
        }
        return this.create('Program', {
            scope: this.scope,
            body: out,
        });
    }

}


export function convert(raw: string, ast: bt.Program): a.Program {
    return (new Converter()).program(raw, ast);
}
