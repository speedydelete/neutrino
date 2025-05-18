
#ifndef NEUTRINO_CORE_OBJECT
#define NEUTRINO_CORE_OBJECT

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
void set_object_symbol(object* obj, symbol key, void* value);

bool delete_object_string(object* obj, char* key);
bool delete_object_symbol(object* obj, symbol key);

bool has_object_string(object* obj, char* key);
bool has_object_symbol(object* obj, symbol key);

extern object* object_prototype;
char* object_prototype_toString(object* this);
object* object_prototype_valueOf(object* this);

void init_object(void);

#endif
