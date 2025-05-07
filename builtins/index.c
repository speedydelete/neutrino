
#ifndef Neutrino
#define Neutrino

#include "core/boolean.h"
#include "core/string.h"
#include "core/object.h"
#include "core/array.h"
#include "core/types.h"

#include "globals/index.h"


object* js_global_neutrino;
object* js_global_globalThis;

void init(int argc, char** argv) {
    array* n_argv = create_array(argc);
    for (int i = 0; i < argc; i++) {
        n_argv->items[i] = create_any(argv[i]);
    }
    js_global_neutrino = create_object(NULL, 1, "argv", n_argv);
    init_core();
    init_math();
    init_console();
    js_global_globalThis = create_object(NULL, 9,
        "neutrino", js_global_neutrino,
        "undefined", js_global_undefined,
        "Infinity", js_global_Infinity,
        "NaN": js_global_NaN,
        "isNaN": js_global_isNaN,
        "isFinite", js_global_isFinite,
        "parseFloat", js_global_parseFloat,
        "parseInt", js_global_parseInt,
        "Math", js_global_Math,
    );
}

#endif
