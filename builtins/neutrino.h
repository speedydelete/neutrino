
#ifndef Neutrino
#define Neutrino

#include "core/object.h"
#include "core/array.h"
#include "core/types.h"

#include "ops/eq.c"
#include "ops/seq.c"
#include "ops/compare.c"
#include "ops/add.c"
#include "ops/arithmetic.c"
#include "ops/nc.c"

#include "globals/index.h"

extern object* js_global_neutrino;

void init(int argc, char** argv);

void js_globalfunction_print(object* this, char* text);

#endif
