
#ifndef Neutrino_ops_arithmetic
#define Neutrino_ops_arithmetic

#include "../core/types.h"


static inline void* nc_undefined_undefined(void* x, void* y) {return NULL;}
static inline void** nc_undefined_null(void* x, void** y) {return JS_NULL;}
static inline bool nc_undefined_boolean(void* x, bool y) {return y;}
static inline double nc_undefined_number(void* x, double y) {return y;}
static inline char* nc_undefined_string(void* x, char* y) {return y;}
static inline symbol nc_undefined_symbol(void* x, symbol y) {return y;}
static inline object* nc_undefined_object(void* x, object* y) {return y;}
static inline array* nc_undefined_array(void* x, array* y) {return y;}
static inline any* nc_undefined_any(void* x, any* y) {return y;}

static inline void* nc_null_undefined(void** x, void* y) {return NULL;}
static inline void** nc_null_null(void** x, void** y) {return JS_NULL;}
static inline bool nc_null_boolean(void** x, bool y) {return y;}
static inline double nc_null_number(void** x, double y) {return y;}
static inline char* nc_null_string(void** x, char* y) {return y;}
static inline symbol nc_null_symbol(void** x, symbol y) {return y;}
static inline object* nc_null_object(void** x, object* y) {return y;}
static inline array* nc_null_array(void** x, array* y) {return y;}
static inline any* nc_null_any(void** x, any* y) {return y;}

static inline bool nc_boolean_undefined(bool x, void* y) {return x;}
static inline bool nc_boolean_null(bool x, void** y) {return x;}
static inline bool nc_boolean_boolean(bool x, bool y) {return x;}
static inline bool nc_boolean_number(bool x, double y) {return x;}
static inline bool nc_boolean_string(bool x, char* y) {return x;}
static inline bool nc_boolean_symbol(bool x, symbol y) {return x;}
static inline bool nc_boolean_object(bool x, object* y) {return x;}
static inline bool nc_boolean_array(bool x, array* y) {return x;}
static inline bool nc_boolean_any(bool x, any* y) {return x;}

static inline double nc_number_undefined(double x, void* y) {return x;}
static inline double nc_number_null(double x, void** y) {return x;}
static inline double nc_number_boolean(double x, bool y) {return x;}
static inline double nc_number_number(double x, double y) {return x;}
static inline double nc_number_string(double x, char* y) {return x;}
static inline double nc_number_symbol(double x, symbol y) {return x;}
static inline double nc_number_object(double x, object* y) {return x;}
static inline double nc_number_array(double x, array* y) {return x;}
static inline double nc_number_any(double x, any* y) {return x;}

static inline char* nc_string_undefined(char* x, void* y) {return x;}
static inline char* nc_string_null(char* x, void** y) {return x;}
static inline char* nc_string_boolean(char* x, bool y) {return x;}
static inline char* nc_string_number(char* x, double y) {return x;}
static inline char* nc_string_string(char* x, char* y) {return x;}
static inline char* nc_string_symbol(char* x, symbol y) {return x;}
static inline char* nc_string_object(char* x, object* y) {return x;}
static inline char* nc_string_array(char* x, array* y) {return x;}
static inline char* nc_string_any(char* x, any* y) {return x;}

static inline symbol nc_symbol_undefined(symbol x, void* y) {return x;}
static inline symbol nc_symbol_null(symbol x, void** y) {return x;}
static inline symbol nc_symbol_boolean(symbol x, bool y) {return x;}
static inline symbol nc_symbol_number(symbol x, double y) {return x;}
static inline symbol nc_symbol_string(symbol x, char* y) {return x;}
static inline symbol nc_symbol_symbol(symbol x, symbol y) {return x;}
static inline symbol nc_symbol_object(symbol x, object* y) {return x;}
static inline symbol nc_symbol_array(symbol x, array* y) {return x;}
static inline symbol nc_symbol_any(symbol x, any* y) {return x;}

static inline object* nc_object_undefined(object* x, void* y) {return x;}
static inline object* nc_object_null(object* x, void** y) {return x;}
static inline object* nc_object_boolean(object* x, bool y) {return x;}
static inline object* nc_object_number(object* x, double y) {return x;}
static inline object* nc_object_string(object* x, char* y) {return x;}
static inline object* nc_object_symbol(object* x, symbol y) {return x;}
static inline object* nc_object_object(object* x, object* y) {return x;}
static inline object* nc_object_array(object* x, array* y) {return x;}
static inline object* nc_object_any(object* x, any* y) {return x;}

static inline array* nc_array_undefined(array* x, void* y) {return x;}
static inline array* nc_array_null(array* x, void** y) {return x;}
static inline array* nc_array_boolean(array* x, bool y) {return x;}
static inline array* nc_array_number(array* x, double y) {return x;}
static inline array* nc_array_string(array* x, char* y) {return x;}
static inline array* nc_array_symbol(array* x, symbol y) {return x;}
static inline array* nc_array_object(array* x, object* y) {return x;}
static inline array* nc_array_array(array* x, array* y) {return x;}
static inline array* nc_array_any(array* x, any* y) {return x;}

#define is_nullish(x) (x->type == UNDEFINED_TAG || x->type == NULL_TAG)

static inline any* nc_any_undefined(any* x, void* y) {return is_nullish(x) ? create_any_from_undefined(y) : x;}
static inline any* nc_any_null(any* x, void** y) {return is_nullish(x) ? create_any_from_null(y) : x;}
static inline any* nc_any_boolean(any* x, bool y) {return is_nullish(x) ? create_any_from_boolean(y) : x;}
static inline any* nc_any_number(any* x, double y) {return is_nullish(x) ? create_any_from_number(y) : x;}
static inline any* nc_any_string(any* x, char* y) {return is_nullish(x) ? create_any_from_string(y) : x;}
static inline any* nc_any_symbol(any* x, symbol y) {return is_nullish(x) ? create_any_from_symbol(y) : x;}
static inline any* nc_any_object(any* x, object* y) {return is_nullish(x) ? create_any_from_object(y) : x;}
static inline any* nc_any_array(any* x, array* y) {return is_nullish(x) ? create_any_from_array(y) : x;}
static inline any* nc_any_any(any* x, any* y) {return is_nullish(x) ? y : x;}


#define nc(a, b) _Generic((a), \
    void*: _Generic((b), \
        void*: nc_undefined_undefined, \
        void**: nc_undefined_null, \
        bool: nc_undefined_boolean, \
        double: nc_undefined_number, \
        char*: nc_undefined_string, \
        symbol: nc_undefined_symbol, \
        object*: nc_undefined_object, \
        array*: nc_undefined_array, \
        any*: nc_undefined_any \
    ), \
    void**: _Generic((b), \
        void*: nc_null_undefined, \
        void**: nc_null_null, \
        bool: nc_null_boolean, \
        double: nc_null_number, \
        char*: nc_null_string, \
        symbol: nc_null_symbol, \
        object*: nc_null_object, \
        array*: nc_null_array, \
        any*: nc_null_any \
    ), \
    bool: _Generic((b), \
        void*: nc_boolean_undefined, \
        void**: nc_boolean_null, \
        bool: nc_boolean_boolean, \
        double: nc_boolean_number, \
        char*: nc_boolean_string, \
        symbol: nc_boolean_symbol, \
        object*: nc_boolean_object, \
        array*: nc_boolean_array, \
        any*: nc_boolean_any \
    ), \
    double: _Generic((b), \
        void*: nc_number_undefined, \
        void**: nc_number_null, \
        bool: nc_number_boolean, \
        double: nc_number_number, \
        char*: nc_number_string, \
        symbol: nc_number_symbol, \
        object*: nc_number_object, \
        array*: nc_number_array, \
        any*: nc_number_any \
    ), \
    char*: _Generic((b), \
        void*: nc_string_undefined, \
        void**: nc_string_null, \
        bool: nc_string_boolean, \
        double: nc_string_number, \
        char*: nc_string_string, \
        symbol: nc_string_symbol, \
        object*: nc_string_object, \
        array*: nc_string_array, \
        any*: nc_string_any \
    ), \
    symbol: _Generic((b), \
        void*: nc_symbol_undefined, \
        void**: nc_symbol_null, \
        bool: nc_symbol_boolean, \
        double: nc_symbol_number, \
        char*: nc_symbol_string, \
        symbol: nc_symbol_symbol, \
        object*: nc_symbol_object, \
        array*: nc_symbol_array, \
        any*: nc_symbol_any \
    ), \
    object*: _Generic((b), \
        void*: nc_object_undefined, \
        void**: nc_object_null, \
        bool: nc_object_boolean, \
        double: nc_object_number, \
        char*: nc_object_string, \
        symbol: nc_object_symbol, \
        object*: nc_object_object, \
        array*: nc_object_array, \
        any*: nc_object_any \
    ), \
    array*: _Generic((b), \
        void*: nc_array_undefined, \
        void**: nc_array_null, \
        bool: nc_array_boolean, \
        double: nc_array_number, \
        char*: nc_array_string, \
        symbol: nc_array_symbol, \
        object*: nc_array_object, \
        array*: nc_array_array, \
        any*: nc_array_any \
    ), \
    any*: _Generic((b), \
        void*: nc_any_undefined, \
        void**: nc_any_null, \
        bool: nc_any_boolean, \
        double: nc_any_number, \
        char*: nc_any_string, \
        symbol: nc_any_symbol, \
        object*: nc_any_object, \
        array*: nc_any_array, \
        any*: nc_any_any \
    ) \
)(a, b)


#endif
