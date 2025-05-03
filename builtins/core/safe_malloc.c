
#include <stdlib.h>
#include <stdio.h>

#include "safe_malloc.h"


#define safe_malloc(ptr, size) \
    do { \
        ptr = malloc(size); \
        if (!ptr) { \
            fprintf(stderr, "InternalError: malloc failed\n"); \
            exit(4); \
        } \
    } while (0);
