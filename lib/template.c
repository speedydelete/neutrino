
/* DEFINITIONS */

#include <stdlib.h>

#include "AbortController.h"
#include "Attr.h"
#include "CharacterData.h"
#include "Comment.h"
#include "Document.h"
#include "Element.h"
#include "Event.h"
#include "Node.h"
#include "Text.h"


Document* document;


void create(void);

/* COMPILED CODE */

#include "render.h"

int main(int argc, char** argv) {
    document = malloc(sizeof(Document));
    document->baseURI = 'neutrino://index.html';
    document->nodeType = DOCUMENT_NODE;
    document->nodeName = '#document';
    create();
    int status = render(argc, argv);
    free_Node_and_children(document);
    return status;
}
