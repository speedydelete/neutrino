
#include <stdlib.h>
#include <string.h>

#include "vector.h"
#include "map.h"

#include "Event.h"
#include "Node.h"
#include "Attr.h"
#include "Element.h"
#include "Text.h"
#include "Comment.h"
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

DocumentType* create_DocumentType(char* baseURI, char* name, char* publicId, char* systemId) {
    DocumentType* out = malloc(sizeof(DocumentType));
    create_Node(out, baseURI, '#doctype', DOCUMENT_TYPE_NODE, strcat(strcat(name, " "), publicId));
    out->name = name;
    out->publicId = publicId;
    out->systemId = systemId;
    return out;
}


typedef struct Document {
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
    struct Document* ownerDocument;
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
    HTMLCollection* embeds;
    Element* firstElementChild;
    void* fontFaceSet;
    HTMLCollection* forms;
    bool fragmentDirective;
    Element* fullscreenElement;
    Element* head;
    bool hidden;
    HTMLCollection* images;
    void* implementation;
    Element* lastElementChild;
    HTMLCollection* links;
    Element* pictureInPictureElement;
    bool pictureInPictureEnabled;
    HTMLCollection* plugins;
    Element* pointerLockElement;
    bool prerendering;
    HTMLCollection* scripts;
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

Attr* Document_createAttribute(Document* document, char* name, char* value) {
    Attr* out = create_Attr(document->baseURI, name, value);
    out->ownerDocument = document;
    return out;
}

Comment* Document_createComment(Document* document, char* data) {
    Comment* out = create_Comment(document->baseURI, data);
    out->ownerDocument = document;
    return out;
}

HTMLElement* Document_createElement(Document* document, char* name) {
    HTMLElement* out = create_HTMLElement(document->baseURI, name);
    out->ownerDocument = document;
    return out;
}

Text* Document_createTextNode(Document* document, char* text) {
    Text* out = create_Text(document->baseURI, text);
    out->ownerDocument = document;
    return out;
}
