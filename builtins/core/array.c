
#include <ctype.h>
#include <stdarg.h>
#include <string.h>
#include "util.h"
#include "types.h"


char* array_toString(array* this) {
    char* out = "";
    for (int i = 0; i < this->length; i++) {
        out = stradd(stradd(out, any_to_string(this->items[i])), ",");
    }
    return out;
}

array* array_valueOf(array* this) {
    return this;
}

array* create_array(int length) {
    array* out = safe_malloc(sizeof(array));
    out->length = length;
    out->items = safe_malloc(sizeof(void*) * length);
    return out;
}

array* create_array_with_items(int length, ...) {
    va_list args;
    va_start(args, length);
    array* out = safe_malloc(sizeof(array));
    out->length = length;
    out->items = safe_malloc(sizeof(void*) * length);
    for (int i = 0; i < length; i++) {
        out->items[i] = va_arg(args, void*);
    }
    va_end(args);
    return out;
}


array* array_at(array* this, double index) {
    if (index < 0) {
        index += this->length;
    }
    if (index > this->length) {
        return NULL;
    }
    return this->items[(int)index];
}

array* array_copyWithin(array* this, double target, double start, double end) {
    int length = start - end;
    for (int i = 0; i < length; i++) {
        this->items[(int)target + i] = this->items[(int)start + i];
    }
    return this;
}

bool array_every(array* this, bool (*func)(void* item)) {
    for (int i = 0; i < this->length; i++) {
        if (!func(this->items[i])) {
            return false;
        }
    }
    return true;
}

array* array_fill(array* this, void* value) {
    for (int i = 0; i < this->length; i++) {
        this->items[i] = value;
    }
    return this;
}

array* array_filter(array* this, bool (*func)(void* item)) {
    array* out = create_array(0);
    for (int i = 0; i < this->length; i++) {
        void* item = this->items[i];
        if (func(item)) {
            array_push(out, item);
        }
    }
    return out;
}

any* array_find(array* this, bool (*func)(void* item)) {
    for (int i = 0; i < this->length; i++) {
        any* item = this->items[i];
        if (func(item)) {
            return item;
        }
    }
    return create_any_from_undefined(NULL);
}

any* array_findIndex(array* this, bool (*func)(void* item)) {
    for (int i = 0; i < this->length; i++) {
        any* item = this->items[i];
        if (func(item)) {
            return create_any_from_number(i);
        }
    }
    return create_any_from_undefined(NULL);
}

any* array_findLast(array* this, bool (*func)(void* item)) {
    for (int i = this->length - 1; i >= 0; i--) {
        any* item = this->items[i];
        if (func(item)) {
            return item;
        }
    }
    return create_any_from_undefined(NULL);
}

any* array_findLastIndex(array* this, bool (*func)(void* item)) {
    for (int i = this->length - 1; i >= 0; i--) {
        any* item = this->items[i];
        if (func(item)) {
            return create_any_from_number(i);
        }
    }
    return create_any_from_undefined(NULL);
}

array* array_flat(array* this, int depth) {
    array* out = create_array(0);
    for (int i = 0; i < this->length; i++) {
        any* item = this->items[i];
        if (item->type == ARRAY_TAG && depth > 0) {
            array* arr = array_flat(item->array, depth - 1);
            for (int i = 0; i < arr->length; i++) {
                array_push(out, arr->items[i]);
            }
        } else {
            array_push(out, item);
        }
    }
    return out;
}

array* array_flatMap(array* this, any* (*func)(void* item)) {
    array* out = create_array(0);
    for (int i = 0; i < this->length; i++) {
        any* item = func(this->items[i]);
        if (item->type == ARRAY_TAG) {
            for (int i = 0; i < item->array->length; i++) {
                array_push(out, item->array->items[i]);
            }
        } else {
            array_push(out, item);
        }
    }
    return out;
}

void array_forEach(array* this, bool (*func)(void* item)) {
    for (int i = 0; i < this->length; i++) {
        func(this->items[i]);
    }
}

bool array_includes(array* this, void* item) {
    for (int i = 0; i < this->length; i++) {
        if (same_value_zero(this->items[i], item)) {
            return true;
        }
    }
    return false;
}

any* array_indexOf(array* this, any* item) {
    for (int i = 0; i < this->length; i++) {
        if (strict_equal(this->items[i], item)) {
            return create_any_from_number(i);
        }
    }
    return create_any_from_undefined(NULL);
}

char* array_join(array* this, char* sep) {
    char* out = "";
    for (int i = 0; i < this->length; i++) {
        out = stradd(stradd(out, any_to_string(this->items[i])), sep);
    }
    return out;
}

any* array_lastIndexOf(array* this, any* item) {
    for (int i = this->length; i >= 0; i--) {
        if (strict_equal(this->items[i], item)) {
            return create_any_from_number(i);
        }
    }
    return create_any_from_undefined(NULL);
}

array* array_map(array* this, void* (*func)(void* item)) {
    array* out = create_array(this->length);
    for (int i = 0; i < this->length; i++) {
        array_push(out, func(this->items[i]));
    }
    return out;
}

void* array_pop(array* this) {
    void* out = this->items[this->length - 1];
    void** new_items = safe_malloc(sizeof(void*) * (this->length - 1));
    for (int i = 0; i < this->length - 2; i++) {
        new_items[i] = this->items[i];
    }
    this->length--;
    this->items = new_items;
    return out;
}

array* array_push(array* this, any* item) {
    void** new_items = safe_malloc(sizeof(void*) * (this->length + 1));
    for (int i = 0; i < this->length; i++) {
        new_items[i] = this->items[i];
    }
    new_items[this->length] = item;
    this->length++;
    this->items = new_items;
    return this;
}

any* array_reduce(array* this, any* (*func)(void* a, void* b)) {
    any* out = this->items[0];
    for (int i = 1; i < this->length; i++) {
        out = func(out, this->items[i]);
    }
    return out;
}

any* array_reduceRight(array* this, any* (*func)(void* a, void* b)) {
    any* out = this->items[this->length - 1];
    for (int i = this->length - 2; i >= 0; i--) {
        out = func(out, this->items[i]);
    }
    return out;
}

array* array_reverse(array* this) {
    for (int i = 0; i < this->length / 2; i++) {
        int j = this->length - 1 - i;
        void* temp = this->items[i];
        this->items[i] = this->items[j];
        this->items[j] = temp;
    }
    return this;
}

void* array_shift(array* this) {
    void* out = this->items[0];
    void** new_items = safe_malloc(sizeof(void*) * (this->length - 1));
    for (int i = 1; i < this->length - 1; i++) {
        new_items[i] = this->items[i];
    }
    this->length--;
    this->items = new_items;
    return out;
}

array* array_slice(array* this, double start, double end) {
    if (start < 0) {
        start += this->length;
    }
    if (end < 0) {
        end += this->length;
    }
    array* out = create_array(end - start);
    for (int i = 0; i < end - start; i++) {
        out->items[i] = this->items[(int)start + i];
    }
    return out;
}

bool array_some(array* this, bool (*func)(void* item)) {
    for (int i = 0; i < this->length; i++) {
        if (func(this->items[i])) {
            return true;
        }
    }
    return false;
}


void* get_array_string(array* this, char* key) {
    if (isdigit(key[0])) {
        double index = atoi(key);
        if (index > this->length) {
            return NULL;
        } else {
            return this->items[(int)index];
        }
    } else if (strcmp(key, "push") == 0) {
        return array_push;
    } else {
        return NULL;
    }
}

void* get_array_symbol(array* this, symbol key) {
    return NULL;
}


array* get_rest_arg_internal(va_list args, int count) {
    array* out = create_array(count);
    for (int i = 0; i < count; i++) {
        out->items[i] = va_arg(args, void*);
    }
    return out;
}
