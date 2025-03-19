
#include <stdlib.h>
#include <string.h>


typedef struct map {
    char* key;
    void* value;
    struct map* next;
} map;

map* create_map(void) {
    map* out = malloc(sizeof(map));
    out->key = NULL;
    out->next = NULL;
    return out;
}

void* map_get(map* map, char* key) {
    while (map != NULL) {
        if (strcmp(map->key, key) == 0) {
            return map->value;
        }
        map = map->next;
    }
    return NULL;
}

struct map* map_get_entry(map* map, char* key) {
    while (map != NULL) {
        if (strcmp(map->key, key) == 0) {
            return map;
        }
        map = map->next;
    }
    return NULL;
}

void map_set(map* map, char* key, void* value) {
    if (map->key == NULL) {
        map->key = strdup(key);
        map->value = value;
    } else if (strcmp(map->key, key) == 0) {
        map->value = value;
    } else {
        while (map->next != NULL) {
            if (strcmp(key, map->key) == 0) {
                map->value = value;
                return;
            }
        }
        struct map* new_map = malloc(sizeof(struct map));
        new_map->key = strdup(key);
        new_map->value = value;
        map->next = new_map;
    }
}

void map_set_no_replace(map* map, char* key, void* value) {
    if (map->key == NULL) {
        map->key = strdup(key);
        map->value = value;
    } else {
        while (map->next != NULL) {
            map = map->next;
        }
        struct map* new_map = malloc(sizeof(struct map));
        new_map->key = strdup(key);
        new_map->value = value;
        map->next = new_map;
    }
}

map* map_delete(map* map, char* key) {
    if (strcmp(map->key, key) == 0) {
        return map->next;
    } else {
        while (map->next != NULL) {
            if (strcmp(map->next->key, key) == 0) {
                map->next = map->next->next;
            }
            map = map->next;
        }
        return map;
    }
}

map* map_delete_pair(map* map, char* key, void* value) {
    if (strcmp(map->key, key) == 0 && value == map->value) {
        return map->next;
    } else {
        while (map->next != NULL) {
            if (strcmp(map->next->key, key) == 0 && value == map->next->value) {
                map->next = map->next->next;
            }
            map = map->next;
        }
        return map; 
    }
}

void print_map(map* map) {
    if (map->key == NULL) {
        printf("[empty]");
        return;
    }
    while (map != NULL) {
        printf("%s: %i", map->key, *(int *)map->value);
        map = map->next;
    }
}

void free_map(map* map) {
    struct map* prev;
    while (map->next != NULL) {
        prev = map;
        map = map->next;
        free(prev);
    }
    free(map);
}
