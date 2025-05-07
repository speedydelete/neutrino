
#ifndef Neutrino_core_object
#define Neutrino_core_object

#include "util.h"
#include <stdbool.h>
#include <inttypes.h>
#include <stdarg.h>
#include <string.h>

int hash4(char* str);

object* create_object(object* proto, int length, ...);

void* get_object_string(object* obj, char* key);
void* get_object_symbol(object* obj, symbol key);

void set_object_string(object* obj, char* key, void* value);
void set_symbol(object* obj, symbol key, void* value);

bool delete_object_string(object* obj, char* key);
bool delete_object_symbol(object* obj, symbol key);

bool has_object_string(object* obj, char* key);
bool has_object_symbol(object* obj, symbol key);

void set_enumerable_object_string(object* obj, char* key);
void set_enumerable_object_symbol(object* obj, symbol key);

#endif
