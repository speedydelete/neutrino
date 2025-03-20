
#ifndef INCLUDE_Text
#define INCLUDE_Text

#include "Node.h"
#include "CharacterData.h"
#include "Element.h"
#include "Document.h"


typedef struct Text {
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
    // CharacterData
    char* data;
    int length;
    Element* nextElementSibling;
    Element* previousElementSibling;
    // Text
    struct Node* assignedSlot;
} Text;

Text* create_Text(char* baseURI, char* text);


#endif
