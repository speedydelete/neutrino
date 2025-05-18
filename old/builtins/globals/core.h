
#ifndef NEUTRINO_GLOBALS_CORE
#define NEUTRINO_GLOBALS_CORE

#include <stdbool.h>
#include <stdlib.h>
#include <math.h>

extern void* js_global_undefined;
extern double js_global_Infinity;
extern double js_global_NaN;
extern object* js_global_arguments;

bool js_global_isFinite(double value);
bool js_global_isNaN(double value);
double js_global_parseFloat(char* value);
double js_global_parseInt(char* value);

void init_core(void);

#endif
