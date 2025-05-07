
#ifndef Neutrino_core_boolean
#define Neutrino_core_boolean

#include "util.h"

char* boolean_toString(bool this);
bool boolean_valueOf(bool this);

void* get_boolean_string(bool this, char* key);
void* get_boolean_symbol(bool this, symbol key);

bool has_boolean_string(bool this, char* key);
bool has_boolean_symbol(bool this, symbol key);

#endif
