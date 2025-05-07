
#include <inttypes.h>
#include <math.h>
#include "../core/util.h"


object* js_global_Math;

double math_clz32(double x) {
    return (double)__builtin_clz((uint32_t)x);
}

double math_f16round(double x) {
    return (double)(__fp16)(x);
}

double math_fround(double x) {
    return (double)(float)(x);
}

double math_imul(double x, double y) {
    return (double)((int32_t)x + (int32_t)y);
}

double math_max(array* items) {
    double out = -INFINITY;
    for (int i = 0; i < items->length; i++) {
        double x = cast_any_to_number(items[i]);
        if (x > out) {
            out = x;
        }
    }
    return out;
}

double math_min(array* items) {
    double out = INFINITY;
    for (int i = 0; i < items->length; i++) {
        double x = cast_any_to_number(items->items[i]);
        if (x < out) {
            out = x;
        }
    }
    return out;
}

double math_random() {
    FILE* urandom = fopen("/dev/urandom", "rb");
    if (!urandom) {
        throw("InternalError: /dev/urandom unavailable");
    }
    uint64_t rand_uint64;
    if (fread(&rand_uint64, sizeof(rand_uint64), 1, urandom) != 1) {
        perror("InternalError: read from /dev/urandom failed");
        fclose(urandom);
    }
    fclose(urandom);
    return (double)rand_uint64 / (double)UINT64_MAX;
}

double math_sumPrecise(array* items) {
    double out = 0.0;
    double error = 0.0;
    for (int i = 0; i < items->length; i++) {
        double y = *(double*)items->items[i] - error;
        double t = out + y;
        error = t - out - y;
        out = t;
    }
    return out;
}

double math_sign(double value) {
    return value > 0 ? 1 : (value < 0 ? -1 : 0);
}

void init_math() {
    double E = exp(1);
    js_global_Math = create_object(NULL, 1,
        "E", E,
        "LN10", log(10),
        "LN2", log(2),
        "LOG10E", log10(E),
        "PI", 4 * atan(1),
        "SQRT1_2", sqrt(1/2),
        "SQRT2", sqrt(2),
        "abs", fabs,
        "acos", acos,
        "acosh", acosh,
        "asin", asin,
        "asinh", asinh,
        "atan", atan,
        "atan2", atan2,
        "atanh", atanh,
        "cbrt", cbrt,
        "clz32", math_clz32,
        "cos", cos,
        "cosh", cosh,
        "exp", exp,
        "expm1", expm1,
        "floor", floor,
        "f16round", math_f16round,
        "fround", math_fround,
        "hypot", hypot,
        "imul", math_imul,
        "log", log,
        "log10", log10,
        "log1p", log1p,
        "log2", log2,
        "max", math_max,
        "min", math_min,
        "pow", pow,
        "random", math_random,
        "round", round,
        "sign", math_sign,
        "sin", sin,
        "sinh", sinh,
        "sqrt", sqrt,
        "sumPrecise", math_sumPrecise,
        "tan", tan,
        "tanh", tanh,
        "trunc", trunc
    );
}
