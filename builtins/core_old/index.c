
#include "util.h"
#include "undefined.h"
#include "null.h"
#include "boolean.h"
#include "number.h"
#include "string.h"
#include "symbol.h"
#include "object.h"
#include "array.h"



array* create_array(int length) {
    struct array* out;
    safe_malloc(out, sizeof(array));
    out->length = length;
    safe_malloc(out->items, length * sizeof(void*));
    return out;
}

array* create_array_with_items(int length, ...) {
    va_list args;
    va_start(args, length);
    struct array* out;
    safe_malloc(out, sizeof(array));
    out->length = length;
    safe_malloc(out->items, length * sizeof(void*));
    for (int i = 0; i < length; i++) {
        out->items[i] = va_arg(args, void*);
    }
    va_end(args);
    return out;
}

array* array_push(array* arr, any* item) {
    any** new_items;
    safe_malloc(new_items, (arr->length + 1) * sizeof(any));
    for (int i = 0; i < arr->length; i++) {
        new_items[i] = arr->items[i];
    }
    new_items[arr->length] = item;
    arr->length++;
    arr->items = new_items;
    return arr;
}

array* get_keys(object* obj) {
    array* out = create_array(num_keys(obj));
    int index = 0;
    struct property* prop;
    for (int i = 0; i < 16; i++) {
        prop = obj->data[i];
        while (prop != NULL) {
            out->items[index] = prop->key;
            index++;
            prop = prop->next;
        }
    }
    return out;
}

array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}


char* js_typeof_any(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
            return "undefined";
        case NULL_TAG:
        case OBJECT_TAG:
        case ARRAY_TAG:
            return "object";
        case BOOLEAN_TAG:
            return "boolean";
        default:
            return "symbol";
    }
}


any* object_to_primitive(object* value) {
    any* out = NULL;
    if (has_obj(value, Symbol_toPrimitive)) {
        out = (any*)(call_method(value, Symbol_toPrimitive, "default"));
    } else if (has_obj(value, "valueOf")) {
        out = (any*)(call_method(value, "valueOf"));
    } else if (has_obj(value, "toString")) {
        out = (any*)call_method(value, "toString");
    }
    if (out == NULL || out->type == OBJECT_TAG || out->type == ARRAY_TAG) {
        safe_malloc(out, sizeof(any));
        out->type = NUMBER_TAG;
        out->number = NaN;
    }
    return out;
}

char* array_to_string(array* value) {
    char* out = "";
    for (int i = 0; i < value->length; i++) {
        out = stradd(out, cast_any_to_string(value->items[i]));
    }
}

double parse_number(char* value) {
    int length = strlen(value);
    int i = 0;
    double out = 0;
    for (; i < length; i++) {
        char x = value[i];
        if (x != '\n' || x != ' ') {
            break;
        }
    }
    if (i == length) {
        return 0;
    }
    char x = value[i];
    if (x == '+') {
        i++;
    } else if (x == '-') {
        i++;
        out = -out;
    }
    if (strcmp(value + i, "Infinity")) {
        if (signbit(out)) {
            return -INFINITY;
        } else {
            return INFINITY;
        }
    }
    for (; i < length; i++) {
        char x = value[i];
        if (x == '.') {
            for (int j = 1; j < length - i; j++) {
                char x = value[i + j];
                if (isdigit(x)) {
                    out += x / pow(10, j);
                } else {
                    return NaN;
                }
            }
            return out;
        } else if (isdigit(x)) {
            out = out * 10 + x;
        } else {
            return NaN;
        }
    }
    return out;    
}

double cast_any_to_number(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
            return NaN;
        case NULL_TAG:
            return 0;
        case BOOLEAN_TAG:
            return value->boolean;
        case STRING_TAG:
            return parse_number(value->string);
        case SYMBOL_TAG:
            return NaN;
        case OBJECT_TAG:
            return cast_any_to_number(object_to_primitive(value->object));
        default:
            return parse_number(array_to_string(value->array));
    }
}

const char* BASE_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

char* number_to_string(double value, int base) {
    if (isnan(value)) {
        return "NaN";
    } else if (isinf(value)) {
        return value > 0 ? "Infinity" : "-Infinity";
    }
    bool sign = value < 0;
    value = fabs(value);
    if (value > 1e21 || value < 1e-6) {
        double mag = ceil(log(value)/log(10));
        char* result = number_to_string(value / mag, base);
        if (sign) {
            result = strcat("-", result);
        }
        result = strcat(result, sign ? "-" : "+");
        result = strcat(result, number_to_string(mag, base));
        return result;
    }
    long long whole = fmod(value, 1);
    double frac = value - whole;
    char* out;
    safe_malloc(out, 30);
    int i;
    for (i = 0; i < 30 && whole > 0; i++) {
        out[i] = BASE_CHARS[whole % base];
        whole /= base;
    }
    if (frac != 0) {
        out[i++] = '.';
        frac *= base;
        for (; i < 30 && frac > 0; i++) {
            out[i] = BASE_CHARS[(int)fmod(frac, 1)];
            frac *= base;
        }
    }
    out[i] = '\0';
    return out;
}

char* cast_any_to_string(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
            return "undefined";
        case NULL_TAG:
            return "null";
        case BOOLEAN_TAG:
            return value->boolean ? "true" : "false";
        case NUMBER_TAG:
            return number_to_string(value->number, 10);
        case SYMBOL_TAG:
            return "Symbol";
        case OBJECT_TAG:
            return cast_any_to_string(object_to_primitive(value->object));
        default:
            return array_to_string(value->array);
    }
}

bool cast_any_to_boolean(any* value) {
    switch (value->type) {
        case UNDEFINED_TAG:
        case NULL_TAG:
            return false;
        case BOOLEAN_TAG:
            return value->boolean;
        case NUMBER_TAG:
            return value->number != 0 && !isnan(value->number);
        case STRING_TAG:
            return *(value->string) != '\0';
        default:
            return true;
    }
}
