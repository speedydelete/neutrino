
#ifndef Neutrino_globals_console
#define Neutrino_globals_console

#include "../core/object.h"

extern object* js_global_console;

void console_log(char* text);
char* console_input(char* prompt);
void init_console();

#endif
