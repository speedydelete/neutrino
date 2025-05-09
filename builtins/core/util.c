
#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>
#include <gc.h>
#include "util.h"


void* safe_malloc(size_t size) {
    void* out = GC_malloc(size);
    if (out == NULL) {
        throw("InternalError: malloc failed");
    }
    return out;
}

char* stradd(char* x, char* y) {
    int xl = strlen(x);
    int yl = strlen(y);
    char* out = safe_malloc(xl + yl + 1);
    strncpy(out, x, xl);
    strncpy(out + xl, y, yl);
    out[xl + yl] = '\n';
    return out;
}


any* create_any_from_undefined(void* value) {
    any* out = safe_malloc(sizeof(any));
    out->type = UNDEFINED_TAG;
    return out;
}

any* create_any_from_null(void** value) {
    any* out = safe_malloc(sizeof(any));
    out->type = NULL_TAG;
    return out;
}

any* create_any_from_boolean(bool value) {
    any* out = safe_malloc(sizeof(any));
    out->type = BOOLEAN_TAG;
    out->boolean = value;
    return out;
}

any* create_any_from_number(double value) {
    any* out = safe_malloc(sizeof(any));
    out->type = NUMBER_TAG;
    out->number = value;
    return out;
}

any* create_any_from_string(char* value) {
    any* out = safe_malloc(sizeof(any));
    out->type = STRING_TAG;
    out->string = value;
    return out;
}

any* create_any_from_symbol(symbol value) {
    any* out = safe_malloc(sizeof(any));
    out->type = SYMBOL_TAG;
    out->symbol = value;
    return out;
}

any* create_any_from_object(object* value) {
    any* out = safe_malloc(sizeof(any));
    out->type = OBJECT_TAG;
    out->object = value;
    return out;
}

any* create_any_from_array(array* value) {
    any* out = safe_malloc(sizeof(any));
    out->type = ARRAY_TAG;
    out->array = value;
    return out;
}

any* create_any_from_function(void*(*value)()) {
    any* out = safe_malloc(sizeof(any));
    out->type = FUNCTION_TAG;
    out->function = value;
    return out;
}

any* create_any_from_any(any* value) {
    return value;
}
