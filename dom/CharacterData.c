
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

#include "Event.h"
#include "Node.h"
#include "Element.h"
#include "Document.h"


typedef struct CharacterData {
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
} CharacterData;

CharacterData* create_CharacterData(CharacterData* out, char* baseURI, char* nodeName, NodeType nodeType, char* data) {
    create_Node(out, baseURI, nodeName, nodeType, data);
    out->length = strlen(data);
    out->data = malloc(out->length);
    strcpy(out->data, data);
    return out;
}

void CharacterData_appendData(CharacterData* data, char* new_data) {
    data->data = strcat(data->data, new_data);
    data->length += strlen(new_data);
}

void CharacterData_deleteData(CharacterData* data, int offset, int count) {
    char* str = malloc(data->length - count);
    strncpy(str, data->data, offset);
    strcpy(str, data->data + offset + count);
    data->data = str;
    data->length -= count;
}

void CharacterData_insertData(CharacterData* data, int offset, char* new_data) {
    int count = strlen(new_data);
    char* str = malloc(data->length + count);
    strncpy(str, data->data, offset);
    strncpy(str + offset, new_data, count);
    strcpy(str + offset + count, data->data + offset);
    data->data = str;
    data->length += count;
}

void CharacterData_remove(CharacterData* data) {
    Node_removeChild(data->parentNode, data);
}

void CharacterData_replaceData(CharacterData* data, int offset, int count, char* new_data) {
    char* str = malloc(data->length);
    strncpy(str, data->data, offset);
    strncpy(str + offset, new_data, count);
    strcpy(str + offset + count, data->data + offset + count);
    data->data = str;
}

char* CharacterData_substringData(CharacterData* data, int offset, int count) {
    char* out = malloc(count);
    strncpy(out, data->data + offset, count);
    return out;
}
