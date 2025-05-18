
#include <stdlib.h>
#include <math.h>
#include "../core/types.h"


void* js_global_undefined;
double js_global_Infinity;
double js_global_NaN;
object* js_global_arguments;


bool js_global_isNaN(double value) {
    return value != value;
}

bool js_global_isFinite(double value) {
    return isfinite(value);
}

double js_global_parseFloat(char* value) {
    return parse_number(value);
}

double js_global_parseInt(char* value) {
    return parse_number(value);
}


void init_core(void) {
    js_global_undefined = NULL;
    js_global_Infinity = INFINITY;
    js_global_NaN = (double)NAN;
    js_global_arguments = create_object(object_prototype, 0);
}
