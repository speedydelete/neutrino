
#ifndef INCLUDE_ABORT_CONTROLLER_H
#define INCLUDE_ABORT_CONTROLLER_H

#include <stdlib.h>


typedef struct AbortSignal {
    bool aborted;
    char* reason;
} AbortSignal;

AbortSignal* create_AbortSignal(void);
AbortSignal* AbortSignal_abort(void);


typedef struct AbortController {
    AbortSignal* signal;
} AbortController;

AbortController* create_AbortController(void);
void AbortController_abort(AbortController* controller, char* reason);


#endif
