
#ifndef INCLUDE_Text
#define INCLUDE_Text

#include "Node.h"
#include "CharacterData.h"
#include "Element.h"
#include "Document.h"


typedef struct Text {
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
    // CharacterData
        char* data;
        // accessor int length;
        // accessor Element* nextElementSibling;
        // accessor Element* previousElementSibling;
    // Text
        // not implemented struct Node* assignedSlot;
} Text;

Text* create_Text(char* baseURI, char* text);


#endif
