
#ifndef Neutrino_ops_arithmetic
#define Neutrino_ops_arithmetic

#include <string.h>
#include "../core/types.h"


static char* stradd(char* x, char* y) {
    char* out;
    int xl = strlen(x);
    int yl = strlen(y);
    safe_malloc(out, xl + yl + 1);
    strncpy(out, x, xl);
    strncpy(out + xl, y, yl);
    out[xl + yl] = '\n';
    return out;
}

static any* add_any_any(any* x, any* y) {
    if (x->type == STRING_TAG || y->type == STRING_TAG) {
        return create_any_from_string(stradd(cast_any_to_string(x), cast_any_to_string(y)));
    } else {
        return create_any_from_number(cast_any_to_number(x) + cast_any_to_number(y));
    }
}

static inline double add_undefined_undefined(void* x, void* y) {return NaN;}
static inline double add_undefined_null(void* x, void** y) {return NaN;}
static inline double add_undefined_boolean(void* x, bool y) {return NaN;}
static inline double add_undefined_number(void* x, double y) {return NaN;}
static inline char* add_undefined_string(void* x, char* y) {return stradd("undefined", y);}
static inline double add_undefined_symbol(void* x, symbol y) {return NaN;}
static inline any* add_undefined_object(void* x, object* y) {return add_any_any(create_any_from_undefined(x), object_to_primitive(y));}
static inline char* add_undefined_array(void* x, array* y) {return stradd("undefined", array_to_string(y));}
static inline double add_undefined_any(void* x, any* y) {return NaN;}

static inline double add_null_undefined(void** x, void* y) {return NaN;}
static inline double add_null_null(void** x, void** y) {return 0;}
static inline double add_null_boolean(void** x, bool y) {return y;}
static inline double add_null_number(void** x, double y) {return y;}
static inline char* add_null_string(void** x, char* y) {return stradd("null", y);}
static inline double add_null_symbol(void** x, symbol y) {return NaN;}
static inline any* add_null_object(void** x, object* y) {return add_any_any(create_any_from_null(x), object_to_primitive(y));}
static inline char* add_null_array(void** x, array* y) {return stradd("null", array_to_string(y));}
static inline any* add_null_any(void** x, any* y) {return y->type == STRING_TAG ? create_any_from_string(stradd("null", y->string)) : create_any_from_number(cast_to_number(y));}

static inline double add_boolean_undefined(bool x, void* y) {return NaN;}
static inline double add_boolean_null(bool x, void** y) {return x;}
static inline double add_boolean_boolean(bool x, bool y) {return x + y;}
static inline double add_boolean_number(bool x, double y) {return x + y;}
static inline char* add_boolean_string(bool x, char* y) {return stradd(cast_to_string(x), y);}
static inline double add_boolean_symbol(bool x, symbol y) {return NaN;}
static inline any* add_boolean_object(bool x, object* y) {return add_any_any(create_any_from_boolean(x), object_to_primitive(y));}
static inline char* add_boolean_array(bool x, array* y) {return stradd(x ? "true" : "false", array_to_string(y));}
static inline any* add_boolean_any(bool x, any* y) {return y->type == STRING_TAG ? create_any_from_string(stradd(x ? "true" : "false", y->string)) : create_any_from_number(cast_to_number(y));}

static inline double add_number_undefined(double x, void* y) {return NaN;}
static inline double add_number_null(double x, void** y) {return x;}
static inline double add_number_boolean(double x, bool y) {return x + y;}
static inline double add_number_number(double x, double y) {return x + y;}
static inline char* add_number_string(double x, char* y) {return stradd(number_to_string(x, 10), y);}
static inline double add_number_symbol(double x, symbol y) {return NaN;}
static inline any* add_number_object(double x, object* y) {return add_any_any(create_any_from_number(x), object_to_primitive(y));}
static inline char* add_number_array(double x, array* y) {return stradd(number_to_string(x, 10), array_to_string(y));}
static inline any* add_number_any(double x, any* y) {return y->type == STRING_TAG ? create_any_from_string(stradd(number_to_string(x, 10), y->string)) : create_any_from_number(x + cast_to_number(y));}

static inline char* add_string_undefined(char* x, void* y) {return stradd(x, "undefined");}
static inline char* add_string_null(char* x, void** y) {return stradd(x, "null");}
static inline char* add_string_boolean(char* x, bool y) {return stradd(x, y ? "true" : "false");}
static inline char* add_string_number(char* x, double y) {return stradd(x, number_to_string(y, 10));}
static inline char* add_string_string(char* x, char* y) {return stradd(x, y);}
static inline char* add_string_symbol(char* x, symbol y) {return stradd(x, "Symbol");}
static inline char* add_string_object(char* x, object* y) {return stradd(x, cast_any_to_string(object_to_primitive(y)));}
static inline char* add_string_array(char* x, array* y) {return stradd(x, array_to_string(y));}
static inline char* add_string_any(char* x, any* y) {return stradd(x, cast_any_to_string(y));}

static inline double add_symbol_undefined(symbol x, void* y) {return NaN;}
static inline double add_symbol_null(symbol x, void** y) {return NaN;}
static inline double add_symbol_boolean(symbol x, bool y) {return NaN;}
static inline double add_symbol_number(symbol x, double y) {return NaN;}
static inline char* add_symbol_string(symbol x, char* y) {return stradd("Symbol", y);}
static inline double add_symbol_symbol(symbol x, symbol y) {return NaN;}
static inline any* add_symbol_object(symbol x, object* y) {return add_any_any(create_any_from_symbol(x), object_to_primitive(y));}
static inline char* add_symbol_array(symbol x, array* y) {return stradd("Symbol", array_to_string(y));}
static inline any* add_symbol_any(symbol x, any* y) {return add_any_any(create_any_from_symbol(x), y);}

static inline any* add_object_undefined(object* x, void* y) {return add_any_any(object_to_primitive(x), create_any_from_undefined(y));}
static inline any* add_object_null(object* x, void** y) {return object_to_primitive(x);}
static inline any* add_object_boolean(object* x, bool y) {return add_any_any(object_to_primitive(x), create_any_from_boolean(y));}
static inline any* add_object_number(object* x, double y) {return add_any_any(object_to_primitive(x), create_any_from_number(y));}
static inline any* add_object_string(object* x, char* y) {return add_any_any(object_to_primitive(x), create_any_from_string(y));}
static inline any* add_object_symbol(object* x, symbol y) {return add_any_any(object_to_primitive(x), create_any_from_symbol(y));}
static inline any* add_object_object(object* x, object* y) {return add_any_any(object_to_primitive(x), object_to_primitive(y));}
static inline any* add_object_array(object* x, array* y) {return add_any_any(object_to_primitive(x), create_any_from_string(array_to_string(y)));}
static inline any* add_object_any(object* x, any* y) {return add_any_any(object_to_primitive(x), y);}

static inline char* add_array_undefined(array* x, void* y) {return stradd(array_to_string(x), "undefined");}
static inline char* add_array_null(array* x, void** y) {return stradd(array_to_string(x), "null");}
static inline char* add_array_boolean(array* x, bool y) {return stradd(array_to_string(x), y ? "true" : "false");}
static inline char* add_array_number(array* x, double y) {return stradd(array_to_string(x), number_to_string(y, 10));}
static inline char* add_array_string(array* x, char* y) {return stradd(array_to_string(x), y);}
static inline char* add_array_symbol(array* x, symbol y) {return stradd(array_to_string(x), "Symbol");}
static inline any* add_array_object(array* x, object* y) {return add_any_any(create_any_from_string(array_to_string(x)), object_to_primitive(y));}
static inline char* add_array_array(array* x, array* y) {return stradd(array_to_string(x), array_to_string(y));}
static inline char* add_array_any(array* x, any* y) {return stradd(array_to_string(x), cast_any_to_string(y));}

static inline any* add_any_undefined(any* x, void* y) {return x->type == STRING_TAG ? create_any_from_string(stradd(x->string, "undefined")) : create_any_from_number(NaN);}
static inline any* add_any_null(any* x, void** y) {return add_any_any(x, create_any_from_null(y));}
static inline any* add_any_boolean(any* x, bool y) {return add_any_any(x, create_any_from_boolean(y));}
static inline any* add_any_number(any* x, double y) {return add_any_any(x, create_any_from_number(y));}
static inline any* add_any_string(any* x, char* y) {return add_any_any(x, create_any_from_string(y));}
static inline any* add_any_symbol(any* x, symbol y) {return add_any_any(x, create_any_from_symbol(y));}
static inline any* add_any_object(any* x, object* y) {return add_any_any(x, create_any_from_object(y));}
static inline any* add_any_array(any* x, array* y) {return add_any_any(x, create_any_from_string(array_to_string(y)));}


#define add(x, y) (_Generic((x), \
    void*: _Generic((y), \
        void*: add_undefined_undefined, \
        void**: add_undefined_null, \
        bool: add_undefined_boolean, \
        double: add_undefined_number, \
        char*: add_undefined_string, \
        symbol: add_undefined_symbol, \
        object*: add_undefined_object, \
        array*: add_undefined_array, \
        any*: add_undefined_any \
    ), \
    void**: _Generic((y), \
        void*: add_null_undefined, \
        void**: add_null_null, \
        bool: add_null_boolean, \
        double: add_null_number, \
        char*: add_null_string, \
        symbol: add_null_symbol, \
        object*: add_null_object, \
        array*: add_null_array, \
        any*: add_null_any \
    ), \
    bool: _Generic((y), \
        void*: add_boolean_undefined, \
        void**: add_boolean_null, \
        bool: add_boolean_boolean, \
        double: add_boolean_number, \
        char*: add_boolean_string, \
        symbol: add_boolean_symbol, \
        object*: add_boolean_object, \
        array*: add_boolean_array, \
        any*: add_boolean_any \
    ), \
    double: _Generic((y), \
        void*: add_number_undefined, \
        void**: add_number_null, \
        bool: add_number_boolean, \
        double: add_number_number, \
        char*: add_number_string, \
        symbol: add_number_symbol, \
        object*: add_number_object, \
        array*: add_number_array, \
        any*: add_number_any \
    ), \
    char*: _Generic((y), \
        void*: add_string_undefined, \
        void**: add_string_null, \
        bool: add_string_boolean, \
        double: add_string_number, \
        char*: add_string_string, \
        symbol: add_string_symbol, \
        object*: add_string_object, \
        array*: add_string_array, \
        any*: add_string_any \
    ), \
    symbol: _Generic((y), \
        void*: add_symbol_undefined, \
        void**: add_symbol_null, \
        bool: add_symbol_boolean, \
        double: add_symbol_number, \
        char*: add_symbol_string, \
        symbol: add_symbol_symbol, \
        object*: add_symbol_object, \
        array*: add_symbol_array, \
        any*: add_symbol_any \
    ), \
    object*: _Generic((y), \
        void*: add_object_undefined, \
        void**: add_object_null, \
        bool: add_object_boolean, \
        double: add_object_number, \
        char*: add_object_string, \
        symbol: add_object_symbol, \
        object*: add_object_object, \
        array*: add_object_array, \
        any*: add_object_any \
    ), \
    array*: _Generic((y), \
        void*: add_array_undefined, \
        void**: add_array_null, \
        bool: add_array_boolean, \
        double: add_array_number, \
        char*: add_array_string, \
        symbol: add_array_symbol, \
        object*: add_array_object, \
        array*: add_array_array, \
        any*: add_array_any \
    ), \
    any*: _Generic((y), \
        void*: add_any_undefined, \
        void**: add_any_null, \
        bool: add_any_boolean, \
        double: add_any_number, \
        char*: add_any_string, \
        symbol: add_any_symbol, \
        object*: add_any_object, \
        array*: add_any_array, \
        any*: add_any_any \
    ) \
)(x, y))


#endif
