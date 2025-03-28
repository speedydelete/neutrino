
#ifndef INCLUDE_Comment
#define INCLUDE_Comment


typedef struct Comment {
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
    // CharacterData
        char* data;
        int length;
        Element* nextElementSibling;
        Element* previousElementSibling;
    // Comment
} Comment;

Comment* create_Comment(char* baseURI, char* text);


#endif
