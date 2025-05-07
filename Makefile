
CC = gcc
CFLAGS = -Wall -Wextra -Werror -Wno-unused-variable -Wno-unused-parameter -g
LDFLAGS = -lm

BUILTINS = ./builtins
CORE = $(BUILTINS)/core
GLOBALS = $(BUILTINS)/globals

SRCS = main.c $(BUILTINS)/neutrino.c \
	$(CORE)/array.c $(CORE)/boolean.c $(CORE)/number.c $(CORE)/object.c $(CORE)/string.c $(CORE)/symbol.c $(CORE)/util.c \
	$(GLOBALS)/core.c $(GLOBALS)/console.c

OBJS = $(SRCS:.c=.o)

all: main

main: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ ${LDFLAGS}

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@ ${LDFLAGS}

clean:
	rm $(OBJS)

.PHONY: all clean
