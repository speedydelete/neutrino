
CC = gcc
CFLAGS = -Wall -Wextra -Werror -Wno-unused-variable -Wno-unused-parameter -g
LDFLAGS = -lm

SRCS = main.c ./builtins/index.c $(wildcard ./builtins/core/*.c) $(wildcard ./builtins/globals/*.c)

OBJS = $(SRCS:.c=.o)

all: main

main: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ ${LDFLAGS}

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@ ${LDFLAGS}

clean:
	rm $(OBJS)

.PHONY: all clean
