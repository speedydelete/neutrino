#ifndef NEUTRINO_TYPES_H
#define NEUTRINO_TYPES_H

#include <stdlib.h>
#include <stdbool.h>
#include <stdio.h>
#include <inttypes.h>
#include <math.h>
#include <gc.h>


#define LIST_STRUCT(name, type, data_name) typedef struct name { \
    uint32_t length; \
    type data_name[]; \
} name;

typedef uint64_t symbol;
LIST_STRUCT(bigint, uint32_t, data);

typedef struct getter_setter {
    any* (*getter)();
    void (*setter)(any* value);
} getter_setter;

typedef struct property {
    property* next;
    uint64_t key;
    uint8_t flags;
    any value;
} property;

#define IS_ACCESSOR 

typedef struct object {
    object* prototype;
    property* data[16];
} object;

typedef struct proxy {
    unknown* (*get_prototype_of)(object* target);
    void (*set_prototype_of)(object* target, unknown* proto);
    bool (*is_extensible)(object* target);
    void (*prevent_extensions)(object* target);
    void (*get_own_property_descriptor)(object* target, unknown* key);
    void (*define_property)(object* target, unknown* key, object* descriptor);
    bool (*has)(object* target, unknown* key);
    unknown* (*get)(object* target, unknown* key);
    void (*set)(object* target, unknown* key, unknown* value);
    void (*delete)(object* target, unknown* key);
    array* (*own_keys)(object* target, unknown* key, unknown* value);
    void (*call)(object* target, unknown* this, array* args);
    void (*construct)(object* target, array* args);
} proxy;

typedef struct array {
    uint32_t length;
    any** items;
} array;

LIST_STRUCT(arraybuffer, int8_t, data);
LIST_STRUCT(dataview, int8_t, data);
LIST_STRUCT(int8array, int8_t, data);
LIST_STRUCT(uint8array, uint8_t, data);
LIST_STRUCT(int16array, int16_t, data);
LIST_STRUCT(uint16array, uint16_t, data);
LIST_STRUCT(int32array, int32_t, data);
LIST_STRUCT(uint32array, uint32_t, data);
LIST_STRUCT(bigint64array, uint8_t, data);
LIST_STRUCT(biguint64array, uint8_t, data);
LIST_STRUCT(float32array, float, data);
LIST_STRUCT(float64array, double, data);

typedef double date;
LIST_STRUCT(regexp, uint8_t, data);
LIST_STRUCT(set, any, data);

typedef struct map_item {
    map_item* next;
    any key;
    any value;
} map_item;

typedef map_item[16] map;

typedef struct set_item {
    set_item* next;
    any value;
} set_item;

typedef set_item[16] set;


typedef enum type_tag {
    UNDEFINED_T,
    NULL_T,
    BOOLEAN_T,
    STRING_TAG,
    SYMBOL_TAG,
    BIGINT_TAG,
} type_tag;

typedef struct unknown {
    type_tag type;
    union {
        void* undefined;
        void* null;
        bool boolean;
        double number;
        char* string;
        symbol symbol;
        bigint* bigint;
        object* object;
        any* (*function)();
        function_with_object* function_with_object;
        proxy* proxy;
        array* array;
    };
} unknown;

typedef union any {
    void* undefined;
    void* null;
    bool boolean;
    double number;
    char* string;
    full_string* full_string;
    symbol symbol;
    bigint* bigint;
    object* object;
    any* (*function)();
    proxy* proxy;
    array* array;
    unknown unknown;
} any;


#define NaN ((number)NAN)

#define malloc(size) ({void* x = GC_malloc(size); if (x == NULL) fprintf(stderr, "FatalInternalError: malloc failed"); x;})


#endif
