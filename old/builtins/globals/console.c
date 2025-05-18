
#include <stdio.h>
#include "../core/object.h"

object* js_global_console;

void console_log(char* text) {
    printf("%s\n", text);
}

char* console_input(char* prompt) {
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

void init_console(void) {
    js_global_console = create_object(object_prototype, 3,
        "log", console_log,
        "input", console_input,
        "printf", printf
    );
}
