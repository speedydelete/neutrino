
#ifndef INCLUDE_Document
#define INCLUDE_Document

#include <stdlib.h>

#include "vector.h"
#include "map.h"

#include "Event.h"
#include "Node.h"
#include "Element.h"
#include "HTMLElement.h"


typedef struct DocumentType {
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
    Element* parentElement;
    struct Node* previousSibling;
    char* textContent;
    // DocumentType
    char* name;
    char* publicId;
    char* systemId;
} DocumentType;

DocumentType* create_DocumentType(char* baseURI, char* name, char* publicId, char* systemId);


typedef struct Document {
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
    // Document
        Element* activeElement;
        void* adoptedStyleSheets;
        Element* body;
        char* characterSet;
        int childElementCount;
        Element* children;
        char* compatMode;
        char* contentType;
        Element* currentScript;
        DocumentType* doctype;
        Element* documentElement;
        char* documentURI;
        // HTMLCollection* embeds;
        Element* firstElementChild;
        void* fontFaceSet;
        // HTMLCollection* forms;
        bool fragmentDirective;
        Element* fullscreenElement;
        Element* head;
        bool hidden;
        // HTMLCollection* images;
        void* implementation;
        Element* lastElementChild;
        // HTMLCollection* links;
        Element* pictureInPictureElement;
        bool pictureInPictureEnabled;
        // HTMLCollection* plugins;
        Element* pointerLockElement;
        bool prerendering;
        // HTMLCollection* scripts;
        Element* scrollingElement;
        void* styleSheets;
        void* timeline;
        char* visibilityState;
        char* cookie;
        void* defaultView;
        char* designMode;
        char* dir;
        bool fullscreenEnabled;
        char* lastModified;
        void* location;
        char* readyState;
        char* referrer;
        char* title;
        char* URL;
} Document;

Attr* Document_createAttribute(Document* document, char* name, char* value);
Comment* Document_createComment(Document* document, char* data);
HTMLElement* Document_createElement(Document* document, char* name);
Text* Document_createTextNode(Document* document, char* text);


#endif
