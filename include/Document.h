
#ifndef INCLUDE_Document
#define INCLUDE_Document

#include <stdlib.h>

#include "vector.h"
#include "map.h"

#include "Event.h"
#include "Node.h"
#include "Element.h"


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
    // Document
        // accessor Element* activeElement;
        // not implemented void* adoptedStyleSheets;
        // accessor Element* body;
        // accessor char* characterSet;
        // accessor int childElementCount;
        // accessor Element* children;
        // accessor char* compatMode;
        char* contentType;
        // accessor Element* currentScript;
        // accessor DocumentType* doctype;
        // accessor Element* documentElement;
        // accessor char* documentURI;
        // accessor HTMLCollection* embeds;
        // accessor Element* firstElementChild;
        // not implemented void* fontFaceSet;
        // accessor HTMLCollection* forms;
        // accessor bool fragmentDirective;
        // accessor Element* fullscreenElement;
        // accessor Element* head;
        // not implemented bool hidden;
        // accessor HTMLCollection* images;
        // not implemented void* implementation;
        // accessor Element* lastElementChild;
        // accessor HTMLCollection* links;
        // not implemented Elemnet* pictureInPictureElement;
        // not implemented bool pictureInPictureEnabled;
        // accessor HTMLCollection* plugins;
        // not implemented Element* pointerLockElement;
        // not implemented bool prerendering;
        // accessor HTMLCollection* scripts;
        // not implemented Element* scrollingElement;
        // not implemented void* styleSheets;
        // not implemented void* timeline;
        // not implemented char* visibilityState;
        // not implemented char* cookie;
        // not implemented void* defaultView;
        // not implemented char* designMode;
        // not implemented char* dir;
        // not implemented bool fullscreenEnabled;
        // not implemented char* lastModified;
        // not implemented void* location;
        // accessor char* readyState;
        char* referrer;
        // accessor char* title;
        char* URL;
} Document;

Attr* Document_createAttribute(Document* document, char* name, char* value);
Comment* Document_createComment(Document* document, char* data);
HTMLElement* Document_createElement(Document* document, char* name);
Text* Document_createTextNode(Document* document, char* text);


#endif
