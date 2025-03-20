
#ifndef INCLUDE_Node
#define INCLUDE_Node

#include <stdlib.h>

#include "vector.h"
#include "map.h"

#include "Element.h"
#include "Document.h"


typedef struct NodeList {
    int length;
    vector* vector;
} NodeList;

NodeList* create_NodeList(void);
void free_NodeList(NodeList* list);
Node* NodeList_item(NodeList* list, int index);


typedef enum {
    ELEMENT_NODE = 1,
    ATTRIBUTE_NODE,
    TEXT_NODE,
    CDATA_SECTION_NODE,
    PROCESSING_INSTRUCTION_NODE,
    COMMENT_NODE,
    DOCUMENT_NODE,
    DOCUMENT_TYPE_NODE,
    DOCUMENT_FRAGMENT_NODE,
} NodeType;

typedef struct Node {
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
} Node;

Node* create_Node(Node* node, char* baseURI, char* nodeName, NodeType nodeType, char* nodeValue);
void free_Node(Node* node);

char* Node_get_baseURI(Node* node);
NodeList* Node_get_childNodes(Node* node);
Element* Node_get_parentElement(Node* node);
char* Node_get_textContent(Node* node);

Node* Node_appendChild(Node* node, Node* child);
Node* Node_cloneNode(Node* node, bool deep);
bool Node_contains(Node* node, Node* other);
bool Node_hasChildNodes(Node* node);
Node* Node_insertBefore(Node* node, Node* new_node, Node* reference_node);
bool Node_isDefaultNamespace(Node* node, char* namespace);
bool Node_isEqualNode(Node* node, Node* other);
bool Node_isSameNode(Node* node, Node* other);
Node* Node_removeChild(Node* node, Node* child);
void Node_replaceChild(Node* node, Node* child, Node* new_child);


#endif
