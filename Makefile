
CC = gcc
CFLAGS = -Wall -Wextra -Werror -Wno-unused-variable -Wno-unused-parameter -g
LDFLAGS = -lm

BUILTINS = ./builtins
CORE = $(BUILTINS)/core
OPS = $(BUILTINS)/ops
GLOBALS = $(BUILTINS)/globals

SRCS = main.c $(BUILTINS)/neutrino.c \
	$(CORE)/array.c $(CORE)/object.c $(CORE)/types.c \
	$(OPS)/eq.c $(OPS)/seq.c $(OPS)/compare.c $(OPS)/arithmetic.c $(OPS)/add.c \
	$(GLOBALS)/console.c

OBJS = $(SRCS:.c=.o)

all: main

main: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ ${LDFLAGS}

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@ ${LDFLAGS}

clean:
	rm $(OBJS)

.PHONY: all clean
