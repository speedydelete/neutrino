
#ifndef Neutrino_ops_arithmetic
#define Neutrino_ops_arithmetic

#include <inttypes.h>
#include <string.h>
#include <math.h>
#include "../core/types.h"


#define sub(x, y) (cast_to_number(x) - cast_to_number(y))
#define mul(x, y) (cast_to_number(x) * cast_to_number(y))
#define div(x, y) (cast_to_number(x) / cast_to_number(y))
#define mod(x, y) (cast_to_number(x) % cast_to_number(y))
#define exp(x, y) pow(cast_to_number(x), cast_to_number(y))

#define inc(x) (++cast_to_number(x))
#define dec(x) (--cast_to_number(x))
#define postfix_inc(x) (cast_to_number(x)++)
#define postfix_dec(x) (cast_to_number(x)--)

#define and(x, y) (double)((uint32_t)cast_to_number(x) & (uint32_t)cast_to_number(y))
#define or(x, y) (double)((uint32_t)cast_to_number(x) | (uint32_t)cast_to_number(y))
#define xor(x, y) (double)((uint32_t)cast_to_number(x) ^ (uint32_t)cast_to_number(y))
#define not(x) (double)~((uint32_t)cast_to_number(x))
#define lsh(x, y) (double)((uint32_t)cast_to_number(x) << (uint32_t)cast_to_number(y))
#define rsh(x, y) (double)((uint32_t)cast_to_number(x) >>> (uint32_t)cast_to_number(y))

#define land(x, y) (cast_to_boolean(x) ? x : y)
#define lor(x, y) (cast_to_boolean(x) ? y : x)
#define lnot(x) (!cast_to_boolean(x))


#endif

