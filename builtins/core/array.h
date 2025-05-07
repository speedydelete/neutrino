
#ifndef Neutrino_core_array
#define Neutrino_core_array

#include <stdarg.h>
#include "util.h"

array* create_array(int length);
array* create_array_with_items(int length, ...);
array* array_push(array* arr, any* item);

array* get_rest_arg_internal(va_list args, int count);
#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);

void* get_array_string(array* this, char* key);
void* get_array_symbol(array* this, symbol key);

#endif
