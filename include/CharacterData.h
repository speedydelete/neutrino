
#ifndef INCLUDE_CharacterData
#define INCLUDE_CharacterData

#include <stdlib.h>
#include <stdbool.h>
#include <string.h>

#include "Event.h"
#include "Node.h"


typedef struct CharacterData {
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
} CharacterData;

CharacterData* create_CharacterData(CharacterData* out, char* baseURI, char* nodeName, NodeType nodeType, char* data);
void CharacterData_appendData(CharacterData* data, char* new_data);
void CharacterData_deleteData(CharacterData* data, int offset, int count);
void CharacterData_insertData(CharacterData* data, int offset, char* new_data);
void CharacterData_remove(CharacterData* data);
void CharacterData_replaceData(CharacterData* data, int offset, int count, char* new_data);
char* CharacterData_substringData(CharacterData* data, int offset, int count);


#endif
