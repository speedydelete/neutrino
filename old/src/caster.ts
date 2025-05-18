
import * as b from '@babel/types';
import {Type} from './types.js';
import {ASTManipulator} from './util.js';


export class Caster extends ASTManipulator {

    toUndefined(value: string, type: Type['type']): string {
        if (type === 'undefined') {
            return value;
        } else if (type === 'null') {
            return `((void**)${value})`;
        } else {
            return `(${value}, NULL)`;
        }
    }

    toNull(value: string, type: Type['type']): string {
        if (type === 'null') {
            return value;
        } else if (type === 'undefined') {
            return `((void*)${value})`;
        } else {
            return `(${value}, JS_NULL)`;
        }
    }

    toBoolean(value: string, type: Type['type']): string {
        switch (type) {
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
    }

    toNumber(value: string, type: Type['type']): string {
        switch (type) {
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
                this.error('TypeError',`Cannot convert symbol to number`);
            case 'object':
                return `any_to_number(object_to_primitive(${value}))`;
            case 'array':
                return `parse_number(array_to_string(${value}), 10)`;
            default:
                return `any_to_number(${value})`;
        }
    }

    toString(value: string, type: Type['type']): string {
        switch (type) {
            case 'undefined':
            case 'null':
                return `(${value}, "${type}")`;
            case 'boolean':
                return `(${value} ? "true" : "false")`;
            case 'number':
                return `number_to_string(${value}, 10)`;
            case 'string':
                return value;
            case 'symbol':
                return `(${value}, "Symbol()")`;
            default:
                return `${type}_to_string(${value})`;
        }
    }

    toSymbol(value: string, type: Type['type']): string {
        if (type !== 'symbol') {
            this.error('TypeError', `Cannot convert value of type ${type} to a symbol`);
        }
        return value;
    }

    toObject(value: string, type: Type['type']): string {
        if (type !== 'object') {
            this.error('TypeError', `Cannot convert value of type ${type} to a symbol`);
        }
        return value;
    }

    toArray(value: string, type: Type['type']): string {
        if (type !== 'array') {
            this.error('TypeError', `Cannot convert value of type ${type} to a symbol`);
        }
        return value;
    }

    toPrimitive(value: string, type: Type['type']): string {
        switch (type) {
            case 'object':
                return `object_to_primitive(${value})`;
            case 'array':
                return `array_to_string(${value})`;
            default:
                return value;
        }
    }

    toAny(value: string, type: Type['type']): string {
        if (type === 'any') {
            return value;
        } else {
            return `create_any_from_${type}(${value})`;
        }
    }
    
    to(value: string, fromType: Type | Type['type'], toType: Type | Type['type']) {
        if (typeof fromType === 'object') {
            fromType = fromType.type;
        }
        if (typeof toType === 'object') {
            toType = toType.type;
        }
        switch (toType) {
            case 'undefined':
                return this.toUndefined(value, fromType);
            case 'null':
                return this.toNull(value, fromType);
            case 'boolean':
                return this.toBoolean(value, fromType);
            case 'number':
                return this.toNumber(value, fromType);
            case 'string':
                return this.toString(value, fromType);
            case 'symbol':
                return this.toSymbol(value, fromType);
            case 'object':
                return this.toObject(value, fromType);
            case 'array':
                return this.toArray(value, fromType);
            default:
                return this.toAny(value, fromType);
        }
    }

    typeof(value: string, type: Type['type']): string {
        switch (type) {
            case 'null':
            case 'array':
                return `(${value}, "object")`;
            case 'any':
                return `typeof_any(${value})`;
            default:
                return `(${value}, "${type}")`;
        }
    }

    unary(op: b.UnaryExpression['operator'], arg: string, type: Type['type']): string {
        switch (op) {
            case '!':
                return '!' + this.toBoolean(arg, type);
            case '+':
            case '-':
            case '~':
                return op + this.toNumber(arg, type);
            case 'typeof':
                return this.typeof(arg, type);
            case 'void':
                return `(${arg}, NULL)`;
            case 'throw':
                return 'throw(' + arg + ')';
            default:
                this.error('InternalError', `Invalid unary operator: ${op}`);
        }
    }

    eq(x: string, xt: Type['type'], y: string, yt: Type['type']): string {
        if (xt === 'any' || yt === 'any') {
            return `equal(${this.toAny(x, xt)}, ${this.toAny(y, yt)})`;
        } else if (xt === 'undefined' || xt === 'null' || yt === 'undefined' || yt === 'null') {
            return `(${x}, ${y}, ${(xt === 'undefined' || xt === 'null') && (yt === 'undefined' || yt === 'null')})`;
        } else if (xt === 'symbol' || yt === 'symbol') {
            if (xt === 'symbol' && yt === 'symbol') {
                return `(${x} == ${y})`;
            } else {
                return `(${x}, ${y}, false)`;
            }
        }else if (xt === 'object' || yt === 'object' || xt === 'array' || yt === 'array') {
            if ((xt === 'object' || xt === 'array') && (yt === 'object' || yt === 'array')) {
                return `(${x} == ${y})`;
            } else {
                return `equal(${this.toPrimitive(x, xt)}, ${this.toPrimitive(y, yt)})`;
            }
        } else if (xt === 'string' || yt === 'string') {
            return `(strcmp(${this.toString(x, xt)}, ${this.toString(y, yt)}) == 0)`;
        } else {
            return `(${x} == ${y})`;
        }
    }

    seq(x: string, xt: Type['type'], y: string, yt: Type['type']): string {
        if (xt === 'any' || yt === 'any') {
            return `strict_equal(${this.toAny(x, xt)}, ${this.toAny(y, yt)})`;
        } else if (xt !== yt) {
            return `(${x}, ${y}, false)`;
        } else if (xt === 'undefined' || xt === 'null') {
            return `(${x}, ${y}, true)`;
        } else if (xt === 'string') {
            return `(strcmp(${x}, ${y}) == 0)`;
        } else {
            return `(${x} == ${y})`
        }
    }

    instanceof(x: string, xt: Type['type'], y: string, yt: Type['type']): string {
        if (xt === 'object' && yt === 'object') {
            return `instanceof(${x}, ${y})`;
        } else {
            this.error('TypeError', `Cannot use instanceof operator on values of types ${xt} and ${yt}`);
        }
    }
    
    binary(op: b.BinaryExpression['operator'], x: string, xt: Type['type'], y: string, yt: Type['type']): string {
        switch (op) {
            case '==':
                return this.eq(x, xt, y, yt);
            case '!=':
                return '!' + this.eq(x, xt, y, yt);
            case '===':
                return this.seq(x, xt, y, yt);
            case '!==':
                return '!' + this.seq(x, xt, y, yt);
            case '+':
                if (xt === 'string' || yt === 'string') {
                    return `stradd(${this.toString(x, xt)}, ${this.toString(y, yt)})`;
                } else {
                    return this.toNumber(x, xt) + ' + ' + this.toNumber(y, yt);
                }
            case '<':
            case '<=':
            case '>':
            case '>=':
            case '-':
            case '*':
            case '/':
                return this.toNumber(x, xt) + ' ' + op + ' ' + this.toNumber(y, yt);
            case '%':
                return `fmod(${this.toNumber(x, xt)}, ${this.toNumber(y, yt)})`;
            case '**':
                return `pow(${this.toNumber(x, xt)}, ${this.toNumber(y, yt)})`;
            case '&':
            case '^':
            case '|':
            case '<<':
            case '>>>':
                return `(double)((uint32_t)${this.toNumber(x, xt)} ${op} (uint32_t)${this.toNumber(y, yt)})`;
            case '>>':
                return `(double)((int32_t)${this.toNumber(x, xt)} >>> (int32_t)${this.toNumber(y, yt)})`;
            case 'instanceof':
                return this.instanceof(x, xt, y, yt);
            case '|>':
                this.error('SyntaxError', 'The pipeline operator is not supported');
            default:
                this.error('InternalError', `Invalid binary operator: ${op}`);
        }
    }

}
