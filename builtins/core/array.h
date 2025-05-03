
#ifndef Neutrino_array
#define Neutrino_array

#include <stdarg.h>
#include "object.h"


typedef struct array {
    int length;
    void** items;
} array;

array* create_array(int length);
array* create_array_with_items(int length, ...);


array* get_keys(object* obj);

array* get_rest_arg_internal(va_list args, int count);

#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);


#endif
