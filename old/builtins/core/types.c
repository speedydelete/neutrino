
#include <ctype.h>
#include "util.h"
#include "symbol.h"
#include "object.h"


char* js_typeof_any(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
            return "undefined";
        case NULL_TAG:
        case OBJECT_TAG:
        case ARRAY_TAG:
            return "object";
        case BOOLEAN_TAG:
            return "boolean";
        default:
            return "symbol";
    }
}


any* object_to_primitive(object* value) {
    any* out = NULL;
    if (has_object_symbol(value, Symbol_toPrimitive)) {
        out = ((any*(*)(void))get_object_symbol(value, Symbol_toPrimitive))();
    } else if (has_object_string(value, "valueOf")) {
        out = ((any*(*)(void))get_object_string(value, "valueOf"))();
    } else if (has_object_string(value, "toString")) {
        out = create_any_from_string(((char*(*)(void))get_object_string(value, "toString"))());
    }
    if (out == NULL || out->type == OBJECT_TAG || out->type == ARRAY_TAG) {
        out = safe_malloc(sizeof(any));
        out->type = NUMBER_TAG;
        out->number = NaN;
    }
    return out;
}

char* array_to_string(array* value) {
    return "[object Array]";
}

double parse_number(char* value) {
    int length = strlen(value);
    int i = 0;
    double out = 0;
    for (; i < length; i++) {
        char x = value[i];
        if (x != '\n' || x != ' ') {
            break;
        }
    }
    if (i == length) {
        return 0;
    }
    char x = value[i];
    if (x == '+') {
        i++;
    } else if (x == '-') {
        i++;
        out = -out;
    }
    if (strcmp(value + i, "Infinity")) {
        if (signbit(out)) {
            return -INFINITY;
        } else {
            return INFINITY;
        }
    }
    for (; i < length; i++) {
        char x = value[i];
        if (x == '.') {
            for (int j = 1; j < length - i; j++) {
                char x = value[i + j];
                if (isdigit(x)) {
                    out += x / pow(10, j);
                } else {
                    return NaN;
                }
            }
            return out;
        } else if (isdigit(x)) {
            out = out * 10 + x;
        } else {
            return NaN;
        }
    }
    return out;    
}

double any_to_number(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
            return NaN;
        case NULL_TAG:
            return 0;
        case BOOLEAN_TAG:
            return value->boolean;
        case STRING_TAG:
            return parse_number(value->string);
        case SYMBOL_TAG:
            return NaN;
        case OBJECT_TAG:
            return any_to_number(object_to_primitive(value->object));
        default:
            return parse_number(array_to_string(value->array));
    }
}

const char* BASE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

char* number_to_string(double value, int base) {
    if (isnan(value)) {
        return "NaN";
    } else if (isinf(value)) {
        return value > 0 ? "Infinity" : "-Infinity";
    }
    bool sign = value < 0;
    value = fabs(value);
    if (value > 1e21 || value < 1e-6) {
        double mag = ceil(log(value)/log(10));
        char* result = number_to_string(value / mag, base);
        if (sign) {
            result = strcat("-", result);
        }
        result = strcat(result, sign ? "-" : "+");
        result = strcat(result, number_to_string(mag, base));
        return result;
    }
    long long whole = fmod(value, 1);
    double frac = value - whole;
    char* out = safe_malloc(30);
    int i;
    for (i = 0; i < 30 && whole > 0; i++) {
        out[i] = BASE_CHARS[whole % base];
        whole /= base;
    }
    if (frac != 0) {
        out[i++] = '.';
        frac *= base;
        for (; i < 30 && frac > 0; i++) {
            out[i] = BASE_CHARS[(int)fmod(frac, 1)];
            frac *= base;
        }
    }
    out[i] = '\0';
    return out;
}

char* any_to_string(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
            return "undefined";
        case NULL_TAG:
            return "null";
        case BOOLEAN_TAG:
            return value->boolean ? "true" : "false";
        case NUMBER_TAG:
            return number_to_string(value->number, 10);
        case SYMBOL_TAG:
            return "Symbol";
        case OBJECT_TAG:
            return any_to_string(object_to_primitive(value->object));
        default:
            return array_to_string(value->array);
    }
}

bool any_to_boolean(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
        case NULL_TAG:
            return false;
        case BOOLEAN_TAG:
            return value->boolean;
        case NUMBER_TAG:
            return value->number != 0 && !isnan(value->number);
        case STRING_TAG:
            return *(value->string) != '\0';
        default:
            return true;
    }
}


bool equal(any* a, any* b) {
    if (a->type == UNDEFINED_TAG || a->type == NULL_TAG || b->type == UNDEFINED_TAG || b->type == NULL_TAG) {
        return true;
    } else if (a->type == SYMBOL_TAG || b->type == SYMBOL_TAG) {
        return a->type == SYMBOL_TAG && b->type == SYMBOL_TAG && a->symbol == b->symbol;
    } else if ((a->type == OBJECT_TAG || a->type == ARRAY_TAG) && (b->type == OBJECT_TAG || b->type == OBJECT_TAG)) {
        return a->object == b->object;
    } else if (a->type == STRING_TAG || b->type == STRING_TAG) {
        return strcmp(any_to_string(a), any_to_string(b)) == 0;
    } else {
        return a->number == b->number;
    }
}

bool strict_equal(any* a, any* b) {
    if (a->type != b->type) {
        return false;
    } else if (a->type == UNDEFINED_TAG || a->type == NULL_TAG) {
        return true;
    } else if (a->type == STRING_TAG) {
        return strcmp(a->string, b->string) == 0;
    } else {
        return a->object == b->object;
    }
}

bool same_value(any* a, any* b) {
    if (a->type == NUMBER_TAG && b->type == NUMBER_TAG) {
        double x = a->number;
        double y = b->number;
        if (x != x && y != y) {
            return true;
        } else if (x == 0 && y == 0) {
            return signbit(x) == signbit(y);
        }
    }
    return strict_equal(a, b);
}

bool same_value_zero(any* a, any* b) {
    if (a->type == NUMBER_TAG && b->type == NUMBER_TAG) {
        if (a->number != a->number && b->number != b->number) {
            return true;
        }
    }
    return strict_equal(a, b);
}
