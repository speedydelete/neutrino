
#include "../core/object.h"
#include "console.h"

object* js_global_console;

void console_log(object* this, char* text) {
    printf("%s\n", text);
}

void init_console() {
    js_global_console = create_object(NULL, 1, "log", console_log);
}
