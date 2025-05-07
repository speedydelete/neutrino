
#ifndef Neutrino_globals_core
#define Neutrino_globals_core

#include <stdbool.h>
#include <stdlib.h>
#include <math.h>

extern void* js_global_undefined;
extern double js_global_Infinity;
extern double js_global_NaN;

bool js_global_isFinite(double value);
bool js_global_isNaN(double value);
double js_global_parseFloat(char* value);
double js_global_parseInt(char* value, (int)base);

extern object* object_prototype;
char* object_prototype_toString(object* this);

void init_core();

#endif
