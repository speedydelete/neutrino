
#include <stdbool.h>
#include <ctype.h>
#include <string.h>
#include <math.h>
#include "util.h"


char* string_toString(char* this) {
    return this;
}

char* string_at(char* this, double index) {
    if (index < 0) {
        index += strlen(this);
    }
    char* out = safe_malloc(sizeof(char) * 2);
    out[0] = this[(int)index];
    out[1] = '\0';
    return out;
}

char* string_charAt(char* this, double index) {
    if (index < 0 || index >= strlen(this)) {
        return "\0";
    }
    char* out = safe_malloc(sizeof(char) * 2);
    out[0] = this[(int)index];
    out[1] = '\0';
    return out;
}

double string_charCodeAt(char* this, double index) {
    return (double)this[(int)index];
}

bool string_endsWith(char* this, char* other) {
    int this_length = strlen(this);
    int other_length = strlen(other);
    if (other_length > this_length) {
        return false;
    }
    int diff = this_length - other_length;
    for (int i = 0; i < other_length; i++) {
        if (this[diff + i] != other[i]) {
            return false;
        }
    }
    return true;
}

bool string_includes(char* this, char* other) {
    int this_length = strlen(this);
    int other_length = strlen(other);
    if (other_length > this_length) {
        return false;
    }
    for (int i = 0; i < this_length - other_length; i++) {
        for (int j = 0; j < other_length; j++) {
            if (this[i + j] != other[j]) {
                goto not_found;
            }
        }
        return true;
        not_found:;
    }
    return false;
}

double string_indexOf(char* this, char* other) {
    int this_length = strlen(this);
    int other_length = strlen(other);
    if (other_length > this_length) {
        return -1;
    }
    for (int i = 0; i < this_length - other_length; i++) {
        for (int j = 0; j < other_length; j++) {
            if (this[i + j] != other[j]) {
                goto not_found;
            }
        }
        return i;
        not_found:;
    }
    return -1;
}

double string_lastIndexOf(char* this, char* other) {
    int this_length = strlen(this);
    int other_length = strlen(other);
    if (other_length > this_length) {
        return -1;
    }
    for (int i = this_length - other_length; i >= 0; i++) {
        for (int j = 0; j < other_length; j++) {
            if (this[i + j] != other[j]) {
                goto not_found;
            }
        }
        return i;
        not_found:;
    }
    return -1;
}

char* string_padEnd(char* this, double length, char* str) {
    int start_length = strlen(this);
    if (start_length >= length) {
        return this;
    }
    char* out = safe_malloc(sizeof(char) * (length + 1));
    strncpy(out, this, start_length);
    int str_length = strlen(str);
    int iter = ceil((double)(length - start_length) / (double)str_length);
    for (int i = 0; i < iter; i++) {
        strncpy(out + start_length + str_length * i, str, length - start_length - i * str_length);
    }
    out[(int)length] = '\0';
    return out;
}

char* string_padStart(char* this, double length, char* str) {
    int start_length = strlen(this);
    if (start_length >= length) {
        return this;
    }
    char* out = safe_malloc(sizeof(char) * (length + 1));
    strncpy(out + (int)length - start_length, this, start_length);
    int str_length = strlen(str);
    int iter = ceil((double)(length - start_length) / (double)str_length);
    for (int i = 0; i < iter; i++) {
        strncpy(out + str_length * i, str, length - start_length - i * str_length);
    }
    out[(int)length] = '\0';
    return out;
}

char* string_repeat(char* this, double times) {
    int length = strlen(this);
    char* out = safe_malloc(sizeof(char) * (length + 1));
    for (int i = 0; i < times; i++) {
        strncpy(out + i * length, this, length);
    }
    out[(int)length] = '\0';
    return out;
}

char* string_replace(char* this, char* old, char* new) {
    int this_length = strlen(this);
    int old_length = strlen(old);
    if (old_length > this_length) {
        return this;
    }
    int i;
    for (i = 0; i < this_length - old_length; i++) {
        for (int j = 0; j < old_length; j++) {
            if (this[i + j] != old[j]) {
                goto not_found;
            }
        }
        goto found;
        not_found:;
    }
    return this;
    found:;
    int new_length = strlen(new);
    int out_length = this_length - old_length + new_length;
    char* out = safe_malloc(sizeof(char) * (out_length + 1));
    strncpy(out, old, i);
    strncpy(out + i, new, new_length);
    strncpy(out + i + new_length, this + i, this_length - new_length);
    out[out_length] = '\0';
    return out;
}

char* string_replaceAll(char* this, char* old, char* new) {
    int this_length = strlen(this);
    int old_length = strlen(old);
    if (old_length > this_length) {
        return this;
    }
    char* out = this;
    while (true) {
        int i;
        for (i = 0; i < this_length - old_length; i++) {
            for (int j = 0; j < old_length; j++) {
                if (this[i + j] != old[j]) {
                    goto not_found;
                }
            }
            goto found;
            not_found:;
        }
        return out;
        found:;
        int new_length = strlen(new);
        int out_length = this_length - old_length + new_length;
        char* temp = safe_malloc(sizeof(char) * out_length);
        strncpy(temp, old, i);
        strncpy(temp + i, new, new_length);
        strncpy(temp + i + new_length, this + i, this_length - new_length);
        this = temp;
        out = this;
    }
    return NULL;
}

char* string_slice(char* this, double start, double end) {
    int length = strlen(this);
    if (start < 0) {
        start += length;
    }
    if (end < 0) {
        end += length;
    }
    length = start - end;
    char* out = safe_malloc(sizeof(char) * (length + 1));
    strncpy(out, this + (int)start, length);
    out[length] = '\0';
    return out;
}

char* string_substring(char* this, double start, double length) {
    char* out = safe_malloc(sizeof(char) * (length + 1));
    strncpy(out, this + (int)start, length);
    return out;
}

char* string_toLowerCase(char* this) {
    int length = strlen(this);
    char* out = safe_malloc(sizeof(char) * (length + 1));
    for (int i = 0; i < length; i++) {
        out[i] = tolower(this[i]);
    }
    out[length] = '\0';
    return out;
}

char* string_toUpperCase(char* this) {
    int length = strlen(this);
    char* out = safe_malloc(sizeof(char) * (length + 1));
    for (int i = 0; i < length; i++) {
        out[i] = toupper(this[i]);
    }
    out[length] = '\0';
    return out;
}

char* string_trim(char* this) {
    int length = strlen(this);
    int end;
    for (end = length; end >= 0; end--) {
        if (!isspace(this[end])) {
            break;
        }
    }
    int start;
    for (start = 0; start < length; start++) {
        if (!isspace(this[start])) {
            break;
        }
    }
    int new_length = end - start;
    char* out = safe_malloc(sizeof(char) * (new_length + 1));
    strncpy(out, this + start, new_length);
    out[length] = '\0';
    return out;
}

char* string_trimEnd(char* this) {
    int i;
    for (i = strlen(this); i >= 0; i--) {
        if (!isspace(this[i])) {
            break;
        }
    }
    char* out = safe_malloc(sizeof(char) * (i + 1));
    strncpy(out, this, i);
    out[i] = '\0';
    return out;
}

char* string_trimStart(char* this) {
    int length = strlen(this);
    int i;
    for (i = 0; i < length; i--) {
        if (!isspace(this[i])) {
            break;
        }
    }
    char* out = safe_malloc(sizeof(char) * (length - i));
    strncpy(out, this + i, length - i);
    out[i] = '\0';
    return out;
}


void* get_string_string(char* value, char* key) {
    if (strcmp(key, "length") == 0) {
        double* out = safe_malloc(sizeof(double));
        *out = strlen(key);
        return out;
    } else if (strcmp(key, "toString") == 0) {
        return string_toString;
    } else if (strcmp(key, "at") == 0) {
        return string_at;
    } else if (strcmp(key, "charAt") == 0) {
        return string_charAt;
    } else if (strcmp(key, "charCodeAt") == 0) {
        return string_charAt;
    } else if (strcmp(key, "concat") == 0) {
        return stradd;
    } else if (strcmp(key, "endsWith") == 0) {
        return string_endsWith;
    } else if (strcmp(key, "includes") == 0) {
        return string_includes;
    } else if (strcmp(key, "indexOf") == 0) {
        return string_indexOf;
    } else if (strcmp(key, "lastIndexOf") == 0) {
        return string_lastIndexOf;
    } else if (strcmp(key, "padEnd") == 0) {
        return string_padEnd;
    } else if (strcmp(key, "padStart") == 0) {
        return string_padStart;
    } else if (strcmp(key, "repeat") == 0) {
        return string_repeat;
    } else if (strcmp(key, "replace") == 0) {
        return string_replace;
    } else if (strcmp(key, "replaceAll") == 0) {
        return string_replaceAll;
    } else if (strcmp(key, "slice") == 0) {
        return string_slice;
    } else if (strcmp(key, "substring") == 0) {
        return string_substring;
    } else if (strcmp(key, "toLowerCase") == 0) {
        return string_toLowerCase;
    } else if (strcmp(key, "toUpperCase") == 0) {
        return string_toLowerCase;
    } else if (strcmp(key, "trim") == 0) {
        return string_trim;
    } else if (strcmp(key, "trimEnd") == 0) {
        return string_trimEnd;
    } else if (strcmp(key, "trimStart") == 0) {
        return string_trimStart;
    } else {
        return NULL;
    }
}

void* get_string_symbol(char* value, symbol key) {
    return NULL;
}

void* set_string_string(char* this, char* key, void* value) {
    return value;
}

void* set_string_symbol(char* this, symbol key, void* value) {
    return value;
}
