
#include <stdlib.h>


typedef struct vector {
    void* value;
    struct vector* next;
} vector;

vector* create_vector(void) {
    vector* out = malloc(sizeof(vector));
    out->next = NULL;
    return out;
}

void free_vector(vector* vector) {
    struct vector* prev;
    while (vector != NULL) {
        prev = vector;
        vector = vector->next;
        free(prev);
    }
}

void* vector_get(vector* vector, int index) {
    while (index > 0) {
        vector = vector->next;
        if (vector == NULL) {
            return NULL;
        }
        index--;
    }
    return vector->value;
}

void vector_set(vector* vector, int index, void* value) {
    while (index > 0) {
        vector = vector->next;
        if (vector == NULL) {
            return;
        }
        index--;
    }
    vector->value = value;
}

void vector_append(vector* vector, void* value) {
    while (vector->next != NULL) {
        vector = vector->next;
    }
    vector->next = create_vector();
    vector->next->value = value;
}

void vector_insert(vector* vector, int index, void* value) {
    for (; index > 0; index--) {
        vector = vector->next;
        if (vector == NULL) {
            return;
        }
    }
    struct vector* item = create_vector();
    item->value = value;
    item->next = vector->next;
    vector->next = item;
}

int vector_index(vector* vector, void* value) {
    for (int i = 0; vector != NULL; i++) {
        if (vector->value == value) {
            return i;
        }
        vector = vector->next;
    }
    return NULL;
}

void vector_remove(vector* vector, void* value) {
    struct vector* prev = vector;
    vector = vector->next;
    while (vector != NULL) {
        if (vector->value = value) {
            prev->next = vector->next;
            return;
        }
        vector = vector->next;
    }
}
