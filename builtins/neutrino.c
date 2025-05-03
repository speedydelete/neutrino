
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

#define JS_NULL (void**)0

#define NaN (double)NAN


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

void set_string(object* obj, char* key, void* value);

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
        set_string(out, va_arg(args, char*), va_arg(args, void*));
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

#define get_obj(obj, key) _Generic((key), char*: get_string, symbol: get_symbol)(obj, key)

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

#define set_obj(obj, key, value) _Generic((key), char*: set_string, symbol: set_symbol)(obj, key, value)

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

#define set_accessor(obj, key, get, set) _Generic((key), char*: set_string_accessor, symbol: set_symbol_accessor)(obj, key, get, set)

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

#define delete(obj, key) _Generic((key), char*: delete_key, symbol: delete_symbol)(obj, key)

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

#define has_obj(obj, key) _Generic((key), char*: has_string, symbol: has_symbol)(obj, key)

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


array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}

#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);


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
static inline char* cast_to_string_object(object* x) {return cast_to_string(object_to_primitive(x));}

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


static inline bool eq_any_any_same_type(any* x, any* y) {
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

bool eq_any_any_primitive(any* x, any* y) {
    if (x->type == y->type) {
        return eq_any_any_same_type(x, y);
    } else if (x->type == SYMBOL_TAG || y->type == SYMBOL_TAG) {
        return false;
    } else if (x->type == BOOLEAN_TAG) {
        x->type = NUMBER_TAG;
        x->number = x->boolean;
        return eq_any_any_primitive(x, y);
    } else if (y->type == BOOLEAN_TAG) {
        y->type = NUMBER_TAG;
        y->number = y->boolean;
        return eq_any_any_primitive(x, y);
    } else if (x->type == NUMBER_TAG) {
        x->type = STRING_TAG;
        x->string = number_to_string(x->number, 10);
        return eq_any_any_primitive(x, y);
    } else if (y->type == NUMBER_TAG) {
        y->type = STRING_TAG;
        y->string = number_to_string(y->number, 10);
        return eq_any_any_primitive(x, y);
    } else {
        return false;
    }
}

bool eq_any_any(any* x, any* y) {
    if (x->type == y->type) {
        return eq_any_any_same_type(x, y);
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
    return eq_any_any_primitive(x, y);
}

static inline bool eq_undefined_undefined(void* x, void* y) {return true;}
static inline bool eq_undefined_null(void* x, void** y) {return true;}
static inline bool eq_undefined_boolean(void* x, bool y) {return false;}
static inline bool eq_undefined_number(void* x, double y) {return false;}
static inline bool eq_undefined_string(void* x, char* y) {return false;}
static inline bool eq_undefined_symbol(void* x, symbol y) {return false;}
static inline bool eq_undefined_object(void* x, object* y) {return false;}
static inline bool eq_undefined_array(void* x, array* y) {return false;}
static inline bool eq_undefined_any(void* x, any* y) {return eq_any_any(create_any_from_undefined(x), y);}

static inline bool eq_null_undefined(void** x, void* y) {return true;}
static inline bool eq_null_null(void** x, void** y) {return true;}
static inline bool eq_null_boolean(void** x, bool y) {return false;}
static inline bool eq_null_number(void** x, double y) {return false;}
static inline bool eq_null_string(void** x, char* y) {return false;}
static inline bool eq_null_symbol(void** x, symbol y) {return false;}
static inline bool eq_null_object(void** x, object* y) {return false;}
static inline bool eq_null_array(void** x, array* y) {return false;}
static inline bool eq_null_any(void** x, any* y) {return eq_any_any(create_any_from_null(x), y);}

static inline bool eq_boolean_undefined(bool x, void* y) {return false;}
static inline bool eq_boolean_null(bool x, void** y) {return false;}
static inline bool eq_boolean_boolean(bool x, bool y) {return x == y;}
static inline bool eq_boolean_number(bool x, double y) {return x == y;}
static inline bool eq_boolean_string(bool x, char* y) {return strcmp(x ? "true" : "false", y) == 0;}
static inline bool eq_boolean_symbol(bool x, symbol y) {return false;}
static inline bool eq_boolean_object(bool x, object* y) {return false;}
static inline bool eq_boolean_array(bool x, array* y) {return false;}
static inline bool eq_boolean_any(bool x, any* y) {return eq_any_any(create_any_from_boolean(x), y);}

static inline bool eq_number_undefined(double x, void* y) {return false;}
static inline bool eq_number_null(double x, void** y) {return false;}
static inline bool eq_number_boolean(double x, bool y) {return x == y;}
static inline bool eq_number_number(double x, double y) {return x == y;}
static inline bool eq_number_string(double x, char* y) {return strcmp(number_to_string(x, 10), y) == 0;}
static inline bool eq_number_symbol(double x, symbol y) {return false;}
static inline bool eq_number_object(double x, object* y) {return eq_any_any(create_any_from_number(x), object_to_primitive(y));}
static inline bool eq_number_array(double x, array* y) {return number_to_string(x, 10) == array_to_string(y);}
static inline bool eq_number_any(double x, any* y) {return eq_any_any(create_any_from_number(x), y);}

static inline bool eq_string_undefined(char* x, void* y) {return false;}
static inline bool eq_string_null(char* x, void** y) {return false;}
static inline bool eq_string_boolean(char* x, bool y) {return strcmp(x, y ? "true" : "false") == 0;}
static inline bool eq_string_number(char* x, double y) {return strcmp(x, number_to_string(y, 10)) == 0;}
static inline bool eq_string_string(char* x, char* y) {return strcmp(x, y) == 0;}
static inline bool eq_string_symbol(char* x, symbol y) {return false;}
static inline bool eq_string_object(char* x, object* y) {return eq_any_any(create_any_from_string(x), object_to_primitive(y));}
static inline bool eq_string_array(char* x, array* y) {return strcmp(x, array_to_string(y)) == 0;}
static inline bool eq_string_any(char* x, any* y) {return eq_any_any(create_any_from_string(x), y);}

static inline bool eq_symbol_undefined(symbol x, void* y) {return false;}
static inline bool eq_symbol_null(symbol x, void** y) {return false;}
static inline bool eq_symbol_boolean(symbol x, bool y) {return false;}
static inline bool eq_symbol_number(symbol x, double y) {return false;}
static inline bool eq_symbol_string(symbol x, char* y) {return false;}
static inline bool eq_symbol_symbol(symbol x, symbol y) {return x == y;}
static inline bool eq_symbol_object(symbol x, object* y) {return false;}
static inline bool eq_symbol_array(symbol x, array* y) {return false;}
static inline bool eq_symbol_any(symbol x, any* y) {return eq_any_any(create_any_from_symbol(x), y);}

static inline bool eq_object_undefined(object* x, void* y) {return false;}
static inline bool eq_object_null(object* x, void** y) {return false;}
static inline bool eq_object_boolean(object* x, bool y) {return eq_any_any(object_to_primitive(x), create_any_from_boolean(y));}
static inline bool eq_object_number(object* x, double y) {return eq_any_any(object_to_primitive(x), create_any_from_number(y));}
static inline bool eq_object_string(object* x, char* y) {return eq_any_any(object_to_primitive(x), create_any_from_string(y));}
static inline bool eq_object_symbol(object* x, symbol y) {return false;}
static inline bool eq_object_object(object* x, object* y) {return x == y;}
static inline bool eq_object_array(object* x, array* y) {return x == (object*)y;}
static inline bool eq_object_any(object* x, any* y) {return eq_any_any(create_any_from_object(x), y);}

static inline bool eq_array_undefined(array* x, void* y) {return false;}
static inline bool eq_array_null(array* x, void** y) {return false;}
static inline bool eq_array_boolean(array* x, bool y) {return strcmp(array_to_string(x), y ? "true" : "false") == 0;}
static inline bool eq_array_number(array* x, double y) {return array_to_string(x) == number_to_string(y, 10);}
static inline bool eq_array_string(array* x, char* y) {return strcmp(array_to_string(x), y) == 0;}
static inline bool eq_array_symbol(array* x, symbol y) {return false;}
static inline bool eq_array_object(array* x, object* y) {return (object*)x == y;}
static inline bool eq_array_array(array* x, array* y) {return x == y;}
static inline bool eq_array_any(array* x, any* y) {return eq_any_any(create_any_from_array(x), y);}

static inline bool eq_any_undefined(any* x, void* y) {return eq_any_any(x, create_any_from_undefined(y));}
static inline bool eq_any_null(any* x, void** y) {return eq_any_any(x, create_any_from_null(y));}
static inline bool eq_any_boolean(any* x, bool y) {return eq_any_any(x, create_any_from_boolean(y));}
static inline bool eq_any_number(any* x, double y) {return eq_any_any(x, create_any_from_number(y));}
static inline bool eq_any_string(any* x, char* y) {return eq_any_any(x, create_any_from_string(y));}
static inline bool eq_any_symbol(any* x, symbol y) {return eq_any_any(x, create_any_from_symbol(y));}
static inline bool eq_any_object(any* x, object* y) {return eq_any_any(x, create_any_from_object(y));}
static inline bool eq_any_array(any* x, array* y) {return eq_any_any(x, create_any_from_array(y));}

#define eq(x, y) _Generic((x), \
    void*: _Generic((y), \
        void*: eq_undefined_undefined, \
        void**: eq_undefined_null, \
        bool: eq_undefined_boolean, \
        double: eq_undefined_number, \
        char*: eq_undefined_string, \
        symbol: eq_undefined_symbol, \
        object*: eq_undefined_object, \
        array*: eq_undefined_array, \
        any*: eq_undefined_any \
    ), \
    void**: _Generic((y), \
        void*: eq_null_undefined, \
        void**: eq_null_null, \
        bool: eq_null_boolean, \
        double: eq_null_number, \
        char*: eq_null_string, \
        symbol: eq_null_symbol, \
        object*: eq_null_object, \
        array*: eq_null_array, \
        any*: eq_null_any \
    ), \
    bool: _Generic((y), \
        void*: eq_boolean_undefined, \
        void**: eq_boolean_null, \
        bool: eq_boolean_boolean, \
        double: eq_boolean_number, \
        char*: eq_boolean_string, \
        symbol: eq_boolean_symbol, \
        object*: eq_boolean_object, \
        array*: eq_boolean_array, \
        any*: eq_boolean_any \
    ), \
    double: _Generic((y), \
        void*: eq_number_undefined, \
        void**: eq_number_null, \
        bool: eq_number_boolean, \
        double: eq_number_number, \
        char*: eq_number_string, \
        symbol: eq_number_symbol, \
        object*: eq_number_object, \
        array*: eq_number_array, \
        any*: eq_number_any \
    ), \
    char*: _Generic((y), \
        void*: eq_string_undefined, \
        void**: eq_string_null, \
        bool: eq_string_boolean, \
        double: eq_string_number, \
        char*: eq_string_string, \
        symbol: eq_string_symbol, \
        object*: eq_string_object, \
        array*: eq_string_array, \
        any*: eq_string_any \
    ), \
    symbol: _Generic((y), \
        void*: eq_symbol_undefined, \
        void**: eq_symbol_null, \
        bool: eq_symbol_boolean, \
        double: eq_symbol_number, \
        char*: eq_symbol_string, \
        symbol: eq_symbol_symbol, \
        object*: eq_symbol_object, \
        array*: eq_symbol_array, \
        any*: eq_symbol_any \
    ), \
    object*: _Generic((y), \
        void*: eq_object_undefined, \
        void**: eq_object_null, \
        bool: eq_object_boolean, \
        double: eq_object_number, \
        char*: eq_object_string, \
        symbol: eq_object_symbol, \
        object*: eq_object_object, \
        array*: eq_object_array, \
        any*: eq_object_any \
    ), \
    array*: _Generic((y), \
        void*: eq_array_undefined, \
        void**: eq_array_null, \
        bool: eq_array_boolean, \
        double: eq_array_number, \
        char*: eq_array_string, \
        symbol: eq_array_symbol, \
        object*: eq_array_object, \
        array*: eq_array_array, \
        any*: eq_array_any \
    ), \
    any*: _Generic((y), \
        void*: eq_any_undefined, \
        void**: eq_any_null, \
        bool: eq_any_boolean, \
        double: eq_any_number, \
        char*: eq_any_string, \
        symbol: eq_any_symbol, \
        object*: eq_any_object, \
        array*: eq_any_array, \
        any*: eq_any_any \
    ) \
)(x, y)


int main() {
    printf("%d", eq(1.0, 1.0));
}

bool seq_any_any(any* x, any* y) {
    return x->type == y->type && eq_any_any_same_type(x, y);
}


#endif
