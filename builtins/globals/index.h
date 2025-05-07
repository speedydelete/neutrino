
#ifndef Neutrino_globals
#define Neutrino_globals

#include "../core/object.h"
#include "core.h"
#include "string.h"
#include "math.h"
#include "console.h"

static inline void* get_undefined_string(void* this, char* key) {return NULL;}
static inline void* get_undefined_symbol(void* this, symbol key) {return NULL;}

static inline void* get_null_string(void** this, char* key) {return NULL;}
static inline void* get_null_symbol(void** this, symbol key) {return NULL;}

char* boolean_toString(symbol this);
static inline void* get_boolean_string(bool this, char* key) {return strcmp(key, "toString") == 0 ? symbol_toString : NULL;}
static inline void* get_boolean_symbol(bool this, symbol key) {return NULL;}

char* symbol_toString(symbol this);
static inline void* get_symbol_string(symbol this, char* key) {return strcmp(key, "toString") == 0 ? symbol_toString : NULL;}
static inline void* get_symbol_symbol(symbol this, symbol key) {return NULL;}

any* get_any_string(any* this, char* key);
any* get_any_symbol(any* this, symbol key);

#define get(obj, key) (_Generic(key, \
    char*: _Generic((obj), \
        void*: get_undefined_string, \
        void**: get_null_string, \
        bool: get_boolean_string, \
        char*: get_string_string, \
        symbol: get_symbol_string, \
        object*: get_object_string, \
        array: get_array_string, \
        any*: get_any_string, \
    ), \
    symbol: _Generic((obj), \
        void*: get_undefined_symbol, \
        void**: get_null_symbol, \
        bool: get_boolean_symbol, \
        char*: get_string_symbol, \
        symbol: get_symbol_symbol, \
        object*: get_object_symbol, \
        array: get_array_symbol, \
        any*: get_any_symbol, \
    ), \
)(obj, key))


static inline void* set_undefined(void* this, char* key, void* value) {return value;}
static inline void* set_null(void* this, char* key, void* value) {return value;}
static inline void* set_boolean(void* this, char* key, void* value) {return value;}
static inline void* set_symbol(void* this, char* key, void* value) {return value;}

void* set_any_string(any* this, char* key, void* value);
void* set_any_symbol(any* this, symbol key, void* value);

#define set(obj, key) (_Generic(key, \
    char*: _Generic((obj), \
        void*: set_undefined_string, \
        void**: set_null_string, \
        bool: set_boolean_string, \
        char*: set_string_string, \
        symbol: set_symbol_string, \
        object*: set_object_string, \
        array: set_array_string, \
        any*: set_any_string, \
    ), \
    symbol: _Generic((obj), \
        void*: set_undefined_symbol, \
        void**: set_null_symbol, \
        bool: set_boolean_symbol, \
        char*: set_string_symbol, \
        symbol: set_symbol_symbol, \
        object*: set_object_symbol, \
        array: set_array_symbol, \
        any*: set_any_symbol, \
    ), \
)(obj, key))

#endif
