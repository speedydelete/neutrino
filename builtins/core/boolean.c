
#include <stdbool.h>
#include <string.h>
#include "util.h"


char* boolean_toString(bool this) {
    return this ? "true" : "false";
}

bool boolean_valueOf(bool this) {
    return this;
}


void* get_boolean_string(bool this, char* key) {
    if (strcmp(key, "toString") == 0) {
        return boolean_toString;
    } else if (strcmp(key, "valueOf") == 0) {
        return boolean_valueOf;
    } else {
        return NULL;
    }
}

void* get_boolean_symbol(bool this, symbol key) {
    return NULL;
}


bool has_boolean_string(bool this, char* key) {
    return strcmp(key, "toString") == 0 || strcmp(key, "valueOf") == 0;
}

bool has_boolean_symbol(bool this, symbol key) {
    return false;
}
