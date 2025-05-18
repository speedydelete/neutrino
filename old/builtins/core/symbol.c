
#include <stdlib.h>
#include <string.h>
#include "util.h"
#include "symbol.h"


symbol Symbol_asyncIterator = 1;
symbol Symbol_hasInstance = 2;
symbol Symbol_isConcatSpreadable = 3;
symbol Symbol_iterator = 4;
symbol Symbol_match = 5;
symbol Symbol_matchAll = 6;
symbol Symbol_replace = 7;
symbol Symbol_search = 8;
symbol Symbol_species = 9;
symbol Symbol_split = 10;
symbol Symbol_toPrimitive = 11;
symbol Symbol_toStringTag = 12;
symbol Symbol_unscopables = 13;

symbol next_symbol = 14;


symbol js_globalfunction_Symbol(void) {
    return next_symbol++;
}


char* symbol_toString(symbol this) {
    return "Symbol()";
}

symbol symbol_valueOf(symbol this) {
    return this;
}


void* get_symbol_string(symbol this, char* key) {
    if (strcmp(key, "toString") == 0) {
        return symbol_toString;
    } else if (strcmp(key, "valueOf") == 0) {
        return symbol_valueOf;
    } else {
        return NULL;
    }
}

void* get_symbol_symbol(symbol this, symbol key) {
    return NULL;
}


void* set_null_string(symbol this, char* key, void* value) {
    throw(stradd("Cannot set properties of symbol (setting '", stradd(key, "')")));
}

void* set_null_symbol(symbol this, symbol key, void* value) {
    throw("Cannot set properties of symbol (setting Symbol)");
}


bool has_symbol_string(symbol this, char* key) {
    return strcmp(key, "toString") == 0 || strcmp(key, "valueOf") == 0;
}

bool has_symbol_symbol(symbol this, symbol key) {
    return false;
}


bool delete_symbol_string(symbol this, char* key) {
    throw(stradd("Cannot delete properties of symbol (deleting '", stradd(key, "')")));
    exit(1);
}

bool delete_symbol_symbol(symbol this, symbol key) {
    throw("Cannot delete properties of symbol (deleting 'Symbol()')");
}


void set_enumerable_symbol_string(symbol this, char* key, bool enumerable) {
    throw(stradd("Cannot set properties of symbol (setting '", stradd(key, "')")));
}

void set_enumerable_null_symbol(symbol this, char* key, bool enumerable) {
    throw("Cannot set properties of symbol (setting 'Symbol()')");
}
