
#ifndef Neutrino_object
#define Neutrino_object

#include "safe_malloc.h"
#include <stdbool.h>
#include <inttypes.h>
#include <stdarg.h>
#include <string.h>


typedef uint64_t symbol;
extern symbol next_symbol;
extern symbol Symbol_toPrimitive;
static inline symbol create_symbol() {return next_symbol++;}


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


int hash4(char* str);

object* create_object(object* proto, int length, ...);

void* get_string(object* obj, char* key);
void* get_symbol(object* obj, symbol key);

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

void set_string(object* obj, char* key, void* value);
void set_symbol(object* obj, symbol key, void* value);

#define set_obj(obj, key, value) _Generic((key), char*: set_string, symbol: set_symbol)(obj, key, value)

void set_string_accessor(object* obj, char* key, void* (*get)(struct object* this), void (*set)(struct object* this, void* value));
void set_symbol_accessor(object* obj, symbol key, void* (*get)(struct object* this), void (*set)(struct object* this, void* value));

#define set_accessor(obj, key, get, set) _Generic((key), char*: set_string_accessor, symbol: set_symbol_accessor)(obj, key, get, set)

bool delete_string(object* obj, char* key);
bool delete_symbol(object* obj, symbol key);

#define delete(obj, key) _Generic((key), char*: delete_key, symbol: delete_symbol)(obj, key)

bool has_string(object* obj, char* key);
bool has_symbol(object* obj, symbol key);

#define has_obj(obj, key) _Generic((key), char*: has_string, symbol: has_symbol)(obj, key)

int num_keys(object* obj);


#define call_method(obj, method, ...) ((void*(*)())get_obj(obj, method))(obj, ## __VA_ARGS__)

#define new(proto, func, ...) ((new_target = func) func(create_object(proto, 0), ## __VA_ARGS__))

extern void (*new_target)();
extern long new_target_tag;


#endif
