
#ifndef Neutrino_core_symbol
#define Neutrino_core_symbol

#include "util.h"

extern symbol Symbol_asyncIterator;
extern symbol Symbol_hasInstance;
extern symbol Symbol_isConcatSpreadable;
extern symbol Symbol_iterator;
extern symbol Symbol_match;
extern symbol Symbol_matchAll;
extern symbol Symbol_replace;
extern symbol Symbol_search;
extern symbol Symbol_species;
extern symbol Symbol_split;
extern symbol Symbol_toPrimitive;
extern symbol Symbol_toStringTag;
extern symbol Symbol_unscopables;

extern symbol next_symbol;

#define create_symbol() (next_symbol++)

symbol js_globalfunction_Symbol(void);

char* boolean_toString(bool this);
bool boolean_valueOf(bool this);

void* get_boolean_string(void* this, char* key);
void* get_boolean_symbol(void* this, symbol key);

void* set_boolean_string(void* this, char* key, void* value);
void* set_boolean_symbol(void* this, symbol key, void* value);

bool has_boolean_string(void* this, char* key);
bool has_boolean_symbol(void* this, symbol key);

bool delete_boolean_string(void* this, char* key);
bool delete_boolean_symbol(void* this, symbol key);

void set_enumerable_boolean_string(void* this, char* key, bool enumerable);
void set_enumerable_boolean_symbol(void* this, symbol key, bool enumerable);

#endif
