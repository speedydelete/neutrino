
#ifndef Neutrino_op_eq
#define Neutrino_op_eq

#include <stdbool.h>
#include <string.h>
#include "../core/types.h"


static inline bool eq_any_any_same_type(any* x, any* y);
static bool eq_any_any_primitive(any* x, any* y);
static bool eq_any_any(any* x, any* y);

static inline bool eq_undefined_undefined(void* x, void* y);
static inline bool eq_undefined_null(void* x, void** y);
static inline bool eq_undefined_boolean(void* x, bool y);
static inline bool eq_undefined_number(void* x, double y);
static inline bool eq_undefined_string(void* x, char* y);
static inline bool eq_undefined_symbol(void* x, symbol y);
static inline bool eq_undefined_object(void* x, object* y);
static inline bool eq_undefined_array(void* x, array* y);
static inline bool eq_undefined_any(void* x, any* y);

static inline bool eq_null_undefined(void** x, void* y);
static inline bool eq_null_null(void** x, void** y);
static inline bool eq_null_boolean(void** x, bool y);
static inline bool eq_null_number(void** x, double y);
static inline bool eq_null_string(void** x, char* y);
static inline bool eq_null_symbol(void** x, symbol y);
static inline bool eq_null_object(void** x, object* y);
static inline bool eq_null_array(void** x, array* y);
static inline bool eq_null_any(void** x, any* y);

static inline bool eq_boolean_undefined(bool x, void* y);
static inline bool eq_boolean_null(bool x, void** y);
static inline bool eq_boolean_boolean(bool x, bool y);
static inline bool eq_boolean_number(bool x, double y);
static inline bool eq_boolean_string(bool x, char* y);
static inline bool eq_boolean_symbol(bool x, symbol y);
static inline bool eq_boolean_object(bool x, object* y);
static inline bool eq_boolean_array(bool x, array* y);
static inline bool eq_boolean_any(bool x, any* y);

static inline bool eq_number_undefined(double x, void* y);
static inline bool eq_number_null(double x, void** y);
static inline bool eq_number_boolean(double x, bool y);
static inline bool eq_number_number(double x, double y);
static inline bool eq_number_string(double x, char* y);
static inline bool eq_number_symbol(double x, symbol y);
static inline bool eq_number_object(double x, object* y);
static inline bool eq_number_array(double x, array* y);
static inline bool eq_number_any(double x, any* y);

static inline bool eq_string_undefined(char* x, void* y);
static inline bool eq_string_null(char* x, void** y);
static inline bool eq_string_boolean(char* x, bool y);
static inline bool eq_string_number(char* x, double y);
static inline bool eq_string_string(char* x, char* y);
static inline bool eq_string_symbol(char* x, symbol y);
static inline bool eq_string_object(char* x, object* y);
static inline bool eq_string_array(char* x, array* y);
static inline bool eq_string_any(char* x, any* y);

static inline bool eq_symbol_undefined(symbol x, void* y);
static inline bool eq_symbol_null(symbol x, void** y);
static inline bool eq_symbol_boolean(symbol x, bool y);
static inline bool eq_symbol_number(symbol x, double y);
static inline bool eq_symbol_string(symbol x, char* y);
static inline bool eq_symbol_symbol(symbol x, symbol y);
static inline bool eq_symbol_object(symbol x, object* y);
static inline bool eq_symbol_array(symbol x, array* y);
static inline bool eq_symbol_any(symbol x, any* y);

static inline bool eq_object_undefined(object* x, void* y);
static inline bool eq_object_null(object* x, void** y);
static inline bool eq_object_boolean(object* x, bool y);
static inline bool eq_object_number(object* x, double y);
static inline bool eq_object_string(object* x, char* y);
static inline bool eq_object_symbol(object* x, symbol y);
static inline bool eq_object_object(object* x, object* y);
static inline bool eq_object_array(object* x, array* y);
static inline bool eq_object_any(object* x, any* y);

static inline bool eq_array_undefined(array* x, void* y);
static inline bool eq_array_null(array* x, void** y);
static inline bool eq_array_boolean(array* x, bool y);
static inline bool eq_array_number(array* x, double y);
static inline bool eq_array_string(array* x, char* y);
static inline bool eq_array_symbol(array* x, symbol y);
static inline bool eq_array_object(array* x, object* y);
static inline bool eq_array_array(array* x, array* y);
static inline bool eq_array_any(array* x, any* y);

static inline bool eq_any_undefined(any* x, void* y);
static inline bool eq_any_null(any* x, void** y);
static inline bool eq_any_boolean(any* x, bool y);
static inline bool eq_any_number(any* x, double y);
static inline bool eq_any_string(any* x, char* y);
static inline bool eq_any_symbol(any* x, symbol y);
static inline bool eq_any_object(any* x, object* y);
static inline bool eq_any_array(any* x, array* y);


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


#endif
