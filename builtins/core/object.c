
#include "safe_malloc.h"
#include <stdbool.h>
#include <inttypes.h>
#include <stdarg.h>

#include "object.h"


typedef uint64_t symbol;
symbol next_symbol = 0;
#define create_symbol() next_symbol++

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

