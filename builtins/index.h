
#ifndef Neutrino
#define Neutrino

#include "core/array.h"
#include "core/boolean.h"
#include "core/string.h"
#include "core/object.h"
#include "core/types.h"

#include "globals/index.h"

extern object* js_global_neutrino;
extern object* js_global_globalThis;

void init(int argc, char** argv);

#endif
