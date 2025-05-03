
#ifndef Neutrino_types
#define Neutrino_types

#include <stdbool.h>
#include <ctype.h>
#include <math.h>
#include "object.h"
#include "array.h"


#define NaN ((double)NAN)
#define JS_NULL ((void**)0)


static inline char* return_undefined(void* value) {return "undefined";}
static inline char* return_null(void** value) {return "null";}
static inline char* return_boolean(bool value) {return "boolean";}
static inline char* return_number(double value) {return "number";}
static inline char* return_string(char* value) {return "string";}
static inline char* return_symbol(symbol value) {return "symbol";}
static inline char* return_object(object* value) {return "object";}
static inline char* return_object_array(array* value) {return "object";}

static inline char* identity_string(char* value) {return value;}
static inline double identity_number(double value) {return value;}
static inline double identity_number_boolean(bool value) {return value;}

static inline double return_nan_undefined(void* value) {return NaN;}
static inline double return_nan_symbol(symbol value) {return NaN;}

static inline double return_0_null(void** value) {return 0;}


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

any* create_any_from_undefined(void* value);
any* create_any_from_null(void** value);
any* create_any_from_boolean(bool value);
any* create_any_from_number(double value);
any* create_any_from_string(char* value);
any* create_any_from_symbol(symbol value);
any* create_any_from_object(object* value);
any* create_any_from_array(array* value);

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


char* js_typeof_any(any* value);

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

any* object_to_primitive(object* value);

char* array_to_string(array* value);
double parse_number(char* value);
double cast_any_to_number(any* value);

static inline double cast_to_number_object(object* x) {return cast_any_to_number(object_to_primitive(x));}
static inline double cast_to_number_array(array* x) {return parse_number(array_to_string(x));}
#define cast_to_number(x) (_Generic((x), \
    void*: return_nan_undefined, \
    void**: return_0_null, \
    bool: identity_number_boolean, \
    double: identity_number, \
    char*: parse_number, \
    symbol: return_nan_symbol, \
    object*: cast_to_number_object, \
    array*: cast_to_number_array, \
    any*: cast_any_to_number \
)(x))

extern const char* BASE_CHARS;

char* number_to_string(double value, int base);
char* cast_any_to_string(any* value);

#define cast_to_string(x) (_Generic((x), void*: return_undefined, void**: return_null, bool: cast_to_string_boolean, double: number_to_string, char*: identity_string, symbol: return_symbol, object*: cast_to_string_object, array*: array_to_string, any*: cast_any_to_string)(x))

static inline char* cast_to_string_boolean(bool x) {return x ? "true" : "false";}
static inline char* cast_to_string_object(object* x) {return cast_to_string(object_to_primitive(x));}

bool cast_any_to_boolean(any* value);

static inline bool cast_to_boolean_number(double x) {return x != 0 && !isnan(x);}
static inline bool cast_to_boolean_string(char* x) {return *x != '\0';}
#define cast_to_boolean(x) (_Generic(x, void*: return_false_undefined, void**: return_false_undefined, bool: identity_boolean, double: cast_to_boolean_number, char*: cast_to_boolean_string, symbol: return_true_symbol, object*: return_true_object, array*: return_true_array, any*: cast_any_to_boolean)(x))


#endif
