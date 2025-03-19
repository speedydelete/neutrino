
#include "CharacterData.h"


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

Text* create_Text(char* baseURI, char* text) {
    Text* out = malloc(sizeof(Text));
    create_CharacterData(out, baseURI, '#text', TEXT_NODE, text);
    out->assignedSlot = NULL;
    return out;
}
