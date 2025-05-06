
#include "../core/object.h"
#include "console.h"

object* js_global_console;

void console_log(object* this, char* text) {
    printf("%s\n", text);
}

char* console_input(object* this, char* prompt) {
    printf("%s", prompt);
    char next;
    int length = 0;
    char* out = malloc(length + 1);
    while (true) {
        next = getchar();
        if (next == '\n') {
            break;
        }
        out = realloc(out, length + 1);
        out[length] = next;
        length++;
    }
    out[length] = '\0';
    return out;
}

void init_console() {
    js_global_console = create_object(NULL, 2, "log", console_log, "input", console_input);
}
