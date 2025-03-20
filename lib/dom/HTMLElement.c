
#include <stdlib.h>
#include <string.h>

#include "map.h"

#include "Event.h"
#include "Node.h"
#include "Attr.h"
#include "Document.h"


typedef struct HTMLElement {
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
    // HTMLElement
    char* accessKey;
    char* accessKeyLabel;
    void* attributeStyleMap;
    char* autocapitalize;
    bool autofocus;
    bool autocorrect;
    char* contenteditable;
    void* dataset;
    char* dir;
    bool draggable;
    void* editContext;
    char* enterKeyHint;
    bool hidden;
    bool inert;
    char* innerText;
    char* inputMode;
    bool isContentEditable;
    char* lang;
    char* nonce;
    double offsetHeight;
    double offsetLeft;
    Element* offsetParent;
    double offsetTop;
    double offsetWidth;
    char* outerText;
    char* popover;
    bool spellcheck;
    void* style;
    long tabIndex;
    char* title;
    bool translate;
    bool writingSuggestions;
} HTMLElement;

HTMLElement* create_HTMLElement(char* baseURI, char* name) {
    HTMLElement* out = malloc(sizeof(HTMLElement));
    int nameLength = strlen(name);
    out->tagName = malloc(nameLength * sizeof(char));
    for (int i = 0; i < nameLength; i++) {
        out->tagName[i] = toupper(name[i]);
    }
    create_Node(out, baseURI, out->tagName, ELEMENT_NODE, "");
    return out;
}
