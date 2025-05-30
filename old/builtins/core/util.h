
#ifndef NEUTRINO_CORE_UTIL
#define NEUTRINO_CORE_UTIL

#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <inttypes.h>
#include <math.h>
#include <gc.h>

#define JS_NULL (void**)NULL
#define NaN (double)NAN

#define throw(msg) fprintf(stderr, "%s", msg); exit(4);

void* safe_malloc(size_t size);
char* stradd(char* x, char* y);

typedef uint32_t symbol;

typedef struct string_property {
    char* key;
    void* value;
    struct string_property* next;
} string_property;

typedef struct symbol_property {
    symbol key;
    void* value;
    struct symbol_property* next;
} symbol_property;

typedef struct object {
    struct object* prototype;
    struct string_property* data[16];
    struct symbol_property* symbols;
} object;


typedef struct array {
    int length;
    void** items;
} array;


enum AnyTypeTag {
    UNDEFINED_TAG,
    NULL_TAG,
    BOOLEAN_TAG,
    NUMBER_TAG,
    STRING_TAG,
    SYMBOL_TAG,
    OBJECT_TAG,
    FUNCTION_TAG,
    ARRAY_TAG,
};

typedef struct any {
    enum AnyTypeTag type;
    union {
        void* undefined;
        void** null;
        bool boolean;
        double number;
        char* string;
        symbol symbol;
        object* object;
        void* (*function)();
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
any* create_any_from_function(void*(*value)());
any* create_any_from_any(any* value);

#define create_any(x) (_Generic((x), \
    void*: create_any_from_undefined, \
    void**: create_any_from_null, \
    bool: create_any_from_boolean, \
    char*: create_any_from_string, \
    symbol: create_any_from_symbol, \
    object*: create_any_from_object, \
    array*: create_any_from_array, \
    void*(*)(): create_any_from_function, \
    any*: create_any_from_any \
)(x))

#endif
