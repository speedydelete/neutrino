
#ifndef Neutrino_globals_string
#define Neutrino_globals_string

#include <string.h>
#include "../core/types.h"

#define js_global_Number cast_any_to_number

char* number_toExponential(double this);
char* number_toFixed(double this, double digits);
char* number_toString(double this);

void* get_number_string(double value, char* key);
void* get_number_symbol(double value, symbol key);

void* set_number_string(double value, char* key, void* value);
void* set_number_symbol(double value, symbol key, void* value);

bool has_number_string(double value, char* key);
void* has_number_symbol(double value, symbol key);

#endif
