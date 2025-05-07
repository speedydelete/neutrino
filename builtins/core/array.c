
#include <ctype.h>
#include <stdarg.h>
#include <string.h>
#include "util.h"


array* create_array(int length) {
    array* out = safe_malloc(sizeof(array));
    out->length = length;
    out->items = safe_malloc(sizeof(void*) * length);
    return out;
}

array* create_array_with_items(int length, ...) {
    va_list args;
    va_start(args, length);
    array* out = safe_malloc(sizeof(array));
    out->length = length;
    out->items = safe_malloc(sizeof(void*) * length);
    for (int i = 0; i < length; i++) {
        out->items[i] = va_arg(args, void*);
    }
    va_end(args);
    return out;
}

array* array_push(array* arr, any* item) {
    void** new_items = safe_malloc(sizeof(void*) * (arr->length + 1));
    for (int i = 0; i < arr->length; i++) {
        new_items[i] = arr->items[i];
    }
    new_items[arr->length] = item;
    arr->length++;
    arr->items = new_items;
    return arr;
}


void* get_array_string(array* this, char* key) {
    if (isdigit(key[0])) {
        return this->items[atoi(key)];
    } else if (strcmp(key, "push") == 0) {
        return array_push;
    } else {
        return NULL;
    }
}

void* get_array_symbol(array* this, symbol key) {
    return NULL;
}


array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}
