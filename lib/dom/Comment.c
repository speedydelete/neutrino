
#include "Node.h"
#include "CharacterData.h"
#include "Element.h"
#include "Document.h"


typedef struct Comment {
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
    // Comment
} Comment;

Comment* create_Comment(char* baseURI, char* text) {
    Comment* out = malloc(sizeof(Comment));
    create_CharacterData(out, baseURI, '#comment', COMMENT_NODE, text);
    return out;
}
