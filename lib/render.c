
#include <gtk/gtk.h>

#include "AbortController.h"
#include "Attr.h"
#include "CharacterData.h"
#include "Comment.h"
#include "Document.h"
#include "Element.h"
#include "Event.h"
#include "Node.h"
#include "Text.h"

#include "template.h"


void render_dom(GtkWidget* widget, Node* elt) {
    GTKWidget* child;
    if (elt->nodeType == TEXT_NODE) {
        GTKWidget *label = gtk_label_new(elt->nodeValue);
        gtk_box_append(widget, label);
    } else if (elt->nodeType == ELEMENT_NODE) {
        GTKWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 5);
        gtk_box_append(widget, box);
        elt = elt->firstChild;
        while (elt != NULL) {
            render_dom(box, elt);
            elt = elt->nextSibling;
        }
    }
}

static void activate(GtkApplication* app, gpointer user_data) {
    GtkWidget* window = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(window), Document_get_title(document));
    gtk_window_set_default_size(GTK_WINDOW(window), 500, 500);
    GtkWidget* box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 5);
    gtk_window_set_child(GTK_WINDOW(window), box);
    render_dom(box, document->documentElement);
    gtk_window_present(GTK_WINDOW(window));
}

int render(int argc, char** argv) {
    GtkApplication *app;
    int status;
    app = gtk_application_new(APP_NAME, G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(app, "activate", G_CALLBACK(activate), NULL);
    status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);
    return status;
}
