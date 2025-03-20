
#ifndef INCLUDE_Element
#define INCLUDE_Element

#include <stdlib.h>

#include "map.h"
#include "vector.h"

#include "Event.h"
#include "Node.h"
#include "Attr.h"
#include "Document.h"


typedef struct NamedNodeMap {
    int length;
    map* map;
} NamedNodeMap;

NamedNodeMap* create_NamedNodeMap(void);
void free_NamedModeMap(NamedNodeMap* map);
Attr* NamedNodeMap_getNamedItem(NamedNodeMap* map, char* item);
void NamedNodeMap_setNamedItem(NamedNodeMap* map, Attr* attr);
void NamedNodeMap_removeNamedItem(NamedNodeMap* map, char* item);


typedef struct HTMLCollection {
    vector* vector;
    int length;
} HTMLCollection;

HTMLCollection* create_HTMLCollection(void);
void free_HTMLCollection(HTMLCollection* collection);
struct Element* HTMLCollection_item(HTMLCollection* collection, int i);


typedef struct DOMTokenList {
    void* x;
} DOMTokenList;


typedef struct Element {
    // EventTarget
        map* _listeners;
        EventTarget* _parent;
    // Node
        // accessor char* baseURI;
        // accessor NodeList* childNodes;
        struct Node* firstChild;
        bool isConnected;
        struct Node* lastChild;
        struct Node* nextSibling;
        char* nodeName;
        NodeType nodeType;
        char* nodeValue;
        Document* ownerDocument;
        struct Node* parentNode;
        // accessor Element* parentElement;
        struct Node* previousSibling;
        // accessor char* textContent;
    // Element
        map* _attrs;
        // not_implemented struct Element* assignedSlot;
        // accessor NamedNodeMap* attributes;
        // accessor int childElementCount;
        // accessor HTMLCollection* children;
        // accessor DOMTokenList* classList;
        char* className;
        // accessor int clientHeight;
        // accessor int clientLeft;
        // accessor int clientTop;
        // accessor int clientWidth;
        int currentCSSZoom;
        // accessor struct Element* firstElementChild;
        // accessor char* id;
        // accessor char* innerHTML;
        // accessor struct Element* lastElementChild;
        // not_implemented char* localName;
        // not_implemented char* namespaceURI;
        // accessor struct Element* nextElementSibling;
        // accessor char* outerHTML;
        // not_implemented DOMTokenList* part;
        // not_implemented char* prefix;
        // accessor struct Element* previousElementSibling;
        // accessor int scrollHeight;
        // accessor int scrollLeft;
        // accessor int scrollTop;
        // accessor int scrollWidth;
        // not_implemented void* shadowRoot;
        // not_implemented char* slot;
        // accessor char* tagName;
} Element;


#endif
