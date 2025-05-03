
CC = gcc
CFLAGS = -Wall -Wextra -Werror -Wno-unused-variable -Wno-unused-parameter
LDFLAGS = -lm

BUILTINS = ./builtins
CORE = $(BUILTINS)/core
OPS = $(BUILTINS)/ops

SRCS = main.c $(BUILTINS)/neutrino.h \
	$(CORE)/array.c $(CORE)/object.c $(CORE)/types.c \
	$(OPS)/eq.c $(OPS)/seq.c

OBJS = $(SRCS:.c=.o)

all: main

main: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ ${LDFLAGS}

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@ ${LDFLAGS}

clean:
	rm $(OBJS)

.PHONY: all clean
