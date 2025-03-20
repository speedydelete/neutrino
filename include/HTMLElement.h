
#ifndef INCLUDE_HTMLElement
#define INCLUDE_HTMLElement

#include <stdlib.h>
#include <string.h>

#include "map.h"

#include "Event.h"
#include "Node.h"
#include "Attr.h"
#include "Document.h"


typedef struct HTMLElement {
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

HTMLElement* create_HTMLElement(char* baseURI, char* name);


#endif
