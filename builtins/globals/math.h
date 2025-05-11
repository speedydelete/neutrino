
#ifndef NEUTRINO_GLOBALS_MATH
#define NEUTRINO_GLOBALS_MATH

#include <inttypes.h>
#include <math.h>
#include "../core/util.h"
#include "../core/object.h"

extern object* js_global_Math;

double math_clz32(double x);
double math_fround(double x);
double math_imul(double x, double y);
double math_max(array* items);
double math_min(array* items);
double math_random();
double math_sumPrecise(array* items);
double math_sign(double value);

void init_math(void);

#endif
