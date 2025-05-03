
#ifndef Neutrino_op_seq
#define Neutrino_op_seq

#include <stdbool.h>
#include <string.h>
#include "../core/types.h"


static bool seq_any_any(any* x, any* y) {
    if (x->type != y->type) {
        return false;
    }
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

static inline bool seq_undefined_undefined(void* x, void* y) {return true;}
static inline bool seq_undefined_null(void* x, void** y) {return false;}
static inline bool seq_undefined_boolean(void* x, bool y) {return false;}
static inline bool seq_undefined_number(void* x, double y) {return false;}
static inline bool seq_undefined_string(void* x, char* y) {return false;}
static inline bool seq_undefined_symbol(void* x, symbol y) {return false;}
static inline bool seq_undefined_object(void* x, object* y) {return false;}
static inline bool seq_undefined_array(void* x, array* y) {return false;}
static inline bool seq_undefined_any(void* x, any* y) {return seq_any_any(create_any_from_undefined(x), y);}

static inline bool seq_null_undefined(void** x, void* y) {return false;}
static inline bool seq_null_null(void** x, void** y) {return true;}
static inline bool seq_null_boolean(void** x, bool y) {return false;}
static inline bool seq_null_number(void** x, double y) {return false;}
static inline bool seq_null_string(void** x, char* y) {return false;}
static inline bool seq_null_symbol(void** x, symbol y) {return false;}
static inline bool seq_null_object(void** x, object* y) {return false;}
static inline bool seq_null_array(void** x, array* y) {return false;}
static inline bool seq_null_any(void** x, any* y) {return seq_any_any(create_any_from_null(x), y);}

static inline bool seq_boolean_undefined(bool x, void* y) {return false;}
static inline bool seq_boolean_null(bool x, void** y) {return false;}
static inline bool seq_boolean_boolean(bool x, bool y) {return x == y;}
static inline bool seq_boolean_number(bool x, double y) {return false;}
static inline bool seq_boolean_string(bool x, char* y) {return false;}
static inline bool seq_boolean_symbol(bool x, symbol y) {return false;}
static inline bool seq_boolean_object(bool x, object* y) {return false;}
static inline bool seq_boolean_array(bool x, array* y) {return false;}
static inline bool seq_boolean_any(bool x, any* y) {return seq_any_any(create_any_from_boolean(x), y);}

static inline bool seq_number_undefined(double x, void* y) {return false;}
static inline bool seq_number_null(double x, void** y) {return false;}
static inline bool seq_number_boolean(double x, bool y) {return false;}
static inline bool seq_number_number(double x, double y) {return x == y;}
static inline bool seq_number_string(double x, char* y) {return false;}
static inline bool seq_number_symbol(double x, symbol y) {return false;}
static inline bool seq_number_object(double x, object* y) {return false;}
static inline bool seq_number_array(double x, array* y) {return false;}
static inline bool seq_number_any(double x, any* y) {return seq_any_any(create_any_from_number(x), y);}

static inline bool seq_string_undefined(char* x, void* y) {return false;}
static inline bool seq_string_null(char* x, void** y) {return false;}
static inline bool seq_string_boolean(char* x, bool y) {return false;}
static inline bool seq_string_number(char* x, double y) {return false;}
static inline bool seq_string_string(char* x, char* y) {return strcmp(x, y) == 0;}
static inline bool seq_string_symbol(char* x, symbol y) {return false;}
static inline bool seq_string_object(char* x, object* y) {return false;}
static inline bool seq_string_array(char* x, array* y) {return false;}
static inline bool seq_string_any(char* x, any* y) {return seq_any_any(create_any_from_string(x), y);}

static inline bool seq_symbol_undefined(symbol x, void* y) {return false;}
static inline bool seq_symbol_null(symbol x, void** y) {return false;}
static inline bool seq_symbol_boolean(symbol x, bool y) {return false;}
static inline bool seq_symbol_number(symbol x, double y) {return false;}
static inline bool seq_symbol_string(symbol x, char* y) {return false;}
static inline bool seq_symbol_symbol(symbol x, symbol y) {return x == y;}
static inline bool seq_symbol_object(symbol x, object* y) {return false;}
static inline bool seq_symbol_array(symbol x, array* y) {return false;}
static inline bool seq_symbol_any(symbol x, any* y) {return seq_any_any(create_any_from_symbol(x), y);}

static inline bool seq_object_undefined(object* x, void* y) {return false;}
static inline bool seq_object_null(object* x, void** y) {return false;}
static inline bool seq_object_boolean(object* x, bool y) {return false;}
static inline bool seq_object_number(object* x, double y) {return false;}
static inline bool seq_object_string(object* x, char* y) {return false;}
static inline bool seq_object_symbol(object* x, symbol y) {return false;}
static inline bool seq_object_object(object* x, object* y) {return x == y;}
static inline bool seq_object_array(object* x, array* y) {return false;}
static inline bool seq_object_any(object* x, any* y) {return seq_any_any(create_any_from_object(x), y);}

static inline bool seq_array_undefined(array* x, void* y) {return false;}
static inline bool seq_array_null(array* x, void** y) {return false;}
static inline bool seq_array_boolean(array* x, bool y) {return false;}
static inline bool seq_array_number(array* x, double y) {return false;}
static inline bool seq_array_string(array* x, char* y) {return false;}
static inline bool seq_array_symbol(array* x, symbol y) {return false;}
static inline bool seq_array_object(array* x, object* y) {return false;}
static inline bool seq_array_array(array* x, array* y) {return x == y;}
static inline bool seq_array_any(array* x, any* y) {return seq_any_any(create_any_from_array(x), y);}

static inline bool seq_any_undefined(any* x, void* y) {return seq_any_any(x, create_any_from_undefined(y));}
static inline bool seq_any_null(any* x, void** y) {return seq_any_any(x, create_any_from_null(y));}
static inline bool seq_any_boolean(any* x, bool y) {return seq_any_any(x, create_any_from_boolean(y));}
static inline bool seq_any_number(any* x, double y) {return seq_any_any(x, create_any_from_number(y));}
static inline bool seq_any_string(any* x, char* y) {return seq_any_any(x, create_any_from_string(y));}
static inline bool seq_any_symbol(any* x, symbol y) {return seq_any_any(x, create_any_from_symbol(y));}
static inline bool seq_any_object(any* x, object* y) {return seq_any_any(x, create_any_from_object(y));}
static inline bool seq_any_array(any* x, array* y) {return seq_any_any(x, create_any_from_array(y));}

#define seq(x, y) (_Generic((x), \
    void*: _Generic((y), \
        void*: seq_undefined_undefined, \
        void**: seq_undefined_null, \
        bool: seq_undefined_boolean, \
        double: seq_undefined_number, \
        char*: seq_undefined_string, \
        symbol: seq_undefined_symbol, \
        object*: seq_undefined_object, \
        array*: seq_undefined_array, \
        any*: seq_undefined_any), \
    void**: _Generic((y), \
        void*: seq_null_undefined, \
        void**: seq_null_null, \
        bool: seq_null_boolean, \
        double: seq_null_number, \
        char*: seq_null_string, \
        symbol: seq_null_symbol, \
        object*: seq_null_object, \
        array*: seq_null_array, \
        any*: seq_null_any), \
    bool: _Generic((y), \
        void*: seq_boolean_undefined, \
        void**: seq_boolean_null, \
        bool: seq_boolean_boolean, \
        double: seq_boolean_number, \
        char*: seq_boolean_string, \
        symbol: seq_boolean_symbol, \
        object*: seq_boolean_object, \
        array*: seq_boolean_array, \
        any*: seq_boolean_any), \
    double: _Generic((y), \
        void*: seq_number_undefined, \
        void**: seq_number_null, \
        bool: seq_number_boolean, \
        double: seq_number_number, \
        char*: seq_number_string, \
        symbol: seq_number_symbol, \
        object*: seq_number_object, \
        array*: seq_number_array, \
        any*: seq_number_any), \
    char*: _Generic((y), \
        void*: seq_string_undefined, \
        void**: seq_string_null, \
        bool: seq_string_boolean, \
        double: seq_string_number, \
        char*: seq_string_string, \
        symbol: seq_string_symbol, \
        object*: seq_string_object, \
        array*: seq_string_array, \
        any*: seq_string_any), \
    symbol: _Generic((y), \
        void*: seq_symbol_undefined, \
        void**: seq_symbol_null, \
        bool: seq_symbol_boolean, \
        double: seq_symbol_number, \
        char*: seq_symbol_string, \
        symbol: seq_symbol_symbol, \
        object*: seq_symbol_object, \
        array*: seq_symbol_array, \
        any*: seq_symbol_any), \
    object*: _Generic((y), \
        void*: seq_object_undefined, \
        void**: seq_object_null, \
        bool: seq_object_boolean, \
        double: seq_object_number, \
        char*: seq_object_string, \
        symbol: seq_object_symbol, \
        object*: seq_object_object, \
        array*: seq_object_array, \
        any*: seq_object_any), \
    array*: _Generic((y), \
        void*: seq_array_undefined, \
        void**: seq_array_null, \
        bool: seq_array_boolean, \
        double: seq_array_number, \
        char*: seq_array_string, \
        symbol: seq_array_symbol, \
        object*: seq_array_object, \
        array*: seq_array_array, \
        any*: seq_array_any), \
    any*: _Generic((y), \
        void*: seq_any_undefined, \
        void**: seq_any_null, \
        bool: seq_any_boolean, \
        double: seq_any_number, \
        char*: seq_any_string, \
        symbol: seq_any_symbol, \
        object*: seq_any_object, \
        array*: seq_any_array, \
        any*: seq_any_any) \
)(x, y))

#define nseq(x, y) !seq(x, y)


#endif
