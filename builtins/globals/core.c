
#include <stdlib.h>
#include <math.h>
#include "../core/types.h"


void* js_global_undefined;
double js_global_Infinity;
double js_global_NaN;


bool js_global_isNaN(double value) {
    return value != value;
}

bool js_global_isFinite(double value) {
    return isfinite(value);
}

double js_global_parseFloat(char* value) {
    return parse_number(value, 10);
}

double js_global_parseInt(char* value, double base) {
    return parse_number(value, (int)base);
}


object* object_prototype;

char* object_prototype_toString(object* this) {
    return "[object Object]";
}

void init_core() {
    js_global_undefined = NULL;
    js_global_Infinity = INFINITY;
    js_global_NaN = (double)NAN;
    object_prototype = create_object(NULL, 1, "toString", object_prototype_toString);
}
