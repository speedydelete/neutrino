
#ifndef Neutrino_core_types
#define Neutrino_core_types


#include "util.h"
#include "boolean.h"
#include "number.h"
#include "string.h"
#include "symbol.h"
#include "object.h"
#include "array.h"


char* js_typeof_any(any* value);

any* object_to_primitive(object* value);

char* array_to_string(array* value);
double parse_number(char* value);
double any_to_number(any* value);

extern const char* BASE_CHARS;

char* number_to_string(double value, int base);
char* any_to_string(any* value);
bool any_to_boolean(any* value);

bool equal(any* a, any* b);
bool strict_equal(any* a, any* b);
bool same_value_zero(any* a, any* b);

#endif
