
#include <stdarg.h>
#include "object.h"

#include "array.h"


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


array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}

#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);
