
#ifndef NEUTRINO_GLOBALS_CONSOLE
#define NEUTRINO_GLOBALS_CONSOLE

#include <stdio.h>
#include "../core/object.h"

extern object* js_global_console;

void console_log(char* text);
char* console_input(char* prompt);
void init_console(void);

#endif
