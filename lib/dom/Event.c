
#define _POSIX_C_SOURCE 1999309L
#include <stdlib.h>
#include <stdbool.h>
#include <time.h>

#include "map.h"


typedef enum EventPhase {
    NONE,
    CAPTURING_PHASE,
    AT_TARGET,
    BUBBLING_PHASE,
} EventPhase;

typedef struct Event {
    // Event
    bool bubbles;
    bool cancelable;
    bool composed;
    struct EventTarget* currentTarget;
    bool defaultPrevented;
    EventPhase eventPhase;
    bool isTrusted;
    struct EventTarget* target;
    double timeStamp;
    char* type;
    bool _propagationStopped;
    bool _immediatePropagationStopped;
} Event;

Event* create_Event(Event* out, char* type) {
    if (out == NULL) {
        out = malloc(sizeof(Event));
    }
    out->bubbles = true;
    out->cancelable = true;
    out->composed = false;
    out->currentTarget = NULL;
    out->defaultPrevented = false;
    out->eventPhase = NONE;
    out->isTrusted = true;
    struct timespec ts;
    clock_gettime(CLOCK_REALTIME, &ts);
    out->timeStamp = ts.tv_sec * 1000.0 + ts.tv_nsec / 1000000.0;
    out->_propagationStopped = false;
    out->_immediatePropagationStopped = false;
}

void Event_preventDefault(Event* event) {
    if (event->cancelable) {
        event->defaultPrevented = true;
    }
}

void Event_stopPropagation(Event* event) {
    event->_propagationStopped = true;
}

void Event_stopImmediatePropagation(Event* event) {
    event->_immediatePropagationStopped = true;
}


typedef struct EventTarget {
    // EventTarget
    map* _listeners;
    struct EventTarget* _parent;
} EventTarget;

EventTarget* create_EventTarget(EventTarget* out) {
    if (out == NULL) {
        out = malloc(sizeof(EventTarget));
    }
    out->_listeners = create_map();
    return out;
}

void free_EventTarget(EventTarget* target) {
    free_map(target->_listeners);
}

void EventTarget_addEventListener(EventTarget* target, char* type, void(*func)(Event)) {
    map_set_no_replace(target->_listeners, type, func);
}

void EventTarget_removeEventListener(EventTarget* target, char* type, void(*func)(Event)) {
    target->_listeners = map_delete_pair(target->_listeners, type, func);
}

void EventTarget_dispatchEvent(EventTarget* target, Event* event) {
    event->target = target;
    event->eventPhase = AT_TARGET;
    map* listeners = target->_listeners;
    while (listeners != NULL) {
        if (strcmp(listeners->key, event->type) == 0) {
            (*(void (*)(Event*))(listeners->value))(event);
        }
        listeners = listeners->next;
    }
    if (event->bubbles) {
        event->eventPhase = BUBBLING_PHASE;
        target = target->_parent;
        while (event != NULL) {
            listeners = target->_listeners;
            while (listeners != NULL) {
                if (strcmp(listeners->key, event->type) == 0) {
                    (*(void (*)(Event*))(listeners->value))(event);
                }
                listeners = listeners->next;
            }
            target = target->_parent;
        }
    }
}


typedef struct CustomEvent {
    // Event
    bool bubbles;
    bool cancelable;
    bool composed;
    struct EventTarget* currentTarget;
    bool defaultPrevented;
    EventPhase eventPhase;
    bool isTrusted;
    struct EventTarget* target;
    double timeStamp;
    char* type;
    bool _propagationStopped;
    bool _immediatePropagationStopped;
    // CustomEvent
    char* detail;
} CustomEvent;

CustomEvent* create_CustomEvent(char* type, char* detail) {
    CustomEvent* out = malloc(sizeof(CustomEvent));
    create_Event(out, type);
    out->detail = detail;
    return out;
}
