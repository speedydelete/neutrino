
import {t, Type} from './types';
import {ASTManipulator} from './util';


export interface To {
    (newType: Type, value: string, type: Type): string;
    undefined(value: string, type: Type): string;
    null(value: string, type: Type): string;
    boolean(value: string, type: Type): string;
    string(value: string, type: Type): string;
    symbol(value: string, type: Type): string;
    bigint(value: string, type: Type): string;
    object(value: string, type: Type): string;
}


function createWrapper(to: (newType: Type, value: string, type: Type) => string, newType: Type): (value: string, type: Type) => string {
    return (value: string, type: Type) => to(value, type, newType);
}

export function createTo(manipulator: ASTManipulator): To {
    let error: ASTManipulator['error'] = manipulator.error.bind(manipulator);
    function to<T extends Type>(newType: T, value: string, type: Type): string {
        switch (newType.type) {
            case 'undefined':
            case 'null':
                return type.type === 'undefined' || type.type === 'null' ? value : `(${value}, NULL)`;
            case 'boolean':
                switch (type.type) {
                    case 'undefined':
                    case 'null':
                        return `(${value}, false)`;
                    case 'boolean':
                    case 'number':
                        return value;
                    case 'string':
                        return `(${value} == '\0')`;
                    case 'any':
                        return `any_to_boolean(${value})`;
                    default:
                        return `(${value}, true)`;
                }
            case 'number':
                switch (type.type) {
                    case 'undefined':
                        return `(${value}, NaN)`;
                    case 'null':
                        return `(${value}, null)`;
                    case 'boolean':
                        return `((double)${value})`;
                    case 'number':
                        return value;
                    case 'string':
                        return `parse_number(${value})`;
                    case 'symbol':
                        error('TypeError',`Cannot convert symbol to number`);
                    case 'object':
                        if (type.specialName) {
                            switch (type.specialName) {
                                case 'array':
                                    return `parse_number(array_to_string(${value}), 10)`;
                                case 'proxy':
                                    return `any_to_number(proxy_to_primitive(${value}))`;
                                default:
                                    error('InternalError', `Invalid special name: ${type.specialName}`);
                            }
                        }
                        return `any_to_number(object_to_primitive(${value}))`;
                    default:
                        return `any_to_number(${value})`;
                }
            default:
                error('InternalError', `Cannot cast to type ${type}`);
        }
    }
    return Object.assign(to, {
        undefined: createWrapper(to, t.undefined),
        null: createWrapper(to, t.null),
        boolean: createWrapper(to, t.boolean),
        string: createWrapper(to, t.string),
        symbol: createWrapper(to, t.symbol),
        bigint: createWrapper(to, t.bigint),
        object: createWrapper(to, t.object),
    });
}
