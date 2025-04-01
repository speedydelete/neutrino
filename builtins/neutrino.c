
#ifndef NEUTRINO_VERSION

#define NEUTRINO_VERSION "0.1.0"

#include <stdbool.h>
#include <stdlib.h>
#include <stdarg.h>
#include <inttypes.h>
#include <string.h>
#include <stdio.h>


#define safe_malloc(ptr, size) do { \
    ptr = malloc(size); \
    if (!ptr) { \
        fprintf(stderr, "InternalError: malloc failed\n"); \
        exit(4); \
    } \
} while (0);


typedef struct array {
    int length;
    void** items;
} array;

array* create_array(int length) {
    struct array* out;
    safe_malloc(out, sizeof(array));
    out->length = length;
    safe_malloc(out->items, length * sizeof(void*));
    return out;
}

array* create_array_with_items(int length, ...) {
    va_list args;
    va_start(args, length);
    struct array* out;
    safe_malloc(out, sizeof(array));
    out->length = length;
    safe_malloc(out->items, length * sizeof(void*));
    for (int i = 0; i < length; i++) {
        out->items[i] = va_arg(args, void*);
    }
    va_end(args);
    return out;
}

void array_push(array* arr, void* item) {
    void** new_items;
    safe_malloc(new_items, sizeof(void*) * (arr->length + 1));
    for (int i = 0; i < arr->length; i++) {
        new_items[i] = arr->items[i];
    }
    arr->length++;
    free(arr->items);
    arr->items = new_items;
}

array* array_slice(array* arr, int start, int end) {
    array* out = create_array(start - end);
    for (int i = start; i < end; i++) {
        out->items[i] = arr->items[i];
    }
    return out;
}


typedef uint64_t symbol;

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

void set_key(object* obj, char* key, void* value);

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
        set_key(out, va_arg(args, char*), va_arg(args, void*));
    }
    va_end(args);
    return out;
}

void* get_key(object* obj, char* key) {
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
        return get_key(obj->prototype, key);
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

void set_key(object* obj, char* key, void* value) {
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

void set_accessor(object* obj, char* key, void* (*get)(struct object* this), void (*set)(struct object* this, void* value)) {
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

bool delete_key(object* obj, char* key) {
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

bool has_key(object* obj, char* key) {
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

array* get_keys(object* obj) {
    array* out = create_array(num_keys(obj));
    int index = 0;
    struct property* prop;
    for (int i = 0; i < 16; i++) {
        prop = obj->data[i];
        while (prop != NULL) {
            out->items[index] = prop->key;
            index++;
            prop = prop->next;
        }
    }
    return out;
}

#define call(obj, method, ...) get_key(obj, method)(obj, __VA_ARGS__)


#define count_tags(tags) (sizeof(tags) - __builtin_clzl(tags)) >> 2
#define get_tag(index) (sizeof(tags) >> index*4) & 0xf
#define start_args() int count = count_tags(tags); int processed = 0; va_list args; va_start(args, count);
#define get_arg(type, name) processed++; type name = va_arg(args, type);
#define end_args() va_end(args);

char* typeof_from_tag(long tag, int index) {
    tag = (tag >> (index << 2)) & 3;
    switch (tag) {
        case 0:
            return "undefined";
        case 1:
        case 7:
            return "object";
        case 2:
            return "boolean";
        case 3:
            return "number";
        case 4:
            return "string";
        case 5:
            return "symbol";
        case 6:
            return "bigint";
        case 8:
            return "function";
        case 9:
            return "tuple";
        case 10:
            return "record";
        default:
            printf("NeutrinoBugError: invalid type tag");
            exit(3);
    }
}

object* new_target = NULL;
long new_target_tag = 0;
#define new(proto, func, ...) func(create_object(proto, 0), __VA_ARGS__)

array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}

#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);


typedef struct bigint {
    int size;
    bool sign;
    uint32_t data[];
} bigint;

bigint* create_bigint(bool sign, int size, uint32_t data[]) {
    bigint* out;
    safe_malloc(out, sizeof(bigint) + 32 * size);
    out->size = size;
    out->sign = sign;
    for (int i = 0; i < size; i++) {
        out->data[i] = data[i];
    }
    return out;
}

bool bigint_eq(bigint* a, bigint* b) {
    if (a->size != b->size) {
        return false;
    }
    for (int i = 0; i < a->size; i++) {
        if (a->data[i] != b->data[i]) {
            return false;
        }
    }
    return true;
}

#define bigint_ne(a, b) !bigint_eq(a, b);

bool bigint_cmp(bigint* a, bigint* b, bool eq) {
    if (a->size > b->size) {
        return false;
    }
    for (int i = 0; i < a->size; i++) {
        if (a->data[i] < b->data[i]) {
            return true;
        } else if (a->data[i] > b->data[i]) {
            return false;
        }
    }
    return eq;
}

#define bigint_lt(a, b) bigint_cmp(a, b, false)
#define bigint_le(a, b) bigint_cmp(a, b, true)
#define bigint_gt(a, b) !bigint_cmp(a, b, true)
#define bigint_ge(a, b) !bigint_cmp(a, b, false)

bigint* bigint_copy(bigint* x) {
    bigint* out;
    safe_malloc(out, x->size);
    for (int i = 0; i < x->size; i++) {
        out->data[i] = x->data[i];
    }
    return out;
}

bigint* bigint_add_unsigned(bigint* a, bigint* b, bool sign) {
    if (a->size > b->size) {
        bigint* temp = a;
        a = b;
        b = temp;
    }
    bigint* out;
    safe_malloc(out, sizeof(bigint) + 32 * (a->size + ((a->data[a->size - 1] + b->data[a->size - 1]) > UINT32_MAX)));
    out->sign = sign;
    bool carry = 0;
    for (int i = 0; i < a->size; i++) {
        if (i > b->size) {
            out->data[i] = a->data[i];
        } else {
            uint64_t value = a->data[i] + b->data[i] + carry;
            if (value > UINT32_MAX) {
                carry = true;
            }
            out->data[i] = (uint32_t)value;
        }
    }
    return out;
}

bigint* bigint_sub_unsigned(bigint* a, bigint* b) {
    if (a->size > b->size) {
        bigint* temp = a;
        a = b;
        b = temp;
    }
    bigint* out;
    safe_malloc(out, sizeof(bigint) + 32 * (a->size - ((a->data[a->size - 1] - b->data[a->size - 1]) == 0)));
    bool carry = 0;
    for (int i = 0; i < a->size; i++) {
        if (i > b->size) {
            out->data[i] = a->data[i];
        } else {
            int64_t value = a->data[i] - b->data[i];
            if (value < 0) {
                carry = true;
                value += UINT32_MAX + 1;
            }
            out->data[i] = (uint32_t)value;
        }
    }
    out->sign = carry;
    return out;
}

#define bigint_neg(x) bigint_sub_unsigned(0, x)

bigint* bigint_addsub(bigint* a, bigint* b, bool sub) {
    char signs = (a->sign << 1) + (b->sign ^ sub);
    if (signs == 0) {
        return bigint_add_unsigned(a, b, false);
    } else if (signs == 1) {
        return bigint_sub_unsigned(a, b);
    } else if (signs == 2) {
        return bigint_sub_unsigned(b, a);
    } else {
        return bigint_add_unsigned(a, b, true);
    }
}

#define bigint_add(a, b) bigint_addsub(a, b, false)
#define bigint_sub(a, b) bigint_addsub(a, b, true)


#endif
