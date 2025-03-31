#ifndef NEUTRINO_VERSION

#define NEUTRINO_VERSION "0.1.0"

#include <stdbool.h>
#include <stdlib.h>
#include <stdarg.h>
#include <stdio.h>


typedef struct array {
    int length;
    void** items;
} array;

array* create_array(int length);
array* create_array_with_items(int length, ...);
void array_push(array* arr, void* item);


struct property {
    struct property* next;
    char* key;
    bool is_accessor;
    union {
        void* value;
        struct {
            void* (*get)(struct object*);
            void (*set)(struct object*, void*);
        } funcs;
    };
};

struct symbol_property {
    struct symbol_property* next;
    char* key;
    bool is_accessor;
    union {
        void* value;
        struct {
            void* (*get)(struct object*);
            void (*set)(struct object*, void*);
        } funcs;
    };
};

typedef struct object {
    struct object* prototype;
    struct property* data[16];
    struct symbol_property* symbols;
} object;

char hash4(char* str);
object* create_object(object* proto, int length, ...);

void* get_key(object* obj, char* key);
void* get_symbol(object* obj, long key);

void set_key(object* obj, char* key, void* value);
void set_symbol(object* obj, long key, void* value);
void set_accessor(object* obj, char* key, void (*get)(struct object*), void (*set)(struct object*, void*));
void set_symbol_accessor(object* obj, long key, void (*get)(struct object*), void (*set)(struct object*, void*));

bool delete_key(object* obj, char* key);
bool delete_symbol(object* obj, char* key);

bool has_key(object* obj, char* key);
bool has_symbol(object* obj, int key);

int num_keys(object* obj);
array* get_keys(object* obj);


#endif
