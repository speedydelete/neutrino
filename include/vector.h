
#ifndef INCLUDE_VECTOR_H
#define INCLUDE_VECTOR_H


typedef struct vector {
    void* value;
    struct vector* next;
} vector;

vector* create_vector(void);
void free_vector(vector* vector);
void* vector_get(vector* vector, int index);
void vector_set(vector* vector, int index, void* value);
void vector_append(vector* vector, void* value);
void vector_insert(vector* vector, int index, void* value);
int vector_index(vector* vector, void* value);
void vector_remove(vector* vector, void* value);


#endif
