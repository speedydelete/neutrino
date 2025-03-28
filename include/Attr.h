
#ifndef INCLUDE_Attr
#define INCLUDE_Attr

#include <stdbool.h>

#include "Node.h"
#include "Event.h"
#include "Element.h"
#include "Document.h"


typedef struct Attr {
    // EventTarget
        map* _listeners;
        EventTarget* _parent;
    // Node
        char* baseURI;
        NodeList* childNodes;
        struct Node* firstChild;
        bool isConnected;
        struct Node* lastChild;
        struct Node* nextSibling;
        char* nodeName;
        NodeType nodeType;
        char* nodeValue;
        Document* ownerDocument;
        struct Node* parentNode;
        Element* parentElement;
        struct Node* previousSibling;
        char* textContent;
    // Attr
        char* localName;
        char* name;
        char* namespaceURI;
        Element* ownerElement;
        char* prefix;
        char* value;
} Attr;

Attr* create_Attr(char* baseURI, char* name, char* value);


#endif
