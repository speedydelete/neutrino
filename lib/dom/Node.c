
#include <stdlib.h>

#include "vector.h"
#include "map.h"

#include "Event.h"
#include "Element.h"
#include "Document.h"


typedef struct NodeList {
    int length;
    vector* vector;
} NodeList;

NodeList* create_NodeList(void) {
    NodeList* out = malloc(sizeof(NodeList));
    out->vector = create_vector();
    return out;
}

void free_NodeList(NodeList* list) {
    free_vector(list->vector);
    free(list);
}

Node* NodeList_item(NodeList* list, int index) {
    return vector_get(list->vector, index);
}


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
} Node;

Node* create_Node(Node* node, char* baseURI, char* nodeName, NodeType nodeType, char* nodeValue) {
    if (node == NULL) {
        node = malloc(sizeof(Node));
    }
    create_EventTarget(node);
    node->baseURI = baseURI;
    node->childNodes = create_NodeList();
    node->firstChild = NULL;
    node->isConnected = false;
    node->lastChild = NULL;
    node->nextSibling = NULL;
    node->nodeName = nodeName;
    node->nodeValue = nodeValue;
    node->ownerDocument = NULL;
    node->parentNode = NULL;
    node->parentElement = NULL;
    node->previousSibling = NULL;
    return node;
}

void free_Node(Node* node) {
    free_NodeList(node->childNodes);
    free(node);
}

void free_Node_and_children(Node* node) {
    Node* child = node->firstChild;
    while (child != NULL) {
        free_Node(child);
        child = child->nextSibling;
    }
    free_vector(node->childNodes->vector);
    free(node);
}

Node* Node_appendChild(Node* node, Node* child) {
    node->lastChild = child;
    child->parentNode = node;
    vector_append(node->childNodes->vector, child);
    child->previousSibling = vector_get(node->childNodes->vector, node->childNodes->length);
    node->lastChild = child;
    if (node->childNodes->length == 0) {
        node->firstChild = child;
    }
    return node;
}

Node* Node_cloneNode(Node* node, bool deep) {
    Node* out = malloc(sizeof(Node));
    out->baseURI = node->baseURI;
    if (deep) {
        out->childNodes = create_NodeList();
        out->childNodes->length = node->childNodes->length;
        for (int i = 0; i < out->childNodes->length; i++) {
            vector_append(out->childNodes, Node_cloneNode(vector_get(node->childNodes, i), true));
        }
    } else {
        out->childNodes = node->childNodes;
        out->firstChild = node->firstChild;
        out->lastChild = node->lastChild;
    }
    out->isConnected = node->isConnected;
    out->nodeName = node->nodeName;
    out->nodeValue = node->nodeValue;
    out->textContent = node->textContent;
    return out;
}

bool Node_contains(Node* node, Node* other) {
    return vector_index(node->childNodes->vector, other) != NULL;
}

bool Node_hasChildNodes(Node* node) {
    return node->childNodes->length != 0;
}

Node* Node_insertBefore(Node* node, Node* new_node, Node* reference_node) {
    Node* parent = node;
    node = node->firstChild;
    Node* prev_node = NULL;
    int i = 0;
    while (node != NULL) {
        if (node == reference_node) {
            parent->childNodes->length++;
            parent->childNodes;
            new_node->previousSibling = prev_node;
            new_node->nextSibling = node->nextSibling;
            new_node->parentNode = parent;
        }
        prev_node = node;
        node = node->nextSibling;
        i++;
    }
    return new_node;
}

bool Node_isDefaultNamespace(Node* node, char* namespace) {
    return strcmp(namespace, "") == 0;
}

bool Node_isEqualNode(Node* node, Node* other) {
    return node->nodeType == other->nodeType && strcmp(node->nodeName, other->nodeName) == 0 && strcmp(node->baseURI, other->baseURI) == 0 && strcmp(node->nodeValue, other->nodeValue) == 0;
}

bool Node_isSameNode(Node* node, Node* other) {
    return node == other;
}

Node* Node_removeChild(Node* node, Node* child) {
    vector_remove(node->childNodes->vector, child);
    child->parentNode = NULL;
    if (node->firstChild == child) {
        node->firstChild = child->nextSibling;
    }
    if (node->lastChild == child) {
        node->lastChild = child->previousSibling;
    }
    node->childNodes->length--;
    return node;
}

void Node_replaceChild(Node* node, Node* child, Node* new_child) {
    vector* children = node->childNodes;
    while (children != NULL) {
        if (children->value == child) {
            children->value = new_child;
            return;
        }
        children = children->next;
    }
}
