
#ifndef INCLUDE_map
#define INCLUDE_map

#include <stdlib.h>
#include <string.h>


typedef struct map {
    char* key;
    void* value;
    struct map* next;
} map;

map* create_map(void);
void* map_get(map* map, char* key);
struct map* map_get_entry(map* map, char* key);
void map_set(map* map, char* key, void* value);
void map_set_no_replace(map* map, char* key, void* value);
map* map_delete(map* map, char* key);
map* map_delete_pair(map* map, char* key, void* value);
void print_map(map* map);
void free_map(map* map);


#endif;
