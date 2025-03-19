
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

NamedNodeMap* create_NamedNodeMap(void) {
    NamedNodeMap* out = malloc(sizeof(NamedNodeMap));
    out->length = 0;
    out->map = create_map();
    return out;
}

void free_NamedModeMap(NamedNodeMap* map) {
    free_map(map->map);
    free(map);
}

Attr* NamedNodeMap_getNamedItem(NamedNodeMap* map, char* item) {
    return (Attr*)map_get(map->map, item);
}

void NamedNodeMap_setNamedItem(NamedNodeMap* map, Attr* attr) {
    map_set(map->map, attr->name, attr);
}

void NamedNodeMap_removeNamedItem(NamedNodeMap* map, char* item) {
    map_delete(map->map, item);
}


typedef struct HTMLCollection {
    vector* vector;
    int length;
} HTMLCollection;

HTMLCollection* create_HTMLCollection(void) {
    HTMLCollection* out = malloc(sizeof(HTMLCollection));
    out->length = 0;
    out->vector = create_vector();
    return out;
}

void free_HTMLCollection(HTMLCollection* collection) {
    free_vector(collection->vector);
    free(collection);
}

struct Element* HTMLCollection_item(HTMLCollection* collection, int i) {
    return vector_get(collection->vector, i);
}


typedef struct Element {
    // EventTarget
    map* listeners;
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
    struct Element* parentElement;
    struct Node* previousSibling;
    char* textContent;
    // Element
    struct Element* assignedSlot;
    NamedNodeMap* attributes;
    int childElementCount;
    HTMLCollection* children;
    DOMTokenList* classList;
    char* className;
    int clientHeight;
    int clientLeft;
    int clientTop;
    int clientWidth;
    int currentCSSZoom;
    struct Element* firstElementChild;
    char* id;
    char* innerHTML;
    struct Element* lastElementChild;
    char* localName;
    char* namespaceURI;
    struct Element* nextElementSibling;
    char* outerHTML;
    DOMTokenList* part;
    char* prefix;
    struct Element* previousElementSibling;
    int scrollHeight;
    int scrollLeft;
    int scrollTop;
    int scrollWidth;
    void* shadowRoot;
    char* slot;
    char* tagName;
} Element;


