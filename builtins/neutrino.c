
#include "core/object.h"
#include "core/array.h"
#include "core/types.h"

#include "ops/eq.c"
#include "ops/seq.c"


int main() {
    printf("%d\n", seq((void**)0, (void*)0));
}
