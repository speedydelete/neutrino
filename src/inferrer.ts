
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import {t, Type, Stack, Scope, ASTManipulator} from './util.js';
import type {Compiler} from './compiler.js';


export class Inferrer extends ASTManipulator {

    thisTypes: Stack<Type>;
    superTypes: Stack<Type>;

    constructor(compiler: Compiler, fullPath: string, raw: string, scope?: Scope, useGlobalThis: boolean = true) {
        super(compiler, fullPath, raw, scope);
        this.thisTypes = this.createStack(useGlobalThis ? [this.getVar('globalThis')] : []);
        this.superTypes = this.createStack();
    }

    getImportType(path: string, attrs?: t.Object): Type {
        return t.any;
    }

    property(node: b.Expression | b.PrivateName): PropertyKey | Type {
        return node.type === 'Identifier' ? node.name : this.expression(node);
    }

    function(params: (b.Identifier | b.RestElement | b.Pattern | b.TSParameterProperty)[], typeParams?: b.TypeParameterDeclaration | b.TSTypeParameterDeclaration | b.Noop | null, returnType?: b.FunctionDeclaration['returnType'], obj?: t.Object): t.Object {
        this.pushScope();
        let outParams: t.Parameter[] = [];
        let restParam: t.RestParameter | undefined = undefined;
        if (typeParams) {

        }
        for (let param of params) {
            if (param.type === 'RestElement') {
                restParam = [this.getRaw(param.argument), this.type(param.typeAnnotation)];
            } else if (param.type === 'TSParameterProperty') {
                this.error('SyntaxError', 'Parameter properties are not supported');
            } else if (param.type === 'AssignmentPattern') {
                outParams.push([this.getRaw(param.left), this.type(param.typeAnnotation), param.right]);
            } else if (param.type === 'Identifier') {
                let out: t.Parameter = [param.name, this.type(param.typeAnnotation), undefined];
                if (param.trailingComments && param.trailingComments.length > 0) {
                    for (let comment of param.trailingComments) {
                        let data = comment.value;
                        for (let cmd of data.split(',')) {
                            cmd = cmd.trim();
                            if (cmd.startsWith('= ')) {
                                out[2] = parser.parseExpression(data.slice(2));
                            }
                        }
                    }
                }
                outParams.push(out);
            } else {
                this.error('SyntaxError', 'Parameter destructuring is not supported');
            }
        }
        let out: t.Object;
        if (!obj) {
            let ftype = this.getGlobalTypeVar('Function');
            if (ftype.type !== 'object') {
                this.error('TypeError', 'Global type Function must be an object type');
            }
            out = ftype.copy();
        } else {
            out = obj;
        }
        out.call = {
            params: outParams,
            restParam,
            returnType: this.type(returnType),
        };
        this.popScope();
        return out;
    }

    callComments(comments: b.Comment[], call?: t.CallData | null): void {
        if (!call) {
            this.error('InternalError', 'call is null');
        }
        for (let comment of comments) {
            for (let cmd of comment.value.split(',')) {
                cmd = cmd.trim();
                if (cmd === 'no this') {
                    call.noThis = true;
                } else if (cmd.startsWith('c = ')) {
                    call.cName = cmd.slice(4);
                } else if (cmd === 'this is any[]') {
                    call.thisIsAnyArray = true;
                } else if (cmd === 'real void') {
                    call.realVoid = true;
                }
            }
        }
    }

    setPropFromExpression(type: t.Object, key: b.Expression, value: Type): void {
        if (key.type === 'Identifier') {
            type.props[key.name] = value;
        } else {
            this.setProp(type, this.expression(key), value);
        }
    }

    objectType(nodes: b.TSTypeElement[]): t.Object {
        let out = t.object();
        for (let prop of nodes) {
            this.setSourceData(prop);
            if (prop.leadingComments && prop.leadingComments.length > 0) {
                let ignored = false;
                for (let comment of prop.leadingComments) {
                    if (comment.value === 'neutrino ignore') {
                        ignored = true;
                    }
                }
                if (ignored) {
                    continue;
                }
            }
            if (prop.type === 'TSPropertySignature') {
                let value = this.type(prop.typeAnnotation);
                this.setPropFromExpression(out, prop.key, value);
            } else if (prop.type === 'TSMethodSignature') {
                let value: Type;
                if (prop.kind === 'method') {
                    value = this.function(prop.parameters, prop.typeParameters, prop.typeAnnotation);
                    if (prop.leadingComments && prop.leadingComments.length > 0) {
                        this.callComments(prop.leadingComments, value.call);
                    }
                } else if (prop.kind === 'get') {
                    value = this.type(prop.typeAnnotation);
                } else {
                    continue;
                }
                this.setPropFromExpression(out, prop.key, value);
            } else if (prop.type === 'TSCallSignatureDeclaration') {
                this.function(prop.parameters, prop.typeParameters, prop.typeAnnotation, out);
                if (prop.leadingComments && prop.leadingComments.length > 0) {
                    this.callComments(prop.leadingComments, out.call);
                }
            } else if (prop.type === 'TSIndexSignature') {
                let valueType = this.type(prop.typeAnnotation);
                for (let param of prop.parameters) {
                    let type = this.type(param.typeAnnotation);
                    out.indexes.push({name: param.name, key: type, value: valueType});
                }
            }
        }
        return out;
    }

    type(node: b.TSType | b.TSTypeAnnotation | undefined | null | b.Noop | b.FlowType | b.TypeAnnotation | b.TSInterfaceBody): Type {
        if (!node) {
            return t.any;
        }
        this.setSourceData(node);
        switch (node.type) {
            case 'Noop':
                return t.any;
            case 'TSTypeAnnotation':
            case 'TypeAnnotation':
            case 'TSParenthesizedType':
                return this.type(node.typeAnnotation);
            case 'TSIntrinsicKeyword':
                throw new TypeError('The intrinsic keyword is not supported');
            case 'TSAnyKeyword':
            case 'TSUnknownKeyword':
            case 'TSNeverKeyword':
                return t.any;
            case 'TSVoidKeyword':
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
                this.error('SyntaxError', 'BigInts are not supported');
            case 'TSObjectKeyword':
                return t.object();
            case 'TSThisType':
                return this.thisTypes.value ?? t.undefined;
            case 'TSLiteralType':
                let x = node.literal;
                this.setSourceData(x);
                switch (x.type) {
                    case 'BooleanLiteral':
                        return t.boolean;
                    case 'NumericLiteral':
                        return t.number;
                    case 'StringLiteral':
                        return t.string;
                    case 'BigIntLiteral':
                        this.error('SyntaxError', 'BigInts are not supported');
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
            case 'TSConstructorType':
                let type = this.function(node.parameters, node.typeParameters, node.typeAnnotation);
                if (node.leadingComments && node.leadingComments.length > 0) {
                    this.callComments(node.leadingComments, type.call);
                }
                return type;
            case 'TSUnionType':
                return t.union(node.types.map(x => this.type(x)));
            case 'TSIntersectionType':
                return t.intersection(node.types.map(x => this.type(x)));
            case 'TSConditionalType':
                return t.conditional(this.type(node.checkType), this.type(node.extendsType), this.type(node.trueType), this.type(node.falseType));
            case 'TSInferType':
                return t.infer(node.typeParameter.name);
            case 'TSIndexedAccessType':
                let propType = node.indexType;
                let prop: PropertyKey | Type;
                if (propType.type === 'TSLiteralType') {
                    if (propType.literal.type === 'StringLiteral') {
                        prop = propType.literal.value;
                    } else if (propType.literal.type === 'NumericLiteral') {
                        prop = propType.literal.value;
                    } else {
                        this.error('TypeError', 'Cannot be used as a property key');
                    }
                } else {
                    prop = this.type(propType);
                }
                return this.getProp(this.type(node.objectType), prop);
            case 'TSImportType':
                return this.getImportType(node.argument.value);
            case 'TSMappedType':
                this.pushScope();
                let name = node.typeParameter.name;
                let constraint = this.type(node.typeParameter.constraint);
                this.setTypeVar(name, constraint);
                let key = node.nameType ? this.type(node.nameType) : constraint;
                let value = this.type(node.typeAnnotation);
                this.popScope();
                return t.object({}, [{name, key, value}]);
            case 'TSTemplateLiteralType':
                this.error('TypeError', 'Template literal types are not supported');
            case 'TSTypeReference':
                if (node.typeName.type === 'Identifier') {
                    return this.getTypeVar(node.typeName.name);
                } else {
                    this.error('SyntaxError', 'Qualified names are not supported');
                }
            case 'TSTypeOperator':
                if (node.operator === 'keyof') {
                    return this.keyof(this.type(node.typeAnnotation));
                } else {
                    this.error('SyntaxError', `Unrecognized type operator: ${node.operator}`);
                }
            case 'TSTypePredicate':
                return t.boolean;
            case 'TSInterfaceBody':
                return this.objectType(node.body);
            case 'AnyTypeAnnotation':
                return t.any;
            case 'MixedTypeAnnotation':
                return t.unknown;
            case 'EmptyTypeAnnotation':
                return t.never;
            case 'VoidTypeAnnotation':
                return t.undefined;
            case 'NullLiteralTypeAnnotation':
                return t.null;
            case 'BooleanTypeAnnotation':
                return t.boolean;
            case 'NumberTypeAnnotation':
                return t.number;
            case 'StringTypeAnnotation':
                return t.string;
            case 'SymbolTypeAnnotation':
                return t.symbol;
            case 'ThisTypeAnnotation':
                return this.thisTypes.value ?? t.undefined;
            case 'BooleanLiteralTypeAnnotation':
                return t.boolean(node.value);
            case 'NumberLiteralTypeAnnotation':
                return t.number(node.value);
            case 'StringLiteralTypeAnnotation':
                return t.string(node.value);
            case 'NullableTypeAnnotation':
                return t.union(this.type(node.typeAnnotation), t.undefined, t.null);
            case 'ArrayTypeAnnotation':
                return t.array(this.type(node.elementType));
            case 'TupleTypeAnnotation':
                return t.array(node.types.map(type => this.type(type)));
            case 'ObjectTypeAnnotation':
                let out = t.object();
                for (let prop of node.properties) {
                    if (prop.type === 'ObjectTypeSpreadProperty') {
                        t.objectAssign(out, this.type(prop.argument) as t.Object);
                    } else {
                        this.setPropFromExpression(out, prop.key, this.type(prop.value));
                    }
                }
                if (node.indexers) {
                    for (let index of node.indexers) {
                        out.indexes.push({
                            name: 'key',
                            key: this.type(index.key),
                            value: this.type(index.value),
                        });
                    }
                }
                return out;
            case 'FunctionTypeAnnotation':
                return this.function(node.params.map((param, i) => ({
                    type: 'Identifier',
                    name: 'arg_' + i,
                    typeAnnotation: {
                        type: 'TypeAnnotation',
                        typeAnnotation: param.typeAnnotation,
                    },
                    loc: param.loc,
                })), node.typeParameters, {
                    type: 'TypeAnnotation',
                    typeAnnotation: node.returnType,
                });
            case 'UnionTypeAnnotation':
                return t.union(node.types.map(type => this.type(type)));
            case 'IntersectionTypeAnnotation':
                return t.intersection(node.types.map(type => this.type(type)));
            case 'IndexedAccessType':
                return this.getProp(this.type(node.objectType), this.type(node.indexType));
            default:
                this.error('InternalError', `Bad/unrecongnized AST node in Inferrer.type() of type ${node.type}`);
        }
    }

    setLValue(node: b.LVal | b.OptionalMemberExpression, type?: Type, export_?: boolean): void {
        this.setSourceData(node);
        if (node.type === 'Identifier') {
            if (node.typeAnnotation && node.typeAnnotation.type !== 'Noop') {
                type = this.type(node.typeAnnotation);
            } else if (!type) {
                type = t.any;
            }
            this.scope.set(node.name, type);
            if (export_) {
                this.export(node.name);
            }
        } else if (node.type === 'ObjectPattern') {
            if (type) {
                for (let prop of node.properties) {
                    if (prop.type === 'RestElement') {
                        this.setLValue(prop.argument, type);
                    } else {
                        let propType = this.expression(prop.key);
                        this.setLValue(prop.value as b.Pattern, this.getProp(type, propType));
                    }
                }
            } else {
                for (let prop of node.properties) {
                    if (prop.type === 'RestElement') {
                        this.setLValue(prop.argument);
                    } else {
                        this.setLValue(prop.value as b.Pattern);
                    }
                }
            }
        } else if (node.type === 'ArrayPattern') {
            if (type) {
                for (let i = 0; i < node.elements.length; i++) {
                    let elt = node.elements[i];
                    if (!elt) {
                        continue;
                    }
                    if (type.type === 'any') {
                        if (elt.type === 'RestElement') {
                            this.setLValue(elt.argument, t.any);
                        } else {
                            this.setLValue(elt, t.any);
                        }
                    } else {
                        if (elt.type === 'RestElement') {
                            if ('elts' in type && typeof type.elts === 'object' && type.elts !== null && 'type' in type.elts) {
                                this.setLValue(elt.argument, type.elts as Type);
                            } else {
                                this.setLValue(elt.argument, t.any);
                            }
                        } else {
                            this.setLValue(elt, this.getProp(type, i));
                        }
                    }
                }
            } else {
                for (let elt of node.elements) {
                    if (!elt) {
                        continue;
                    }
                    if (elt.type === 'RestElement') {
                        this.setLValue(elt.argument);
                    } else {
                        this.setLValue(elt);
                    }
                }
            }
        } else if (node.type === 'AssignmentPattern') {
            if (!type) {
                this.error('InternalError', 'Invalid AST');
            }
            let nullish = t.isNullish(type);
            if (nullish === 'maybe') {
                this.setLValue(node.left, t.union(type, this.expression(node.right)));
            } else if (nullish) {
                this.setLValue(node.left, this.expression(node.right));
            } else {
                this.setLValue(node.left, type);
            }
        } else if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
            let obj = this.expression(node.object);
            if (node.type === 'OptionalMemberExpression' && obj.type === 'undefined' || obj.type === 'null') {
                return;
            }
            this.setProp(obj, this.property(node.property), type ?? t.any);
        }
    }

    class(node: b.Class): Type {
        let inst = t.object();
        let variable = t.object({prototype: inst}, [], {params: [], returnType: inst});
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
                this.thisTypes.push(prop.static ? variable : inst);
                if (prop.type === 'ClassProperty') {
                    type = this.type(prop.typeAnnotation);
                } else if (prop.type === 'ClassMethod') {
                    type = this.function(prop.params, prop.typeParameters, prop.returnType, inst);
                } else {
                    this.thisTypes.pop();
                    continue;
                }
                this.thisTypes.pop();
                if (prop.static) {
                    variable.props[prop.key.name] = type;
                } else {
                    inst.props[prop.key.name] = type;
                }
            } else if (prop.type === 'StaticBlock') {
                this.error('SyntaxError', 'Static blocks are not supported');
            } else {
                this.thisTypes.push(prop.static ? variable : inst);
                let type = this.type(prop.typeAnnotation);
                for (let param of prop.parameters) {
                    let indexType = this.type(param.typeAnnotation);
                    inst.indexes.push({name: param.name, key: indexType, value: type});
                }
                this.thisTypes.pop();
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

    add(a: Type, b: Type): Type {
        if (a.type === 'union') {
            if (b.type === 'union') {
                let out = [];
                for (let x of a.types) {
                    for (let y of b.types) {
                        out.push(this.add(x, y));
                    }
                }
                return t.union(out);
            } else {
                return t.union(a.types.map(x => this.add(x, b)));
            }
        } else if (b.type === 'union') {
            return t.union(b.types.map(x => this.add(a, x)));
        }
        if (a.type === 'object') {
            if (b.type === 'object') {
                a = this.toPrimitive(a);
                b = this.toPrimitive(b);
            } else {
                a = this.toPrimitive(a, (b.type === 'number' || b.type === 'number_value' || b.type === 'bigint' || b.type === 'bigint_value') ? 'number' : 'string');
            }
        } else if (b.type === 'object') {
            b = this.toPrimitive(b, (a.type === 'number' || a.type === 'number_value' || a.type === 'bigint' || a.type === 'bigint_value') ? 'number' : 'string');
        }
        if (a.type === 'string' || a.type === 'string_value' || b.type === 'string' || b.type === 'string_value') {
            if (a.type === 'string_value' && b.type === 'string_value') {
                return t.string(a.value + b.value);
            } else if ('latin1' in a && 'latin1' in b) {
                return t.latin1String;
            } else {
                return t.string;
            }
        }
        let aIsBigInt = a.type === 'bigint' || a.type === 'bigint_value';
        let bIsBigInt = b.type === 'bigint' || b.type === 'bigint_value';
        if (aIsBigInt !== bIsBigInt) {
            this.error('TypeError', 'Cannot add bigint to non-bigint non-string');
        } else if (aIsBigInt && bIsBigInt) {
            return t.bigint;
        }
        return t.number;
    }

    expression(node: b.Expression | b.PrivateName | b.V8IntrinsicIdentifier | b.ImportExpression | b.FunctionDeclaration | b.ClassDeclaration | b.TSDeclareFunction): Type {
        this.setSourceData(node);
        let out: Type;
        switch (node.type) {
            case 'Identifier':
                return this.getVar(node.name);
            case 'PrivateName':
                this.error('SyntaxError', 'Private names are not supported');
            case 'NullLiteral':
                return t.null;
            case 'BooleanLiteral':
                return t.boolean;
            case 'NumericLiteral':
                return t.number;
            case 'StringLiteral':
                for (let i = 0; i < node.value.length; i++) {
                    if (node.value.charCodeAt(i) > 255) {
                        return t.string;
                    }
                }
                return t.latin1String;
            case 'BigIntLiteral':
                return t.bigint;
            case 'RegExpLiteral':
                return this.getGlobalVar('RegExp');
            case 'DecimalLiteral':
                this.error('SyntaxError', 'Decimal literals are not supported');
            case 'Super':
                return this.superTypes.value ?? t.undefined;
            case 'Import':
                return t.function([['module', t.string, undefined], ['options', t.object({with: t.object({}, [{name: 'key', key: t.string, value: t.string}])}), undefined]], t.any);
            case 'ThisExpression':
                return this.thisTypes.value ?? t.undefined;
            case 'ArrowFunctionExpression':
                return this.function(node.params, node.typeParameters, node.returnType);
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
                            elts = t.union<Type>(elts, t.undefined);
                        }
                    } else if (elt.type === 'SpreadElement') {
                        let type = this.expression(elt.argument);
                        if (type.type !== 'object') {
                            this.error('TypeError', 'Spread elements in array literals must be object types');
                        }
                        let newElts = t.getArrayElts(type);
                        if (newElts instanceof Array) {
                            if (elts instanceof Array) {
                                elts.push(...newElts);
                            } else {
                                elts = t.union(elts, ...newElts);
                            }
                        } else {
                            if (elts instanceof Array) {
                                elts = t.union(type, ...elts);
                            } else {
                                elts = t.union<Type>(elts, type);
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
                        out = t.intersection(out, type);
                        continue;
                    }
                    if (prop.key.type === 'PrivateName') {
                        continue;
                    }
                    let value: Type;
                    if (prop.type === 'ObjectProperty') {
                        value = this.expression(prop.value as b.Expression);
                    } else {
                        value = this.function(prop.params, prop.typeParameters, prop.returnType);
                    }
                    this.setProp(out, this.property(prop.key), value);
                }
                return out;
            case 'RecordExpression':
                this.error('SyntaxError', 'Records are not supported');
            case 'TupleExpression':
                this.error('SyntaxError', 'Tuples are not supported');
            case 'FunctionExpression':
            case 'FunctionDeclaration':
                let type = this.function(node.params, node.typeParameters, node.returnType);
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
                        return t.string;                        
                    default:
                        return t.undefined;
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
                    case '+':
                        return this.add(this.expression(node.left), this.expression(node.right));
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
                return this.getProp(this.expression(node.object), this.property(node.property));
            case 'OptionalMemberExpression':
                let obj = this.expression(node.object);
                if (obj.type === 'undefined' || obj.type === 'null') {
                    return obj;
                } else {
                    return this.getProp(obj, this.property(node.property));
                }
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
                let func = this.expression(node.callee);
                if (node.optional && (func.type === 'undefined' || func.type === 'null')) {
                    return func;
                } else {
                    return this.call(func);
                }
            case 'NewExpression':
                return this.getProp(this.expression(node.callee), 'prototype');
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
                        return t.union<Type>(t.object(), t.undefined);
                    case 'import.meta':
                        return t.object();
                    default:
                        this.error('SyntaxError', `Unrecognized meta property ${prop}`);
                }
            case 'ImportExpression':
                // return getImportType(this.fullPath, this.expression(node.source), node.options ? this.expression(node.options) : undefined);
                return t.any;
            case 'TSNonNullExpression':
                out = this.expression(node.expression);
                if (t.isNullish(out) === true) {
                    return t.any;
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
                out.props[attr.value.value] = t.string;
            }
            return out;
        }
    }

    importSpecifier(node: b.Identifier | b.StringLiteral): string {
        return node.type === 'Identifier' ? node.name : node.value;
    }
    
    statement(node: b.Statement, export_: boolean = false): void {
        if (node.type === 'ExpressionStatement') {
            this.expression(node.expression);
        } else if (node.type === 'LabeledStatement') {
            this.statement(node.body);
        } else if (node.type === 'VariableDeclaration') {
            for (let decl of node.declarations) {
                this.setLValue(decl.id, decl.init ? this.expression(decl.init) : undefined, export_);
            }
        } else if (node.type === 'FunctionDeclaration') {
            if (!node.id) {
                this.error('InternalError', 'Invalid AST');
            }
            this.setVar(node.id.name, this.function(node.params, node.typeParameters, node.returnType));
            if (export_) {
                this.export(node.id.name);
            }
        } else if (node.type === 'ClassDeclaration') {
            this.class(node);
        } else if (node.type === 'ImportDeclaration') {
            let ns = this.getImportType(node.source.value, this.importAttributes(node.attributes));
            let oldKeys = new Set(this.scope.vars.keys());
            for (let spec of node.specifiers) {
                if (spec.type === 'ImportSpecifier') {
                    this.setLValue(spec.local, this.getProp(ns, this.importSpecifier(spec.imported)));
                } else if (spec.type === 'ImportDefaultSpecifier') {
                    this.setLValue(spec.local, this.getProp(ns, 'default'));
                } else {
                    this.setLValue(spec.local, ns);
                }
            }
            // @ts-ignore
            let newKeys: Set<string> = (new Set(this.scope.vars.keys())).difference(oldKeys);
            for (let key of newKeys) {
                this.scope.imports.add(key);
            }
        } else if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                this.statement(node.declaration, true);
            }
            if (!node.source) {
                for (let spec of node.specifiers) {
                    if (spec.type === 'ExportSpecifier') {
                        this.export(spec.local.name, spec.exported.type === 'Identifier' ? spec.exported.name : spec.exported.value);
                    }
                }
            } else {
                let ns = this.getImportType(node.source.value, this.importAttributes(node.attributes));
                for (let spec of node.specifiers) {
                    let name = this.importSpecifier(spec.exported);
                    if (spec.type === 'ExportSpecifier') {
                        this.export(name, undefined, this.getProp(ns, spec.local.name));
                    } else if (spec.type === 'ExportNamespaceSpecifier') {
                        this.export(name, undefined, ns);
                    }
                }
            }
        } else if (node.type === 'ExportDefaultDeclaration') {
            this.scope.exportDefault(this.expression(node.declaration));
        } else if (node.type === 'ExportAllDeclaration') {
            let ns = this.getImportType(node.source.value, this.importAttributes(node.attributes));
            if (ns.type === 'object') {
                for (let key in ns.props) {
                    this.export(key, undefined, ns.props[key]);
                }
            }
        } else if (node.type === 'TSTypeAliasDeclaration') {
            this.scope.setType(node.id.name, this.type(node.typeAnnotation));
        } else if (node.type === 'TSInterfaceDeclaration' || node.type === 'InterfaceDeclaration') {
            let type = this.type(node.body);
            if (this.typeVarExists(node.id.name)) {
                t.objectAssign(this.getTypeVar(node.id.name) as t.Object, type as t.Object);
            } else {
                this.setTypeVar(node.id.name, type);
            }
        } else if (node.type === 'TSDeclareFunction') {
            if (!node.id) {
                this.error('InternalError', 'Invalid AST');
            }
            this.scope.setType(node.id.name, this.function(node.params, node.typeParameters, node.returnType));
        } else if (node.type === 'TSEnumDeclaration') {
            let out = t.object();
            let i = 0;
            for (let item of node.members) {
                let key = item.id.type === 'Identifier' ? item.id.name : item.id.value;
                if (item.initializer) {
                    out.props[key] = this.expression(item.initializer);
                } else {
                    out.props[key] = t.number;
                }
                i++;
            }
            this.scope.set(node.id.name, out);
            this.scope.setType(node.id.name, t.union(...Object.values(out.props)));
        } else if (node.type === 'TypeAlias') {
            this.scope.setType(node.id.name, this.type(node.right));
        }
    }

    program(node: b.Program): void {
        for (let statement of node.body) {
            this.statement(statement);
        }
    }

}
