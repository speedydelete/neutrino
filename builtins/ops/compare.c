
#ifndef Neutrino_ops_compare
#define Neutrino_ops_compare

#include "../core/types.h"


#define gt(x, y) (cast_to_number(x) > cast_to_number(y))
#define lt(x, y) (cast_to_number(x) < cast_to_number(y))
#define gte(x, y) (!lt(x, y))
#define lte(x, y) (!gt(x, y))


#endif
