
#ifndef Neutrino
#define Neutrino

#include "core/object.h"
#include "core/array.h"
#include "core/types.h"

#include "ops/eq.c"
#include "ops/seq.c"
#include "ops/compare.c"
#include "ops/add.c"
#include "ops/arithmetic.c"
#include "ops/nc.c"

#include "globals/console.h"

object* js_global_neutrino;

void init(int argc, char** argv) {
    array* n_argv = create_array(argc);
    for (int i = 0; i < argc; i++) {
        n_argv->items[i] = argv[i];
    }
    js_global_neutrino = create_object(NULL, 1, "argv", n_argv);
    init_console();
}

void js_globalfunction_print(object* this, char* text) {
    printf("%s", text);
}

#endif
