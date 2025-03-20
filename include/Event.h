
#ifndef INCLUDE_Event
#define INCLUDE_Event

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

Event* create_Event(char* type);
void Event_preventDefault(Event* event);
void Event_stopPropagation(Event* event);
void Event_stopImmediatePropagation(Event* event);


typedef struct EventTarget {
    // EventTarget
        map* _listeners;
        struct EventTarget* _parent;
} EventTarget;

EventTarget* create_EventTarget(EventTarget* out);
void free_EventTarget(EventTarget* target);
void EventTarget_addEventListener(EventTarget* target, char* type, void(*func)(Event));
void EventTarget_removeEventListener(EventTarget* target, char* type, void(*func)(Event));
void EventTarget_dispatchEvent(EventTarget* target, Event* event);


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

CustomEvent* create_CustomEvent(char* type, char* detail);


#endif
