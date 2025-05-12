
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import * as t from './types.js';
import {Type} from './types.js';
import {Stack, Scope, ASTManipulator} from './util.js';


export class Inferrer extends ASTManipulator {

    thisTypes: Stack<Type>;
    superTypes: Stack<Type>;

    constructor(fullPath: string, raw: string, scope?: Scope, useGlobalThis: boolean = true) {
        super(fullPath, raw, scope);
        this.thisTypes = this.createStack(useGlobalThis ? [this.getVar('globalThis')] : []);
        this.superTypes = this.createStack();
    }

    getImportType(path: string, attrs?: t.Object): Type {
        return t.any;
    }

    property(node: b.Expression | b.PrivateName): PropertyKey | Type {
        return node.type === 'Identifier' ? node.name : this.expression(node);
    }

    function(params: (b.Identifier | b.RestElement | b.Pattern | b.TSParameterProperty)[], returnType?: b.FunctionDeclaration['returnType'], obj?: t.Object): t.Object {
        let outParams: t.Parameter[] = [];
        let restParam: t.RestParameter | undefined = undefined;
        for (let param of params) {
            if (param.type === 'RestElement') {
                restParam = [this.getRaw(param.argument), this.type(param.typeAnnotation)];
            } else if (param.type === 'TSParameterProperty') {
                this.error('SyntaxError', 'Parameter properties are not supported');
            } else if (param.type === 'AssignmentPattern') {
                outParams.push([this.getRaw(param.left), this.type(param.typeAnnotation), param.right]);
            } else if (param.type === 'Identifier') {
                let out: t.Parameter = [param.name, this.type(param.typeAnnotation), null];
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
            out = t.copy(ftype);
        } else {
            out = obj;
        }
        out.call = {
            params: outParams,
            restParam,
            returnType: returnType ? this.type(returnType) : t.any,
        };
        return out;
    }

    callComments(comments: b.Comment[], call: t.CallData | null): void {
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
                if (prop.key.type !== 'Identifier') {
                    this.error('SyntaxError', 'Type literal keys cannot be computed');
                }
                out.props[prop.key.name] = this.type(prop.typeAnnotation);
            } else if (prop.type === 'TSMethodSignature') {
                if (prop.key.type !== 'Identifier') {
                    this.error('SyntaxError', 'Type literal keys cannot be computed');
                }
                if (prop.kind === 'get') {
                    out.props[prop.key.name] = this.type(prop.typeAnnotation);
                } else if (prop.kind === 'method') {
                    let type = this.function(prop.parameters, prop.typeAnnotation);
                    if (prop.leadingComments && prop.leadingComments.length > 0) {
                        this.callComments(prop.leadingComments, type.call);
                    }
                    out.props[prop.key.name] = type;
                }
            } else if (prop.type === 'TSCallSignatureDeclaration') {
                this.function(prop.parameters, prop.typeAnnotation, out);
                if (prop.leadingComments && prop.leadingComments.length > 0) {
                    this.callComments(prop.leadingComments, out.call);
                }
            } else if (prop.type === 'TSIndexSignature') {
                let valueType = this.type(prop.typeAnnotation);
                for (let param of prop.parameters) {
                    let type = this.type(param.typeAnnotation);
                    if (!(type.type === 'string' || type.type === 'number' || type.type === 'symbol')) {
                        this.error('TypeError', `Type ${type} cannot be used as an index type`);
                    }
                    out.indexes[type.type] = valueType;
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
                let type = this.function(node.parameters, node.typeAnnotation);
                if (node.leadingComments && node.leadingComments.length > 0) {
                    this.callComments(node.leadingComments, type.call);
                }
                return type;
            case 'TSUnionType':
                return t.union(node.types.map(x => this.type(x)));
            case 'TSIntersectionType':
                return t.intersection(node.types.map(x => this.type(x)));
            case 'TSConditionalType':
                throw new TypeError('Conditional types are not supported');
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
                this.error('TypeError', 'Import types are not supported');
            case 'TSTemplateLiteralType':
                this.error('TypeError', 'Template literal types are not supported');
            case 'TSTypeReference':
                if (node.typeName.type === 'Identifier') {
                    return this.getTypeVar(node.typeName.name);
                } else {
                    this.error('SyntaxError', 'Qualified names are not supported');
                }
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
        let variable = t.object({prototype: inst}, {params: [], returnType: inst});
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
                    type = this.function(prop.params, prop.returnType, inst);
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
                    if (!(indexType.type === 'string' || indexType.type === 'number' || indexType.type === 'symbol')) {
                        this.error('TypeError', `Type ${indexType} cannot be used as an index type`);
                    }
                    inst.indexes[indexType.type] = type;
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
                return t.string;
            case 'BigIntLiteral':
                this.error('SyntaxError', 'BigInts are not supported');
            case 'RegExpLiteral':
                return this.getGlobalVar('RegExp');
            case 'DecimalLiteral':
                this.error('SyntaxError', 'Decimal literals are not supported');
            case 'Super':
                return this.superTypes.value ?? t.undefined;
            case 'Import':
                return t.function([['module', t.string, null], ['options', t.object({with: t.object({}, null, {string: t.string})}), null]], t.any);
            case 'ThisExpression':
                return this.thisTypes.value ?? t.undefined;
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
                        if (type.type !== 'array') {
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
                        out = t.intersection(out, type);
                        if (out.type === 'any') {
                            break;
                        }
                        continue;
                    }
                    if (prop.key.type === 'PrivateName') {
                        continue;
                    }
                    let value: Type;
                    if (prop.type === 'ObjectProperty') {
                        value = this.expression(prop.value as b.Expression);
                    } else {
                        value = this.function(prop.params, prop.returnType);
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
                        let left = this.expression(node.left);
                        let right = this.expression(node.right);
                        return left.type === 'string' || right.type === 'string' ? t.string : t.number;
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
                        return t.union(t.object(), t.undefined);
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
            this.setVar(node.id.name, this.function(node.params, node.returnType));
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
            let newKeys = (new Set(this.scope.vars.keys())).difference(oldKeys);
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
        } else if (node.type === 'TSInterfaceDeclaration') {
            this.pushScope();
            if (node.typeParameters) {
                for (let param of node.typeParameters.params) {
                    this.setTypeVar(param.name, param.constraint ? this.type(param.constraint) : t.any);
                }
            }
            let type = this.objectType(node.body.body);
            this.popScope();
            if (this.typeVarExists(node.id.name)) {
                t.objectAssign(this.getTypeVar(node.id.name) as t.Object, type);
            } else {
                this.setTypeVar(node.id.name, type);
            }
        } else if (node.type === 'TSDeclareFunction') {
            if (!node.id) {
                this.error('InternalError', 'Invalid AST');
            }
            this.scope.setType(node.id.name, this.function(node.params, node.returnType));
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
        }
    }

    program(node: b.Program): void {
        for (let statement of node.body) {
            this.statement(statement);
        }
    }

}
