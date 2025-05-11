
#ifndef NEUTRINO_CORE_NUMBER
#define NEUTRINO_CORE_NUMBER

#include <string.h>
#include "util.h"

#define js_global_Number cast_any_to_number

char* number_toExponential(double this);
char* number_toFixed(double this, double digits);
char* number_toString(double this);

void* get_number_string(double this, char* key);
void* get_number_symbol(double this, symbol key);

void* set_number_string(double this, char* key, void* value);
void* set_number_symbol(double this, symbol key, void* value);

bool has_number_string(double this, char* key);
void* has_number_symbol(double this, symbol key);

#endif
