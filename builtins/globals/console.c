
#include "../core/object.h"

object* js_global_console;

void init_console() {
    js_global_console = create_object(NULL, 0, "log", printf);
}
