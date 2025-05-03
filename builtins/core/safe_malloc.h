
#ifndef Neutrino_safe_malloc
#define Neutrino_safe_malloc

#include <stdlib.h>
#include <stdio.h>


#define safe_malloc(ptr, size) \
    do { \
        ptr = malloc(size); \
        if (!ptr) { \
            fprintf(stderr, "InternalError: malloc failed\n"); \
            exit(4); \
        } \
    } while (0);


#endif
