
CC = gcc # x86_64-w64-mingw32-gcc
CFLAGS = -Wall -Wextra -Werror -Wno-unused-variable -Wno-unused-parameter -g # -I../windows-libgc/include/gc -L../windows-libgc/lib
LDFLAGS = -lm -lgc

SRCS = main.c ./builtins/index.c $(wildcard ./builtins/core/*.c) $(wildcard ./builtins/globals/*.c)

OBJS = $(SRCS:.c=.o)

all: main

main: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $^ ${LDFLAGS}
# ~/code/windows-libgc/lib/libgc.dll.a

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@ ${LDFLAGS}

clean:
	rm $(OBJS)

.PHONY: all clean
