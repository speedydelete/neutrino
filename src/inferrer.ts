
import * as b from '@babel/types';
import * as t from './types';
import {Type} from './types';
import {ASTManipulator} from './util';
import {getImportType} from './imports';


export class Inferrer extends ASTManipulator {

    thisType: Type = t.undefined;
    thisTypes: Type[] = [];
    superTypes: Type[] = [];

    pushThisType(type: Type): void {
        this.thisTypes.push(type);
        this.thisType = type;
    }

    popThisType(): void {
        let newType = this.thisTypes.pop();
        if (!newType) {
            this.error('InternalError', 'Attempting to pop thisType stack with no previous thisType');
        }
        this.thisType = newType;
    }

    function(params: (b.Identifier | b.RestElement | b.Pattern | b.TSParameterProperty)[], returnType: b.FunctionDeclaration['returnType'], construct: boolean = false, obj?: t.Object): t.Object {
        let outParams: t.Parameter[] = [];
        let restParam: t.Parameter | null = null;
        for (let param of params) {
            if (param.type === 'RestElement') {
                restParam = [this.getRaw(param.argument), this.type(param.typeAnnotation)];
            } else if (param.type === 'TSParameterProperty') {
                this.error('SyntaxError', 'Parameter properties are not supported');
            } else {
                outParams.push([this.getRaw(param), this.type(param.typeAnnotation)]);
            }
        }
        if (!obj) {
            let ftype = this.scope.getType('Function');
            if (ftype.type !== 'object') {
                this.error('TypeError', 'Global type Function must be an object type');
            }
            obj = t.copyObject(ftype);
        }
        let out = {
            params: outParams,
            restParam,
            returnType: this.type(returnType),
        };
        if (construct) {
            obj.construct = out;
        } else {
            obj.call = out;
        }
        return obj;
    }

    objectType(nodes: b.TSTypeElement[]): Type {
        let out = t.object({});
        for (let prop of nodes) {
            this.setSourceData(prop);
            if (prop.type === 'TSPropertySignature') {
                if (prop.key.type !== 'Identifier') {
                    this.error('SyntaxError', 'Type literal keys must not be computed');
                }
                out.props[prop.key.name] = this.type(prop.typeAnnotation);
            } else if (prop.type === 'TSMethodSignature') {
                if (prop.key.type !== 'Identifier') {
                    this.error('SyntaxError', 'Type literal keys must not be computed');
                }
                if (prop.kind === 'get') {
                    out.props[prop.key.name] = this.type(prop.typeAnnotation);
                } else if (prop.kind === 'method') {
                    out.props[prop.key.name] = this.function(prop.parameters, prop.typeAnnotation, false);
                }
            } else if (prop.type === 'TSCallSignatureDeclaration') {
                this.function(prop.parameters, prop.typeAnnotation, false, out);
            } else if (prop.type === 'TSConstructSignatureDeclaration') {
                this.function(prop.parameters, prop.typeAnnotation, true, out);
            } else {
                let type = this.type(prop.typeAnnotation);
                for (let param of prop.parameters) {
                    out.indexes.push([param.name, this.type(param.typeAnnotation), type]);
                }
            }
        }
        return out;
    }

    type(node: b.TSType | b.TSTypeAnnotation | b.TypeAnnotation | undefined | null | b.Noop): Type {
        if (!node || node.type === 'Noop') {
            return t.any;
        }
        this.setSourceData(node);
        switch (node.type) {
            case 'TSTypeAnnotation':
                return this.type(node.typeAnnotation);
            case 'TSParenthesizedType':
                return this.type(node.typeAnnotation);
            case 'TSIntrinsicKeyword':
                throw new TypeError('The intrinsic keyword is not supported');
            case 'TSAnyKeyword':
                return t.any;
            case 'TSUnknownKeyword':
                return t.unknown;
            case 'TSNeverKeyword':
                return t.never;
            case 'TSVoidKeyword':
                return t.void;
            case 'TSUndefinedKeyword':
                return t.undefined;
            case 'TSNullKeyword':
                return t.null;
            case 'TSBooleanKeyword':
                return t.boolean;
            case 'TSNumberKeyword':
                return t.number;
            case 'TSStringKeyword':
                return t.string;
            case 'TSSymbolKeyword':
                return t.symbol;
            case 'TSBigIntKeyword':
                return t.bigint;
            case 'TSObjectKeyword':
                return t.object;
            case 'TSThisType':
                return this.thisType ?? t.undefined;
            case 'TSLiteralType':
                let x = node.literal;
                this.setSourceData(x);
                switch (x.type) {
                    case 'BooleanLiteral':
                        return t.boolean(x.value);
                    case 'NumericLiteral':
                        return t.number(x.value);
                    case 'StringLiteral':
                        return t.string(x.value);
                    case 'BigIntLiteral':
                        return t.bigint(BigInt(x.value));
                    default:
                        this.error('InternalError', `Bad/unrecongnized AST literal type subnode in types.parse() of type ${node.type}`);
                }
            case 'TSArrayType':
                return t.array(this.type(node.elementType));
            case 'TSTupleType':
                return t.array(node.elementTypes.map(x => this.type(x.type === 'TSNamedTupleMember' ? x.elementType : x)));
            case 'TSTypeLiteral':
                return this.objectType(node.members);
            case 'TSFunctionType':
                return this.function(node.parameters, node.typeAnnotation, false);
            case 'TSConstructorType':
                return this.function(node.parameters, node.typeAnnotation, true);
            case 'TSUnionType':
                return t.union(...node.types.map(this.type));
            case 'TSIntersectionType':
                return t.intersection(...node.types.map(this.type));
            case 'TSConditionalType':
                throw new TypeError('Conditional types are not supported');
            case 'TSIndexedAccessType':
                let obj = this.type(node.objectType);
                if (obj.type !== 'object') {
                    this.error('TypeError', `Indexed access types must be used with an object type`);
                }
                let prop = this.type(node.indexType);
                if ((prop.type === 'string' || prop.type === 'number') && 'value' in prop) {
                    return obj.props[prop.value];
                } else {
                    for (let [_, type, result] of obj.indexes) {
                        if (t.matches(prop, type)) {
                            return result;
                        }
                    }
                    this.error('TypeError', `Invalid type for indexed access type: ${prop}`);
                }
            case 'TSMappedType':
                return t.object({}, null, [[node.typeParameter.name, this.type(node.typeParameter.constraint), this.type(node.typeAnnotation)]]);
            case 'TSImportType':
                this.error('TypeError', 'Import types are not supported');
            case 'TSTemplateLiteralType':
                this.error('TypeError', 'Template literal types are not supported');
            default:
                this.error('InternalError', `Bad/unrecongnized AST node in Inferrer.type() of type ${node.type}`);
        }
    }

    typeofOperator(type: Type): Type {
        switch (type.type) {
            case 'undefined':
            case 'boolean':
            case 'number':
            case 'string':
            case 'symbol':
            case 'bigint':
            case 'object':
                return t.string(type.type);
            case 'void':
                return t.string('undefined');
            case 'null':
                return t.string('object');
            case 'never':
                return t.never;
            case 'union':
                return t.union(...type.types.map(this.typeofOperator));
            default:
                return t.union(t.string('undefined'), t.string('object'), t.string('boolean'), t.string('number'), t.string('string'), t.string('symbol'), t.string('bigint'));
        }
    }

    setLValue(node: b.LVal, const_: boolean, type?: Type, export_?: boolean): void {
        this.setSourceData(node);
        if (node.type === 'Identifier') {
            if (node.typeAnnotation && node.typeAnnotation.type !== 'Noop') {
                type = this.type(node.typeAnnotation);
            } else if (!type) {
                type = t.any;
            }
            if (!const_) {
                type = t.generalizeLiteral(type);
            }
            this.scope.set(node.name, type);
            if (export_) {
                this.scope.export(node.name);
            }
        } else if (node.type === 'ObjectPattern') {
            if (type) {
                type = this.toObjectType(type);
                if (type.type === 'object') {
                    type = t.copyObject(type);
                }
                for (let prop of node.properties) {
                    if (prop.type === 'RestElement') {
                        this.setLValue(prop.argument, const_, type);
                    } else {
                        let propType = this.expression(prop.key);
                        this.setLValue(prop.value as b.Pattern, const_, this.getProp(type, propType));
                        if (type.type === 'object' && (propType.type === 'string' || propType.type === 'number' || propType.type === 'symbol') && 'value' in propType) {
                            delete type.props[propType.value];
                        }
                    }
                }
            } else {
                for (let prop of node.properties) {
                    if (prop.type === 'RestElement') {
                        this.setLValue(prop.argument, const_);
                    } else {
                        this.setLValue(prop.value as b.Pattern, const_);
                    }
                }
            }
        } else if (node.type === 'ArrayPattern') {
            if (type) {
                type = this.toObjectType(type);
                for (let i = 0; i < node.elements.length; i++) {
                    let elt = node.elements[i];
                    if (!elt) {
                        continue;
                    }
                    if (type.type === 'any') {
                        if (elt.type === 'RestElement') {
                            this.setLValue(elt.argument, const_, t.any);
                        } else {
                            this.setLValue(elt, const_, t.any);
                        }
                    } else {
                        if (elt.type === 'RestElement') {
                            if ('elts' in type && typeof type.elts === 'object' && type.elts !== null && 'type' in type.elts) {
                                this.setLValue(elt.argument, const_, type.elts as Type);
                            } else {
                                this.setLValue(elt.argument, const_, t.any);
                            }
                        } else {
                            this.setLValue(elt, const_, this.getProp(type, i));
                        }
                    }
                }
            } else {
                for (let elt of node.elements) {
                    if (!elt) {
                        continue;
                    }
                    if (elt.type === 'RestElement') {
                        this.setLValue(elt.argument, const_);
                    } else {
                        this.setLValue(elt, const_);
                    }
                }
            }
        } else if (node.type === 'AssignmentPattern') {
            if (!type) {
                this.error('InternalError', 'Invalid AST');
            }
            let nullish = t.isNullish(type);
            if (nullish === 'maybe') {
                this.setLValue(node.left, const_, t.union(type, this.expression(node.right)));
            } else if (nullish) {
                this.setLValue(node.left, const_, this.expression(node.right));
            } else {
                this.setLValue(node.left, const_, type);
            }
        }
    }

    class(node: b.Class): Type {
        let inst = t.object();
        let variable = t.object({prototype: inst}, {params: [], returnType: inst, restParam: null});
        if (node.superClass) {
            this.superTypes.push(this.getProp(this.expression(node.superClass), 'prototype'));
        }
        for (let prop of node.body.body) {
            this.setSourceData(prop);
            if ('key' in prop) {
                if (prop.key.type !== 'Identifier') {
                    this.error('SyntaxError', 'Class property keys cannot be computed');
                }
                let type: Type;
                if (prop.type === 'ClassProperty') {
                    this.pushThisType(prop.static ? variable : inst);
                    type = this.type(prop.typeAnnotation);
                    this.popThisType();
                } else if (prop.type === 'ClassMethod') {
                    this.pushThisType(prop.static ? variable : inst);
                    type = this.function(prop.params, prop.returnType, false, inst);
                    this.popThisType();
                } else {
                    continue;
                }
                if (prop.static) {
                    variable.props[prop.key.name] = type;
                } else {
                    inst.props[prop.key.name] = type;
                }
            } else if (prop.type === 'StaticBlock') {
                this.error('SyntaxError', 'Static blocks are not supported');
            } else {
                this.pushThisType(prop.static ? variable : inst);
                let type = this.type(prop.typeAnnotation);
                for (let param of prop.parameters) {
                    variable.indexes.push([param.name, this.type(param.typeAnnotation), type]);
                }
                this.popThisType();
            }
        }
        if (node.superClass) {
            this.superTypes.pop();
        }
        if (node.id) {
            this.scope.set(node.id.name, variable);
            this.scope.setType(node.id.name, inst);
        }
        return variable;
    }

    expression(node: b.Expression | b.PrivateName | b.V8IntrinsicIdentifier | b.ImportExpression | b.FunctionDeclaration | b.ClassDeclaration | b.TSDeclareFunction): Type {
        this.setSourceData(node);
        let out: Type;
        switch (node.type) {
            case 'Identifier':
                return this.scope.get(node.name);
            case 'PrivateName':
                this.error('SyntaxError', 'Private names are not supported');
            case 'NullLiteral':
                return t.null;
            case 'BooleanLiteral':
                return t.boolean(node.value);
            case 'NumericLiteral':
                return t.number(node.value);
            case 'StringLiteral':
                return t.string(node.value);
            case 'BigIntLiteral':
                return t.bigint(BigInt(node.value));
            case 'RegExpLiteral':
                return this.scope.get('RegExp');
            case 'DecimalLiteral':
                this.error('SyntaxError', 'Decimal literals are not supported');
            case 'Super':
                return this.superTypes[this.superTypes.length - 1];
            case 'Import':
                return t.function([['module', t.string], ['options', t.object({with: t.object({}, null, [['attribute', t.string, t.string]])})]], t.any);
            case 'ThisExpression':
                return this.thisType;
            case 'ArrowFunctionExpression':
                return this.function(node.params, node.returnType);
            case 'YieldExpression':
                return t.any;
            case 'AwaitExpression':
                out = this.expression(node.argument);
                if (out.type === 'object' && 'then' in out.props && out.props.then.type === 'object' && out.props.then.call) {
                    return out.props.then.call.returnType;
                } else {
                    return out;
                }
            case 'ArrayExpression':
                let elts: Type | Type[] = [];
                for (let elt of node.elements) {
                    if (elt === null) {
                        if (elts instanceof Array) {
                            elts.push(t.undefined);
                        } else {
                            elts = t.union(elts, t.undefined);
                        }
                    } else if (elt.type === 'SpreadElement') {
                        let type = this.expression(elt.argument);
                        if (!('isArray' in type)) {
                            this.error('TypeError', 'Spread elements in array literals must be array types');
                        }
                        if (type.elts instanceof Array) {
                            if (elts instanceof Array) {
                                elts.push(...type.elts);
                            } else {
                                elts = t.union(elts, ...type.elts);
                            }
                        } else {
                            if (elts instanceof Array) {
                                elts = t.union(type, ...elts);
                            } else {
                                elts = t.union(elts, type);
                            }
                        }
                    } else {
                        let type = this.expression(elt);
                        if (elts instanceof Array) {
                            elts.push(type);
                        } else {
                            elts = t.union(elts, type);
                        }
                    }
                }
                return t.array(elts);
            case 'ObjectExpression':
                out = t.object();
                for (let prop of node.properties) {
                    if (prop.type === 'SpreadElement') {
                        let type = this.expression(prop.argument);
                        if (type.type !== 'object' || 'isArray' in type) {
                            this.error('TypeError', 'Spread elements in object literals must be object types');
                        }
                        out = t.resolveObjectIntersection(out, type);
                        if (out.type === 'any') {
                            break;
                        }
                        continue;
                    }
                    if (prop.key.type === 'PrivateName') {
                        continue;
                    }
                    let key = this.expression(prop.key);
                    if ((key.type === 'string' || key.type === 'number') && 'value' in key) {
                        if (prop.type === 'ObjectProperty') {
                            out.props[key.value] = this.expression(prop.value as b.Expression);
                        } else {
                            out.props[key.value] = this.function(prop.params, prop.returnType);
                        }
                    }
                }
                return out;
            case 'RecordExpression':
                this.error('SyntaxError', 'Records are not supported');
            case 'TupleExpression':
                this.error('SyntaxError', 'Tuples are not supported');
            case 'FunctionExpression':
            case 'FunctionDeclaration':
                let type = this.function(node.params, node.returnType);
                if (node.id) {
                    this.scope.set(node.id.name, type);
                }
                return type;
            case 'UnaryExpression':
                switch (node.operator) {
                    case '-':
                    case '+':
                    case '~':
                        return t.number;
                    case '!':
                    case 'delete':
                        return t.boolean;
                    case 'void':
                        return t.undefined;
                    case 'typeof':
                        return this.typeofOperator(this.expression(node.argument));
                    default:
                        return t.never;
                }
            case 'UpdateExpression':
                return t.number;
            case 'BinaryExpression':
                switch (node.operator) {
                    case '==':
                    case '!=':
                    case '===':
                    case '!==':
                    case '<':
                    case '<=':
                    case '>':
                    case '>=':
                    case 'in':
                    case 'instanceof':
                        return t.boolean;
                    case '|>':
                        this.error('SyntaxError', 'The pipeline operator is not supported');
                    default:
                        return t.number;
                }
            case 'AssignmentExpression':
                return this.expression(node.right);
            case 'LogicalExpression':
                let left = this.expression(node.left);
                let right = this.expression(node.right);
                if (node.operator === '&&') {
                    if (t.isTruthy(left) === 'maybe') {
                        return t.union(left, right);
                    } else if (t.isTruthy(left)) {
                        return right;
                    } else {
                        return left;
                    }
                } else if (node.operator === '||') {
                    if (t.isTruthy(left) === 'maybe') {
                        return t.union(left, right);
                    } else if (t.isTruthy(left)) {
                        return left;
                    } else {
                        return right;
                    }
                } else {
                    if (t.isNullish(left) === 'maybe') {
                        return t.union(left, right);
                    } else if (t.isNullish(left)) {
                        return right;
                    } else {
                        return left;
                    }
                }
            case 'MemberExpression':
            case 'OptionalMemberExpression':
                return this.getProp(this.expression(node.object), this.expression(node.property), node.optional ?? false);
            case 'BindExpression':
                return this.expression(node.callee);
            case 'ConditionalExpression':
                let true_ = this.expression(node.consequent);
                let false_ = this.expression(node.alternate);
                let test = t.isTruthy(this.expression(node.test));
                if (test === 'maybe') {
                    return t.union(true_, false_);
                } else if (test) {
                    return true_;
                } else {
                    return false_;
                }
            case 'CallExpression':
            case 'OptionalCallExpression':
                return this.call(this.expression(node.callee), node.optional ?? false);
            case 'NewExpression':
                return this.construct(this.expression(node.callee), node.optional ?? false);
            case 'SequenceExpression':
                return this.expression(node.expressions[node.expressions.length - 1]);
            case 'ParenthesizedExpression':
                return this.expression(node.expression);
            case 'DoExpression':
                this.error('SyntaxError', 'Do expressions are not supported');
            case 'ModuleExpression':
                this.error('SyntaxError', 'Module expressions are not supported');
            case 'TemplateLiteral':
                return t.string;
            case 'TaggedTemplateExpression':
                return this.call(this.expression(node.tag));
            case 'ClassExpression':
            case 'ClassDeclaration':
                return this.class(node);
            case 'MetaProperty':
                let prop = node.meta.name + '.' + node.property.name;
                switch (prop) {
                    case 'new.target':
                        return t.union(t.object, t.undefined);
                    case 'import.meta':
                        return t.object;
                    default:
                        this.error('SyntaxError', `Unrecognized meta property ${prop}`);
                }
            case 'ImportExpression':
                return getImportType(this.fullPath, this.expression(node.source), node.options ? this.expression(node.options) : undefined);
            case 'TSNonNullExpression':
                out = this.expression(node.expression);
                if (t.isNullish(out) === true) {
                    return t.never;
                } else {
                    return out;
                }
            default:
                this.error('InternalError', `Bad/unrecongnized AST node in Inferrer.expression() of type ${node.type}`);
        }
    }

    importAttributes(attrs: b.ImportAttribute[] | null | undefined): t.Object | undefined {
        if (!attrs) {
            return undefined;
        } else {
            let out = t.object();
            for (let attr of attrs) {
                let key = attr.key.type === 'Identifier' ? attr.key.name : attr.key.value;
                out.props[key] = t.string(attr.value.value);
            }
            return out;
        }
    }
    
    statement(node: b.Statement, export_: boolean = false): void {
        if (node.type === 'ExpressionStatement') {
            this.expression(node.expression);
        } else if (node.type === 'LabeledStatement') {
            this.statement(node.body);
        } else if (node.type === 'VariableDeclaration') {
            for (let decl of node.declarations) {
                this.setLValue(decl.id, node.kind === 'const', decl.init ? this.expression(decl.init) : undefined, export_);
            }
        } else if (node.type === 'FunctionDeclaration') {
            if (!node.id) {
                this.error('InternalError', 'Invalid AST');
            }
            this.scope.set(node.id.name, this.function(node.params, node.returnType, false));
            if (export_) {
                this.scope.export(node.id.name);
            }
        } else if (node.type === 'ClassDeclaration') {
            this.class(node);
        } else if (node.type === 'ImportDeclaration') {
            let ns = getImportType(this.fullPath, node.source.value, this.importAttributes(node.attributes));
            for (let spec of node.specifiers) {
                if (spec.type === 'ImportSpecifier') {
                    this.setLValue(spec.local, true, this.getProp(ns, spec.imported.type === 'Identifier' ? spec.imported.name : spec.imported.value));
                } else if (spec.type === 'ImportDefaultSpecifier') {
                    this.setLValue(spec.local, true, this.getProp(ns, 'default'));
                } else {
                    this.setLValue(spec.local, true, ns);
                }
            }
        } else if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                this.statement(node.declaration, true);
            }
            if (!node.source) {
                for (let spec of node.specifiers) {
                    if (spec.type === 'ExportSpecifier') {
                        this.scope.export(spec.local.name, spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value);
                    }
                }
            } else {
                let ns = getImportType(this.fullPath, node.source.value, this.importAttributes(node.attributes));
                for (let spec of node.specifiers) {
                    let name = spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value;
                    if (spec.type === 'ExportSpecifier') {
                        this.scope.export(name, undefined, this.getProp(ns, spec.local.name));
                    } else if (spec.type === 'ExportNamespaceSpecifier') {
                        this.scope.export(name, undefined, ns);
                    }
                }
            }
        } else if (node.type === 'ExportDefaultDeclaration') {
            this.scope.exportDefault(this.expression(node.declaration));
        } else if (node.type === 'ExportAllDeclaration') {
            let ns = getImportType(this.fullPath, node.source.value, this.importAttributes(node.attributes));
            if (ns.type === 'object') {
                for (let key in ns.props) {
                    this.scope.export(key, undefined, ns.props[key]);
                }
            }
        } else if (node.type === 'TSTypeAliasDeclaration') {
            this.scope.setType(node.id.name, this.type(node.typeAnnotation));
        } else if (node.type === 'TSInterfaceDeclaration') {
            this.scope.setType(node.id.name, this.objectType(node.body.body));
        } else if (node.type === 'TSDeclareFunction') {
            if (!node.id) {
                this.error('InternalError', 'Invalid AST');
            }
            this.scope.setType(node.id.name, this.function(node.params, node.returnType, false));
        } else if (node.type === 'TSEnumDeclaration') {
            let out = t.object();
            let i = 0;
            for (let item of node.members) {
                let key = item.id.type === 'Identifier' ? item.id.name : item.id.value;
                if (item.initializer) {
                    out.props[key] = this.expression(item.initializer);
                } else {
                    out.props[key] = t.number(i);
                }
                i++;
            }
            this.scope.set(node.id.name, out);
            this.scope.setType(node.id.name, t.union(...Object.values(out.props)));
        }
    }

    program(node: b.Program): void {
        for (let statement of node.body) {
            this.statement(statement);
        }
    }

}
