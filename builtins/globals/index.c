
#include "../core/object.h"
#include "core.h"
#include "number.h"
#include "string.h"
#include "math.h"
#include "console.h"


char* boolean_toString(bool this) {
    return this ? "true" : "false";
}

char* symbol_toString(symbol this) {
    return "Symbol";
}

any* get_any_string(any* this, char* key) {
    switch (this->type) {
        case UNDEFINED_TAG:
        case NULL_TAG:
            return NULL;
        case BOOLEAN_TAG:
            return strcmp(key, "toString") == 0 ? boolean_toString : NULL;
        case NUMBER_TAG:
            return get_number_string(key);
        case STRING_TAG:
            return get_string_string(key);
        case SYMBOL_TAG:
            return strcmp(key, "toString") == 0 ? symbol_toString : NULL;
        case OBJECT_TAG:
            return get_obj_string(this->object, key);
        default:
            return NULL;
    }
}

any* get_any_symbol(any* this, symbol key) {
    switch (this->type) {
        case OBJECT_TAG:
            return get_obj_symbol(this->object, key);
        default:
            return NULL;
    }
}


void* set_any_string(any* this, char* key, void* value) {
    if (this->type == OBJECT_TAG) {
        set_obj_string(this->object, key, value);
    }
    return value;
}

void* set_any_symbol(any* this, symbol key, void* value) {
    if (this->type == OBJECT_TAG) {
        set_obj_symbol(this->object, key, value);
    }
    return value;
}
