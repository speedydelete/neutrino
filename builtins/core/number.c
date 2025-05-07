
#include "util.h"
#include <math.h>


char* number_toExponential(double this) {
    int n = log10(this);
    char* nstr = number_to_string(n, 10);
    return stradd(number_to_string(this/pow(10, n), 10), n > 0 ? stradd('+', nstr) : nstr);
}

char* number_toFixed(double this, double digits) {
    char* start = stradd(number_to_string(round(this), 10), ".");
    return stradd(start, number_to_string(round(this * pow(10, digits))));
}

char* number_toString(double this) {
    return number_to_string(this, 10);
}


void* get_number_string(char* value, char* key) {
    if (strcmp(key, "toExponential") == 0) {
        return number_toExponential;
    } else if (strcmp(key, "toFixed") == 0) {
        return number_toFixed;
    } else if (strcmp(key, "toString") == 0) {
        return number_toString;
    } else {
        return NULL;
    }
}

void* get_number_symbol(char* value, symbol key) {
    return NULL;
}

void* set_number_string(char* this, char* key, void* value) {
    return value;
}

void* set_number_symbol(char* this, symbol key, void* value) {
    return value;
}


#endif
