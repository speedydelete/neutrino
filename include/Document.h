
#ifndef INCLUDE_Document
#define INCLUDE_Document

#include <stdlib.h>

#include "vector.h"
#include "map.h"

#include "Event.h"
#include "Node.h"
#include "Element.h"
#include "Comment.h"
#include "Attr.h"
#include "Text.h"
#include "HTMLElement.h"


typedef struct DocumentType {
    // EventTarget
    map* listeners;
    struct EventTarget* _parent;
    // Node
    char* baseURI;
    struct NodeList* childNodes;
    struct Node* firstChild;
    bool isConnected;
    struct Node* lastChild;
    struct Node* nextSibling;
    char* nodeName;
    NodeType nodeType;
    char* nodeValue;
    struct Document* ownerDocument;
    struct Node* parentNode;
    struct Element* parentElement;
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
        struct Document* ownerDocument;
        struct Node* parentNode;
        struct Element* parentElement;
        struct Node* previousSibling;
        char* textContent;
    // Document
        struct Element* activeElement;
        void* adoptedStyleSheets;
        struct Element* body;
        char* characterSet;
        int childElementCount;
        struct Element* children;
        char* compatMode;
        char* contentType;
        struct Element* currentScript;
        DocumentType* doctype;
        struct Element* documentElement;
        char* documentURI;
        // HTMLCollection* embeds;
        struct Element* firstElementChild;
        void* fontFaceSet;
        // HTMLCollection* forms;
        bool fragmentDirective;
        struct Element* fullscreenElement;
        struct Element* head;
        bool hidden;
        // HTMLCollection* images;
        void* implementation;
        struct Element* lastElementChild;
        // HTMLCollection* links;
        struct Element* pictureInPictureElement;
        bool pictureInPictureEnabled;
        // HTMLCollection* plugins;
        struct Element* pointerLockElement;
        bool prerendering;
        // HTMLCollection* scripts;
        struct Element* scrollingElement;
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
struct HTMLElement* Document_createElement(Document* document, char* name);
Text* Document_createTextNode(Document* document, char* text);


#endif
