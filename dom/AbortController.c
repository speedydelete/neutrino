
#include <stdlib.h>
#include <stdbool.h>


typedef struct AbortSignal {
    // AbortSignal
    bool aborted;
    char* reason;
} AbortSignal;

AbortSignal* create_AbortSignal() {
    AbortSignal* out = malloc(sizeof(AbortSignal));
    out->aborted = false;
    out->reason = NULL;
    return out;
}

AbortSignal* AbortSignal_abort() {
    AbortSignal* out = create_AbortSignal();
    out->aborted = true;
    return out;
}


typedef struct AbortController {
    // AbortController
    AbortSignal* signal;
} AbortController;

AbortController* create_AbortController(void) {
    AbortController* out = malloc(sizeof(AbortController));
    out->signal = create_AbortSignal();
    return out;
}

void AbortController_abort(AbortController* controller, char* reason) {
    controller->signal->aborted = true;
    controller->signal->reason = reason;
}
