function test(): number {
    return 5;
}

neutrino.c`printf("%f\n", ${1 + test()})`;