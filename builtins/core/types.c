
#include <stdbool.h>
#include <math.h>
#include "object.h"
#include "array.h"

#include "types.h"


#define NaN (double)NAN


static inline char* return_undefined(void* x) {return "undefined";}
static inline char* return_null(void** x) {return "null";}
static inline char* return_boolean(bool x) {return "boolean";}
static inline char* return_number(double x) {return "number";}
static inline char* return_string(char* x) {return "string";}
static inline char* return_symbol(symbol x) {return "symbol";}
static inline char* return_object(object* x) {return "object";}
static inline char* return_object_array(array* x) {return "array";}

static inline bool identity_boolean(bool x) {return x;}
static inline double identity_number(double x) {return x;}
static inline double identity_number_boolean(bool x) {return (double)x;}
static inline char* identity_string(char* x) {return x;}

static inline bool return_false_undefined(void* x) {return false;}

static inline bool return_true_symbol(symbol x) {return true;}
static inline bool return_true_object(object* x) {return true;}
static inline bool return_true_array(array* x) {return true;}

static inline double return_0_null(void** x) {return 0;}

static inline double return_nan_undefined(void* x) {return NaN;}
static inline double return_nan_symbol(symbol x) {return NaN;}


enum Type {
    UNDEFINED_TAG,
    NULL_TAG,
    BOOLEAN_TAG,
    NUMBER_TAG,
    STRING_TAG,
    SYMBOL_TAG,
    OBJECT_TAG,
    ARRAY_TAG,
};

typedef struct any {
    enum Type type;
    union {
        void* undefined;
        void** null;
        bool boolean;
        double number;
        char* string;
        symbol symbol;
        object* object;
        array* array;
    };
} any;

#define create_any_factory(name, tag, type_, slot) \
    any* name(type_ value) { \
        any* out; \
        safe_malloc(out, sizeof(any*)); \
        out->type = tag; \
        out->slot = value; \
        return out; \
    }

create_any_factory(create_any_from_undefined, UNDEFINED_TAG, void*, undefined)
create_any_factory(create_any_from_null, NULL_TAG, void**, null)
create_any_factory(create_any_from_boolean, BOOLEAN_TAG, bool, boolean)
create_any_factory(create_any_from_number, NUMBER_TAG, double, number)
create_any_factory(create_any_from_string, STRING_TAG, char*, string)
create_any_factory(create_any_from_symbol, SYMBOL_TAG, symbol, symbol)
create_any_factory(create_any_from_object, SYMBOL_TAG, object*, object)
create_any_factory(create_any_from_array, ARRAY_TAG, array*, array)

static inline any* create_any_from_any(any* x) {return x;}

#define create_any(value) _Generic((value), \
    void*: create_any_from_undefined, \
    void**: create_any_from_null, \
    bool: create_any_from_boolean, \
    double: create_any_from_number, \
    char*: create_any_from_string, \
    symbol: create_any_from_symbol, \
    object*: create_any_from_object, \
    array*: create_any_from_array, \
    any*: create_any_from_any \
)(value)


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

#define js_typeof(x) _Generic((x), \
    void*: return_undefined, \
    void**: return_object, \
    bool: return_boolean, \
    double: return_number, \
    char*: return_string, \
    symbol: return_symbol, \
    object*: return_object, \
    array*: return_object_array, \
    any*: js_typeof_any \
)(x)

any* object_to_primitive(object* value) {
    any* out = NULL;
    if (has_obj(value, Symbol_toPrimitive)) {
        out = (any*)(call_obj(value, Symbol_toPrimitive, "default"));
    } else if (has_obj(value, "valueOf")) {
        out = (any*)(call_obj(value, "valueOf"));
    } else if (has_obj(value, "toString")) {
        out = (any*)call_obj(value, "toString");
    }
    if (out == NULL || out->type == OBJECT_TAG || out->type == ARRAY_TAG) {
        safe_malloc(out, sizeof(any));
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

double cast_any_to_number(any* value) {
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
            return cast_any_to_number(object_to_primitive(value->object));
        default:
            return parse_number(array_to_string(value->array));
    }
}

static inline double cast_to_number_object(object* x) {return cast_any_to_number(object_to_primitive(x));}
static inline double cast_to_number_array(array* x) {return parse_number(array_to_string(x));}
#define cast_to_number(x) _Generic((x), void*: return_nan_undefined, void**: return_0_null, bool: identity_number_boolean, double: identity_number, char*: parse_number, symbol: return_nan_symbol, object*: cast_to_number_object, array*: cast_to_number_array)(x)

const char* BASE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

char* number_to_string(double value, int base) {
    if (isnan(value)) {
        return "NaN";
    } else if (isinf(value)) {
        return value > 0 ? "Infinity" : "-Infinity";
    }
    bool sign = value < 0;
    value = abs(value);
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
    char* out;
    safe_malloc(out, 30);
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

char* cast_any_to_string(any* value) {
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
            return cast_any_to_string(object_to_primitive(value->object));
        default:
            return array_to_string(value->array);
    }
}

#define cast_to_string(x) _Generic((x), void*: return_undefined, void**: return_null, bool: cast_to_string_boolean, double: number_to_string, char*: identity_string, symbol: return_symbol, object*: cast_to_string_object, array*: array_to_string, any*: cast_any_to_string)(x)

static inline char* cast_to_string_boolean(bool x) {return x ? "true" : "false";}
static inline char* cast_to_string_object(object* x) {return cast_any_to_string(object_to_primitive(x));}

bool cast_any_to_boolean(any* value) {
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

static inline bool cast_to_boolean_number(double x) {return x != 0 && !isnan(x);}
static inline bool cast_to_boolean_string(char* x) {return *x != '\0';}
#define cast_to_boolean(x) _Generic(x, void*: return_false_undefined, void**: return_false_undefined, bool: identity_boolean, double: cast_to_boolean_number, char*: cast_to_boolean_string, symbol: return_true_symbol, object*: return_true_object, array*: return_true_array, any*: cast_any_to_boolean)(x)
