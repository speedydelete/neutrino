
#ifndef Neutrino_globals_console
#define Neutrino_globals_console

#include "../core/object.h"
#include "console.h"

extern object* js_global_console;

void console_log(object* this, char* text);
void init_console();

#endif
