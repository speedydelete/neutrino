
#ifndef INCLUDE_Comment
#define INCLUDE_Comment


typedef struct Comment {
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
    // Comment
} Comment;

Comment* create_Comment(char* baseURI, char* text);


#endif
