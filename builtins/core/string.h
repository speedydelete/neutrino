
#ifndef Neutrino_core_string
#define Neutrino_core_string

#include <stdbool.h>
#include <ctype.h>
#include <string.h>
#include <math.h>
#include "util.h"

#define js_global_String cast_any_to_string

char string_at(char* this, double index);
char string_charAt(char* this, double index);
double string_charCodeAt(char* this, double index);
bool string_endsWith(char* this, char* other);
bool string_includes(char* this, char* other);
double string_indexOf(char* this, char* other);
double string_lastIndexOf(char* this, char* other);
char* string_padEnd(char* this, double length, char* str);
char* string_padStart(char* this, double length, char* str);
char* string_repeat(char* this, double times);
char* string_replace(char* this, char* old, char* new);
char* string_replaceAll(char* this, char* old, char* new);
char* string_slice(char* this, double start, double end);
char* string_substring(char* this, double start, double length);
char* string_toLowerCase(char* this);
char* string_toUpperCase(char* this);
char* string_trim(char* this);
char* string_trimEnd(char* this);
char* string_trimStart(char* this);

void* get_string_string(char* value, char* key);
void* get_string_symbol(char* value, symbol key);

#define get_string(value, key) (_Generic((key), string: get_string_string, symbol: get_string_symbol)(value))

void* set_string_string(char* this, char* key, void* value);
void* set_string_symbol(char* this, symbol key, void* value);

#define set_string(value, key) (_Generic((key), string: set_string_string, symbol: set_string_symbol)(value))

#endif
