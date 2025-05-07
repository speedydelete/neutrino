
#ifndef Neutrino_core_types
#define Neutrino_core_types


#include "util.h"
#include "boolean.h"
#include "number.h"
#include "string.h"
#include "symbol.h"
#include "object.h"
#include "array.h"


char* js_typeof_any(any* value);

any* object_to_primitive(object* value);

char* array_to_string(array* value);
double parse_number(char* value);
double any_to_number(any* value);

extern const char* BASE_CHARS;

char* number_to_string(double value, int base);
char* any_to_string(any* value);
bool any_to_boolean(any* value);

static inline char* undefined_to_property_key(void* value) {return "undefined";}
static inline char* null_to_property_key(void** value) {return "null";}
static inline char* boolean_to_property_key(bool value) {return value ? "true" : "false";}
static inline char* number_to_property_key(double value) {return number_to_string(value, 10);}
static inline char* string_to_property_key(char* value) {return value;}
static inline symbol symbol_to_property_key(symbol value) {return value;}
static inline char* object_to_property_key(object* value) {return object_to_primitive(value)->string;}
static inline char* array_to_property_key(array* value) {return array_to_string(value);}
static inline char* any_to_property_key(any* value) {return value->string;}

#define to_property_key(key) (_Generic((key), \
    void*: undefined_to_property_key, \
    void**: null_to_property_key, \
    bool: boolean_to_property_key, \
    double: number_to_property_key, \
    char*: string_to_property_key, \
    symbol: symbol_to_property_key, \
    object*: object_to_property_key, \
    array*: array_to_property_key, \
    any*: any_to_property_key \
)(key))

#define get(obj, key) (_Generic(key, \
    char*: _Generic((obj), \
        void*: get_undefined_string, \
        void**: get_null_string, \
        bool: get_boolean_string, \
        char*: get_string_string, \
        symbol: get_symbol_string, \
        object*: get_object_string, \
        array: get_array_string, \
        any*: get_any_string \
    ), \
    symbol: _Generic((obj), \
        void*: get_undefined_symbol, \
        void**: get_null_symbol, \
        bool: get_boolean_symbol, \
        char*: get_string_symbol, \
        symbol: get_symbol_symbol, \
        object*: get_object_symbol, \
        array: get_array_symbol, \
        any*: get_any_symbol \
    ) \
)(obj, key))

#define set(obj, key) (_Generic(key, \
    char*: _Generic((obj), \
        void*: set_undefined_string, \
        void**: set_null_string, \
        bool: set_boolean_string, \
        char*: set_string_string, \
        symbol: set_symbol_string, \
        object*: set_object_string, \
        array: set_array_string, \
        any*: set_any_string \
    ), \
    symbol: _Generic((obj), \
        void*: set_undefined_symbol, \
        void**: set_null_symbol, \
        bool: set_boolean_symbol, \
        char*: set_string_symbol, \
        symbol: set_symbol_symbol, \
        object*: set_object_symbol, \
        array: set_array_symbol, \
        any*: set_any_symbol \
    ) \
)(obj, key))

#define call_method(obj, key, return_type, ...) ((return_type(*)())(get(obj, key))(__VA_ARGS__))

#endif
