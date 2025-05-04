
import * as b from '@babel/types';
import * as parser from '@babel/parser';
import * as t from './types';
import {Scope, Type} from './types';
import {CompilerError} from './errors';


export let thisType: Type = t.undefined;

export function parseFunction(params: (b.Identifier | b.RestElement | b.Pattern | b.TSParameterProperty)[], returnType: b.FunctionDeclaration['returnType'], construct: boolean = false, obj?: t.Object): t.Object {
    let outParams: t.Parameter[] = [];
    let restParam: t.Parameter | null = null;
    for (let param of params) {
        CompilerError.setSrcFromNode(param);
        if (param.type === 'RestElement') {
            restParam = [CompilerError.getRaw(param.argument), parseType(param.typeAnnotation)];
        } else if (param.type === 'TSParameterProperty') {
            throw new CompilerError('SyntaxError', 'Parameter properties are not supported');
        } else {
            outParams.push([CompilerError.getRaw(param), parseType(param.typeAnnotation)]);
        }
    }
    if (!obj) {
        if (construct) {
            return t.constructor(outParams, parseType(returnType), restParam);
        } else {
            return t.function(outParams, parseType(returnType), restParam);
        }
    } else {
        let out = {
            params: outParams,
            restParam,
            returnType: parseType(returnType),
        };
        if (construct) {
            obj.construct = out;
        } else {
            obj.call = out;
        }
        return obj;
    }
}

export function parseObject(nodes: b.TSTypeElement[]): Type {
    let out = t.object({});
    for (let prop of nodes) {
        CompilerError.setSrcFromNode(prop);
        if (prop.type === 'TSPropertySignature') {
            if (prop.key.type !== 'Identifier') {
                throw new CompilerError('SyntaxError', 'Type literal keys must not be computed');
            }
            out.props[prop.key.name] = parseType(prop.typeAnnotation);
        } else if (prop.type === 'TSMethodSignature') {
            if (prop.key.type !== 'Identifier') {
                throw new CompilerError('SyntaxError', 'Type literal keys must not be computed');
            }
            if (prop.kind === 'get') {
                out.props[prop.key.name] = parseType(prop.typeAnnotation);
            } else if (prop.kind === 'method') {
                out.props[prop.key.name] = parseFunction(prop.parameters, prop.typeAnnotation, false);
            }
        } else if (prop.type === 'TSCallSignatureDeclaration') {
            parseFunction(prop.parameters, prop.typeAnnotation, false, out);
        } else if (prop.type === 'TSConstructSignatureDeclaration') {
            parseFunction(prop.parameters, prop.typeAnnotation, true, out);
        } else {
            let type = parseType(prop.typeAnnotation);
            for (let param of prop.parameters) {
                out.indexes.push([param.name, parseType(param.typeAnnotation), type]);
            }
        }
    }
    return out;
}

export function parseType(node: b.TSType | b.TSTypeAnnotation | b.TypeAnnotation | undefined | null | b.Noop): Type {
    if (!node || node.type === 'Noop') {
        return t.any;
    }
    CompilerError.setSrcFromNode(node);
    switch (node.type) {
        case 'TSTypeAnnotation':
            return parseType(node.typeAnnotation);
        case 'TSParenthesizedType':
            return parseType(node.typeAnnotation);
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
            return thisType ?? t.undefined;
        case 'TSLiteralType':
            let x = node.literal;
            CompilerError.setSrcFromNode(x);
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
                    throw new CompilerError('InternalError', `Bad/unrecongnized AST literal type subnode in types.parse() of type ${node.type}`);
            }
        case 'TSArrayType':
            return t.array(parseType(node.elementType));
        case 'TSTupleType':
            return t.array(node.elementTypes.map(x => parseType(x.type === 'TSNamedTupleMember' ? x.elementType : x)));
        case 'TSTypeLiteral':
            return parseObject(node.members);
        case 'TSFunctionType':
            return parseFunction(node.parameters, node.typeAnnotation, false);
        case 'TSConstructorType':
            return parseFunction(node.parameters, node.typeAnnotation, true);
        case 'TSUnionType':
            return t.union(...node.types.map(x => parseType(x)));
        case 'TSIntersectionType':
            return t.intersection(...node.types.map(x => parseType(x)));
        case 'TSConditionalType':
            throw new TypeError('Conditional types are not supported');
        case 'TSIndexedAccessType':
            let obj = parseType(node.objectType);
            if (obj.type !== 'object') {
                throw new CompilerError('TypeError', `Indexed access types must be used with an object type`);
            }
            let prop = parseType(node.indexType);
            if ((prop.type === 'string' || prop.type === 'number') && 'value' in prop) {
                return obj.props[prop.value];
            } else {
                for (let [_, type, result] of obj.indexes) {
                    if (t.matches(prop, type)) {
                        return result;
                    }
                }
                throw new CompilerError('TypeError', `Invalid type for indexed access type: ${prop}`);
            }
        case 'TSMappedType':
            return t.object({}, null, [[node.typeParameter.name, parseType(node.typeParameter.constraint), parseType(node.typeAnnotation)]]);
        case 'TSImportType':
            throw new CompilerError('TypeError', 'Import types are not supported');
        case 'TSTemplateLiteralType':
            throw new CompilerError('TypeError', 'Template literal types are not supported');
        default:
            throw new CompilerError('InternalError', `Bad/unrecongnized AST node in types.parse() of type ${node.type}`);
    }
}

function typeofOperator(type: Type): Type {
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
            return t.union(...type.types.map(typeofOperator));
        default:
            return t.union(t.string('undefined'), t.string('object'), t.string('boolean'), t.string('number'), t.string('string'), t.string('symbol'), t.string('bigint'));
    }
}

export function expression(scope: Scope, node: b.Expression): Type {
    CompilerError.setSrcFromNode(node);
    let out: Type;
    switch (node.type) {
        case 'Identifier':
            return scope.get(node.name);
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
            return scope.get('RegExp');
        case 'DecimalLiteral':
            throw new CompilerError('SyntaxError', 'Decimal literals are not supported');
        case 'ThisExpression':
            return thisType ?? t.undefined;
        case 'ArrowFunctionExpression':
            return parseFunction(node.params, node.returnType);
        case 'YieldExpression':
            return t.any;
        case 'AwaitExpression':
            out = expression(scope, node.argument);
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
                    let type = expression(scope, elt.argument);
                    if (!('isArray' in type)) {
                        throw new CompilerError('TypeError', 'Spread elements in array literals must be array types');
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
                    let type = expression(scope, elt);
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
                    let type = expression(scope, prop.argument);
                    if (type.type !== 'object' || 'isArray' in type) {
                        throw new CompilerError('TypeError', 'Spread elements in object literals must be object types');
                    }
                    out = t.resolveObjectIntersection(out, type);
                    continue;
                }
                if (prop.key.type === 'PrivateName') {
                    continue;
                }
                let key = expression(scope, prop.key);
                if ((key.type === 'string' || key.type === 'number') && 'value' in key) {
                    if (prop.type === 'ObjectProperty') {
                        out.props[key.value] = expression(scope, prop.value as b.Expression);
                    } else {
                        out.props[key.value] = parseFunction(prop.params, prop.returnType);
                    }
                }
            }
            return out;
        case 'RecordExpression':
            throw new CompilerError('SyntaxError', 'Records are not supported');
        case 'TupleExpression':
            throw new CompilerError('SyntaxError', 'Tuples are not supported');
        case 'FunctionExpression':
            let type = parseFunction(node.params, node.returnType);
            if (node.id) {
                scope.set(node.id.name, type);
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
                    return typeofOperator(expression(scope, node.argument));
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
                    throw new CompilerError('SyntaxError', 'The pipeline operator is not supported');
                default:
                    return t.number;
            }
        case 'AssignmentExpression':
            return expression(scope, node.right);
        case 'LogicalExpression':
            let left = expression(scope, node.left);
            let right = expression(scope, node.right);
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
        default:
            throw new CompilerError('InternalError', `Bad/unrecongnized AST node in inferrer.expression() of type ${node.type}`);
    }
}

export function statement(scope: Scope, node: b.Statement): void {
    if (node.type === 'ExpressionStatement') {
        expression(scope, node.expression);
    } else if (node.type === 'LabeledStatement') {
        statement(scope, node.body);
    } else if (node.type === 'VariableDeclaration') {
        for (let decl of node.declarations) {
            scope.setLValue(decl.id, node.kind === 'const', parseType, decl.init ? expression(scope, decl.init) : undefined);
        }
    } else if (node.type === 'FunctionDeclaration') {
        if (!node.id) {
            throw new Error('Invalid AST');
        }
        scope.set(node.id.name, parseFunction(node.params, node.returnType, false));
    } else if (node.type === 'ClassDeclaration') {
        if (!node.id) {
            throw new Error('Invalid AST');
        }
        let inst = t.object();
        let variable = t.object({}, {params: [], returnType: inst, restParam: null});
        for (let prop of node.body.body) {
            CompilerError.setSrcFromNode(prop);
            if ('key' in prop) {
                if (prop.key.type !== 'Identifier') {
                    throw new CompilerError('SyntaxError', 'Class property keys cannot be computed');
                }
                let type: Type;
                if (prop.type === 'ClassProperty') {
                    let oldThisType = thisType;
                    thisType = prop.static ? variable : inst;
                    type = parseType(prop.typeAnnotation);
                    thisType = oldThisType;
                } else if (prop.type === 'ClassMethod') {
                    let oldThisType = thisType;
                    thisType = prop.static ? variable : inst;
                    type = parseFunction(prop.params, prop.returnType, false, inst);
                    thisType = oldThisType;
                } else {
                    continue;
                }
                if (prop.static) {
                    variable.props[prop.key.name] = type;
                } else {
                    inst.props[prop.key.name] = type;
                }
            } else if (prop.type === 'StaticBlock') {
                throw new CompilerError('SyntaxError', 'Static blocks are not supported');
            } else {
                let oldThisType = thisType;
                thisType = prop.static ? variable : inst;
                let type = parseType(prop.typeAnnotation);
                for (let param of prop.parameters) {
                    variable.indexes.push([param.name, parseType(param.typeAnnotation), type]);
                }
                thisType = oldThisType;
            }
        }
        scope.set(node.id.name, variable);
        scope.setType(node.id.name, inst);
    } else if (node.type === 'TSTypeAliasDeclaration') {
        scope.setType(node.id.name, parseType(node.typeAnnotation));
    } else if (node.type === 'TSInterfaceDeclaration') {
        scope.setType(node.id.name, parseObject(node.body.body));
    } else if (node.type === 'TSDeclareFunction') {
        if (!node.id) {
            throw new Error('Invalid AST');
        }
        scope.setType(node.id.name, parseFunction(node.params, node.returnType, false));
    } else if (node.type === 'TSEnumDeclaration') {
        let out = t.object();
        let i = 0;
        for (let item of node.members) {
            let key = item.id.type === 'Identifier' ? item.id.name : item.id.value;
            if (item.initializer) {
                out.props[key] = expression(scope, item.initializer);
            } else {
                out.props[key] = t.number(i);
            }
            i++;
        }
        scope.set(node.id.name, out);
        scope.setType(node.id.name, t.union(...Object.values(out.props)));
    }
}
