
#ifndef NEUTRINO_VERSION

#define NEUTRINO_VERSION "0.1.0"

#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <inttypes.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <stdarg.h>


#define safe_malloc(ptr, size) \
    do { \
        ptr = malloc(size); \
        if (!ptr) { \
            fprintf(stderr, "InternalError: malloc failed\n"); \
            exit(4); \
        } \
    } while (0);


void** js_null = (void**)0;

double NaN = (double)NAN;


typedef uint64_t symbol;
symbol next_symbol = 0;
#define create_symbol() next_symbol++;

symbol Symbol_toPrimitive;

void create_well_known_symbols() {
    Symbol_toPrimitive = create_symbol();
}


struct object;

struct property {
    struct property* next;
    char* key;
    bool is_accessor;
    union {
        void* value;
        struct {
            void* (*get)(struct object* this);
            void (*set)(struct object* this, void* value);
        } funcs;
    };
};

struct symbol_property {
    struct symbol_property* next;
    symbol key;
    bool is_accessor;
    union {
        void* value;
        struct {
            void* (*get)(struct object* this);
            void (*set)(struct object* this, void* value);
        } funcs;
    };
};

typedef struct object {
    struct object* prototype;
    struct property* data[16];
    struct symbol_property* symbols;
} object;


int hash4(char* str) {
    int hash = 0;
    for (int i = 0; str[i] != 0; i++) {
        hash = (hash + str[i]) & 0xf;
    }
    return hash;
}

void set_key(object* obj, char* key, void* value);

object* create_object(object* proto, int length, ...) {
    object* out;
    safe_malloc(out, sizeof(object));
    out->prototype = proto;
    for (int i = 0; i < 16; i++) {
        out->data[i] = NULL;
    }
    out->symbols = NULL;
    va_list args;
    va_start(args, length);
    for (int i = 0; i < length/2; i++) {
        set_key(out, va_arg(args, char*), va_arg(args, void*));
    }
    va_end(args);
    return out;
}

void* get_string(object* obj, char* key) {
    struct property* prop = obj->data[hash4(key)];
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            if (prop->is_accessor) {
                return (prop->funcs.get)(obj);
            } else {
                return prop->value;
            }
        }
        prop = prop->next;
    }
    if (obj->prototype != NULL) {
        return get_string(obj->prototype, key);
    }
    return NULL;
}

void* get_symbol(object* obj, symbol key) {
    struct symbol_property* prop = obj->symbols;
    while (prop != NULL) {
        if (prop->key == key) {
            if (prop->is_accessor) {
                return (prop->funcs.get)(obj);
            } else {
                return prop->value;
            }
        }
        prop = prop->next;
    }
    if (obj->prototype != NULL) {
        return get_symbol(obj->prototype, key);
    }
    return NULL;
}

#define get_obj(obj, key) _Generic(key, char*: get_string(obj, key), symbol: get_symbol(obj, key))

#define create_prop(name, key, value) \
    safe_malloc(name, sizeof(struct property) - sizeof(void*)); \
    name->next = NULL; \
    name->key = key; \
    name->is_accessor = false; \
    name->value = value;

#define create_accessor(name, key, get, set) \
    safe_malloc(name, sizeof(struct property)); \
    name->next = NULL; \
    name->key = key; \
    name->is_accessor = true; \
    name->funcs.get = get; \
    name->funcs.set = set;

void set_string(object* obj, char* key, void* value) {
    int hashed = hash4(key);
    struct property* prop = obj->data[hashed];
    if (prop == NULL) {
        create_prop(prop, key, value);
        obj->data[hashed] = prop;
        return;
    }
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            if (prop->is_accessor) {
                prop->funcs.set(obj, value);
            }
            prop->value = value;
            return;
        }
        prop = prop->next;
    }
    struct property* new_prop;
    create_prop(new_prop, key, value);
    prop->next = new_prop;
}

void set_symbol(object* obj, symbol key, void* value) {
    struct symbol_property* prop = obj->symbols;
    if (prop == NULL) {
        create_prop(prop, key, value);
        obj->symbols = prop;
        return;
    }
    while (prop != NULL) {
        if (prop->key == key) {
            if (prop->is_accessor) {
                prop->funcs.set(obj, value);
            }
            prop->value = value;
            return;
        }
        prop = prop->next;
    }
    struct symbol_property* new_prop;
    create_prop(new_prop, key, value);
    prop->next = new_prop;
}

#define set_obj(obj, key, value) _Generic(key, char*: set_string(obj, key, value), symbol: set_symbol(obj, key, value))

void set_string_accessor(object* obj, char* key, void* (*get)(struct object* this), void (*set)(struct object* this, void* value)) {
    int hashed = hash4(key);
    struct property* prop = obj->data[hashed];
    if (prop == NULL) {
        create_accessor(prop, key, get, set);
        obj->data[hashed] = prop;
        return;
    }
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            prop->funcs.get = get;
            prop->funcs.set = set;
            return;
        }
        prop = prop->next;
    }
    struct property* new_prop;
    create_accessor(new_prop, key, get, set);
    prop->next = new_prop;
}

void set_symbol_accessor(object* obj, symbol key, void* (*get)(struct object* this), void (*set)(struct object* this, void* value)) {
    struct symbol_property* prop = obj->symbols;
    if (prop == NULL) {
        struct symbol_property* new_prop;
        create_accessor(new_prop, key, get, set);
        obj->symbols = prop;
        return;
    }
    while (prop != NULL) {
        if (prop->key == key) {
            prop->funcs.get = get;
            prop->funcs.set = set;
            return;
        }
        prop = prop->next;
    }
    struct symbol_property* new_prop;
    create_accessor(new_prop, key, get, set);
    prop->next = new_prop;
}

#define set_accessor(obj, key, get, set) _Generic(key, char*: set_string_accessor(obj, key, get, set), symbol: set_symbol_accessor(obj, key, get, set))

bool delete_string(object* obj, char* key) {
    int hashed = hash4(key);
    struct property* prop = obj->data[hashed];
    if (prop == NULL) {
        return false;
    }
    if (strcmp(prop->key, key) == 0) {
        obj->data[hashed] = prop->next;
        return true;
    }
    struct property* prev = prop;
    prop = prop->next;
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            prev->next = prop->next;
            return true;
        }
        prev = prop;
        prop = prop->next;
    }
    return false;
}

bool delete_symbol(object* obj, symbol key) {
    struct symbol_property* prop = obj->symbols;
    if (prop == NULL) {
        return false;
    }
    if (prop->key == key) {
        obj->symbols = prop->next;
    }
    struct symbol_property* prev = prop;
    prop = prop->next;
    while (prop != NULL) {
        if (prop->key == key) {
            prev->next = prop->next;
            return true;
        }
        prev = prop;
        prop = prop->next;
    }
    return false;
}

#define delete(obj, key) _Generic(key, char*: delete_key(obj, key), symbol: delete_symbol(obj, key))

bool has_string(object* obj, char* key) {
    struct property* prop = obj->data[hash4(key)];
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            return true;
        }
        prop = prop->next;
    }
    return false;
}

bool has_symbol(object* obj, int key) {
    struct symbol_property* prop = obj->symbols;
    while (prop != NULL) {
        if (prop->key == key) {
            return true;
        }
        prop = prop->next;
    }
    return false;
}

#define has_obj(obj, key) _Generic(key, char*: has_string(obj, key), symbol: has_symbol(obj, key))

int num_keys(object* obj) {
    int count = 0;
    struct property* prop;
    for (int i = 0; i < 16; i++) {
        prop = obj->data[i];
        while (prop != NULL) {
            count++;
            prop = prop->next;
        }
    }
    return count;
}

array* get_keys(object* obj) {
    array* out = create_array(num_keys(obj));
    int index = 0;
    struct property* prop;
    for (int i = 0; i < 16; i++) {
        prop = obj->data[i];
        while (prop != NULL) {
            out->items[index] = prop->key;
            index++;
            prop = prop->next;
        }
    }
    return out;
}

#define call_obj(obj, method, ...) ((void*(*)())get_obj(obj, method))(obj, ## __VA_ARGS__)

void (*new_target)() = NULL;
long new_target_tag = 0;
#define new(proto, func, ...) ((new_target = func) func(create_object(proto, 0), ## __VA_ARGS__))


typedef struct array {
    int length;
    void** items;
} array;

array* create_array(int length) {
    struct array* out;
    safe_malloc(out, sizeof(array));
    out->length = length;
    safe_malloc(out->items, length * sizeof(void*));
    return out;
}

array* create_array_with_items(int length, ...) {
    va_list args;
    va_start(args, length);
    struct array* out;
    safe_malloc(out, sizeof(array));
    out->length = length;
    safe_malloc(out->items, length * sizeof(void*));
    for (int i = 0; i < length; i++) {
        out->items[i] = va_arg(args, void*);
    }
    va_end(args);
    return out;
}


array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}

#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);


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
        bool boolean;
        double number;
        char* string;
        symbol* symbol;
        object* object;
        array* array;
    };
} any;

void create_empty_any(any* out, enum Type type) {
    any* out;
    safe_malloc(out, sizeof(any));
    out->type = type;
    return out;
}

#define to_any(out, x) \
    safe_malloc(out, sizeof(any)); \
    out->type = _Generic(x, void*: UNDEFINED_TAG, void**: NULL_TAG, bool: BOOLEAN_TAG, double: NUMBER_TAG, char*: STRING_TAG, symbol: SYMBOL_TAG, object*: OBJECT_TAG, array*: OBJECT_TAG, any*: x->type); \
    _Generic(x, void*: 0, void**: 0, bool: out->boolean = x, double: out->number = x, char*: out->string = x, symbol: out->symbol = x, object*: out->object = x, array*: out->object = x, any*: x->type);

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

#define js_typeof(x) _Generic(x, void*: "undefined", void**: "null", bool: "boolean", double: "number", char*: "string", symbol: "symbol", object*: "object", array*: "object", any*: js_typeof_any(value))

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
            return parse_number(array_to_primitive(value->array));
    }
}

#define cast_to_number(x) _Generic(x, void*: NaN, void**: 0, bool: (double)(x), double: x, char*: parse_number(x), symbol: NaN, object*: cast_any_to_number(object_to_primitive(x->object)), array*: parse_number(array_to_string(x->object)))

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
    char out[30];
    int i;
    for (i = 0; i < 30 && whole > 0; i++) {
        out[i] = BASE_CHARS[whole % base];
        whole /= base;
    }
    if (frac != 0) {
        out[i++] = i;
        frac *= base;
        for (; i < 30 && frac > 0; i++) {
            out[i] = BASE_CHARS[(int)fmod(frac, 1)];
            frac *= base;
        }
    }
    out[i] = NULL;
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
            return cast_to_string(object_to_primitive(value->object));
        default:
            return array_to_string(value->array);
    }
}

#define cast_to_string(x) _Generic(x, void*: "undefined", void**: "null", bool: (x ? "true" : "false"), double: number_to_string(x), char*: x, symbol: "Symbol", object*: cast_to_string(object_to_primitive(value->object)), array*: array_to_string(value->array));

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

#define cast_to_boolean(x) _Generic(x, void*: false, void**: false, bool: x, double: (x->number != 0 && !isnan(x->number)), char*: *(x->string != '\0'), symbol: true, object*: true, array*: true, any*: cast_any_to_boolean(x))


bool eq_any_same_type(any* x, any* y) {
    switch (x->type) {
        case UNDEFINED_TAG:
        case NULL_TAG:
            return true;
        case STRING_TAG:
            return strcmp(x->string, y->string) == 0;
        default:
            return x->object == y->object;
    }
}

bool eq_any_primitive(any* x, any* y) {
    if (x->type == y->type) {
        return equal_any_same_type(x, y);
    } else if (x->type == SYMBOL_TAG || y->type == SYMBOL_TAG) {
        return false;
    } else if (x->type == BOOLEAN_TAG) {
        x->type = NUMBER_TAG;
        x->number = x->boolean;
        return eq_any_primitive(x, y);
    } else if (y->type == BOOLEAN_TAG) {
        y->type = NUMBER_TAG;
        y->number = y->boolean;
        return eq_any_primitive(x, y);
    } else if (x->type == NUMBER_TAG) {
        x->type = STRING_TAG;
        x->string = number_to_string(x->number, 10);
        return eq_any_primitive(x, y);
    } else if (y->type == NUMBER_TAG) {
        y->type = STRING_TAG;
        y->string = number_to_string(y->number, 10);
        return eq_any_primitive(x, y);
    } else {
        return false;
    }
}

bool eq_any(any* x, any* y) {
    if (x->type == y->type) {
        return equal_any_same_type(x, y);
    }
    if (x->type == UNDEFINED_TAG || x->type == NULL_TAG) {
        return y->type == UNDEFINED_TAG || y->type == NULL_TAG;
    }
    if (x->type == OBJECT_TAG) {
        x = object_to_primitive(x->object);
    }
    if (y->type == OBJECT_TAG) {
        x = object_to_primitive(x->object);
    }
    return equal_any_primitive(x, y);
}

bool seq_any(any* x, any* y) {
    return x->type == y->type && equal_any_same_type(x, y);
}

bool eq_any_bool(any* x, bool y) {
    any* anyY;
}

#define eq_any_other(x, y) _Generic(y, \
    void*: x->type == UNDEFINED_TAG || x->type == NULL_TAG, \
    void**: x->type == UNDEFINED_TAG || x->type == NULL_TAG, \
    bool: x->type == BOOLEAN_TAG ? x->boolean == y : true, \
    default: true \
)

#define eq(x, y) _Generic(y, any*: eq_any_other(y, x), default: _Generic(x, \
    void*: _Generic(y, void*: true, void**: true, default: false), \
    void**: _Generic(y, void*: true, void**: true, default: false), \
    bool: _Generic(y, void*: false, void**: false, bool: x == y, double: x == y, char*: strcmp(x ? "1" : "0", y) == 0, symbol: false, object*: eq_any_other(object_to_primitive(y), x), array*: strcmp(cast_to_string(x), array_to_string(y)) == 0), \
    double: _Generic(y, void*: false, void**: false, bool: x == y, double: x == y, char*: strcmp(number_to_string(x), y) == 0, symbol: false, default: eq_any_other(object_to_primitive(y), x)), \
    char*: strcmp(x, cast_to_string(y)) == 0, \
    symbol: _Generic(y, symbol: true, default: false), \
    object*: eq_any_other(object_to_primitive(x), y), \
    array*: eq_any_other(array_to_string(x), y), \
    any*: eq_any_other(x, y), \
))

int test() {
    eq(1.0, 1.0);
}


#endif
