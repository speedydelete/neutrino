
#ifndef NEUTRINO_CORE_ARRAY
#define NEUTRINO_CORE_ARRAY

#include <stdarg.h>
#include "util.h"

array* create_array(int length);
array* create_array_with_items(int length, ...);


char* array_toString(array* this);
array* array_valueOf(array* this);
array* array_at(array* this, double index);
array* array_copyWithin(array* this, double target, double start, double end);
bool array_every(array* this, bool (*func)(void* item));
array* array_fill(array* this, void* value);
array* array_filter(array* this, bool (*func)(void* item));
any* array_find(array* this, bool (*func)(void* item));
any* array_findIndex(array* this, bool (*func)(void* item));
any* array_findLast(array* this, bool (*func)(void* item));
any* array_findLastIndex(array* this, bool (*func)(void* item));
array* array_flat(array* this, int depth);
array* array_flatMap(array* this, any* (*func)(void* item));
void array_forEach(array* this, bool (*func)(void* item));
bool array_includes(array* this, void* item);
any* array_indexOf(array* this, any* item);
char* array_join(array* this, char* sep);
any* array_lastIndexOf(array* this, any* item);
array* array_map(array* this, void* (*func)(void* item));
void* array_pop(array* this);
array* array_push(array* this, any* item);
any* array_reduce(array* this, any* (*func)(void* a, void* b));
any* array_reduceRight(array* this, any* (*func)(void* a, void* b));
array* array_reverse(array* this);
void* array_shift(array* this);
array* array_slice(array* this, double start, double end);
bool array_some(array* this, bool (*func)(void* item));

void* get_array_string(array* this, char* key);
void* get_array_symbol(array* this, symbol key);

array* get_rest_arg_internal(va_list args, int count);
#define get_rest_arg(name) array* name = get_rest_arg_internal(args, count - processed);

#endif
