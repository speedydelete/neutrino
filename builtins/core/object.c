
#include <stdbool.h>
#include <inttypes.h>
#include <stdarg.h>
#include <string.h>
#include "util.h"

#include "object.h"


int hash4(char* str) {
    int hash = 0;
    for (int i = 0; str[i] != 0; i++) {
        hash = (hash + str[i]) & 0xf;
    }
    return hash;
}

object* create_object(object* proto, int length, ...) {
    object* out = safe_malloc(sizeof(object));
    out->prototype = proto;
    for (int i = 0; i < 16; i++) {
        out->data[i] = NULL;
    }
    out->symbols = NULL;
    va_list args;
    va_start(args, length);
    for (int i = 0; i < length; i++) {
        char* key = va_arg(args, char*);
        void* value = va_arg(args, void*);
        set_object_string(out, key, value);
    }
    va_end(args);
    return out;
}

void* get_object_string(object* obj, char* key) {
    struct string_property* prop = obj->data[hash4(key)];
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            return prop->value;
        }
        prop = prop->next;
    }
    if (obj->prototype != NULL) {
        return get_object_string(obj->prototype, key);
    }
    return NULL;
}

void* get_object_symbol(object* obj, symbol key) {
    struct symbol_property* prop = obj->symbols;
    while (prop != NULL) {
        if (prop->key == key) {
            return prop->value;
        }
        prop = prop->next;
    }
    if (obj->prototype != NULL) {
        return get_object_symbol(obj->prototype, key);
    }
    return NULL;
}



#define create_prop(type, name, key, value) \
    struct type* name = safe_malloc(sizeof(struct type)); \
    name->next = NULL; \
    name->key = key; \
    name->value = value;

void set_object_string(object* obj, char* key, void* value) {
    int hashed = hash4(key);
    struct string_property* prop = obj->data[hashed];
    if (prop == NULL) {
        create_prop(string_property, prop, key, value);
        obj->data[hashed] = prop;
        return;
    }
    struct string_property* prev = prop;
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            prop->value = value;
            return;
        }
        prev = prop;
        prop = prop->next;
    }
    create_prop(string_property, new_prop, key, value);
    prev->next = new_prop;
    return;
}

void set_object_symbol(object* obj, symbol key, void* value) {
    struct symbol_property* prop = obj->symbols;
    if (prop == NULL) {
        create_prop(symbol_property, new_prop, key, value);
        obj->symbols = new_prop;
        return;
    }
    struct symbol_property* prev = prop;
    while (prop != NULL) {
        if (prop->key == key) {
            prop->value = value;
            return;
        }
        prev = prop;
        prop = prop->next;
    }
    create_prop(symbol_property, new_prop, key, value);
    prev->next = new_prop;
}


bool has_object_string(object* obj, char* key) {
    struct string_property* prop = obj->data[hash4(key)];
    while (prop != NULL) {
        if (strcmp(prop->key, key) == 0) {
            return true;
        }
        prop = prop->next;
    }
    return false;
}

bool has_object_symbol(object* obj, symbol key) {
    struct symbol_property* prop = obj->symbols;
    while (prop != NULL) {
        if (prop->key == key) {
            return true;
        }
        prop = prop->next;
    }
    return false;
}


bool delete_object_string(object* obj, char* key) {
    int hashed = hash4(key);
    struct string_property* prop = obj->data[hashed];
    if (prop == NULL) {
        return false;
    }
    if (strcmp(prop->key, key) == 0) {
        obj->data[hashed] = prop->next;
        return true;
    }
    struct string_property* prev = prop;
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

bool delete_object_symbol(object* obj, symbol key) {
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


object* object_prototype;

char* object_prototype_toString(object* this) {
    return "[object Object]";
}

object* object_prototype_valueOf(object* this) {
    return this;
}

void init_object(void) {
    object_prototype = create_object(NULL, 2,
        "toString", object_prototype_toString,
        "valueOf", object_prototype_valueOf
    );
}
