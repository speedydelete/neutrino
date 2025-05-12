

import * as b from '@babel/types';
import * as parser from '@babel/parser';
import * as csstree from 'css-tree';
import {CompilerError, Scope} from './util.js';
import {Inferrer} from './inferrer.js';
import ENTITIES from './entities.json' with {type: 'json'};


interface OpeningTagToken {
    type: 'opening';
    name: string;
    attrs: Map<string, string>
}

interface ClosingTagToken {
    type: 'closing';
    name: string;
}

interface TextToken {
    type: 'text';
    value: string;
}

interface DoctypeToken {
    type: 'doctype';
    value: string;
}

interface CommentToken {
    type: 'comment';
    value: string;
}

type Token = OpeningTagToken | ClosingTagToken | TextToken | DoctypeToken | CommentToken;

const CHAR_REF = /^&([^;]+;)/;

function replaceCharRefs(code: string): string {
    let out = '';
    let i = 0;
    while (i < code.length) {
        let char = code[++i];
        if (char === '&') {
            let match = code.slice(i).match(CHAR_REF);
            if (match) {
                let ref = match[1];
                if (ref in ENTITIES) {
                    // @ts-ignore
                    out += ENTITIES[ref];
                } else if (ref.startsWith('#')) {
                    ref = ref.slice(1, -1);
                    if (ref[1].toLowerCase() === 'x') {
                        out += String.fromCharCode(parseInt(ref.slice(2), 16));
                    } else {
                        out += String.fromCharCode(parseInt(ref.slice(1)));
                    }
                } else {
                    out += char;
                    continue;
                }
                i += match[0].length;
            } else {
                out += char;
            }
        } else {
            out += char;
        }
    }
    return out;
}

const TAG_NAME = /^ *([a-zA-Z-]+) */;
const ATTRIBUTE = /^([^\0"'>/=]+)(=([^='"<>`]+|'[^']+'|"[^"]+"))? */;

function tokenize(code: string): Token[] {
    let tokens: Token[] = [];
    let buffer = '';
    let i = 0;
    while (i < code.length) {
        let char = code[++i];
        if (char === '<') {
            if (buffer !== '') {
                tokens.push({
                    type: 'text',
                    value: replaceCharRefs(buffer),
                });
                buffer = '';
            }
            char = code[++i];
            if (char === '!') {
                if (code.slice(i, i + 2) === '--') {
                    let value = '';
                    while (code.slice(i, i + 3) !== '-->') {
                        value += code[++i];
                    }
                    tokens.push({
                        type: 'comment',
                        value,
                    });
                } else {
                    let type: 'doctype' | 'comment';
                    if (code.slice(i, i + 7).toLowerCase() === 'doctype') {
                        type = 'doctype';
                        i += 7;
                    } else {
                        type = 'comment';
                    }
                    let value = '';
                    while (char !== '>') {
                        char = code[++i];
                        value += char;
                    }
                    tokens.push({
                        type,
                        value,
                    });
                }
            } else if (char === '/') {
                let match = code.slice(++i).match(TAG_NAME);
                if (!match) {
                    continue;
                }
                i += match[0].length;
                while (code[i] !== '>') {
                    i++;
                }
                tokens.push({
                    type: 'closing',
                    name: match[1],
                });
            } else {
                let match = code.slice(i).match(TAG_NAME);
                if (!match) {
                    continue;
                }
                i += match[0].length;
                let name = match[1];
                let attrs: Map<string, string> = new Map();
                while (match = code.slice(i).match(ATTRIBUTE)) {
                    let key = match[1];
                    let value: string;
                    if (match[2]) {
                        if (match[2].startsWith('"') || match[2].startsWith("'")) {
                            value = replaceCharRefs(match[2].slice(1, -1));
                        } else {
                            value = match[2];
                        }
                    } else {
                        value = key;
                    }
                    attrs.set(key, value);
                }
                while (code[i] !== '>') {
                    i++;
                }
                tokens.push({
                    type: 'opening',
                    name,
                    attrs,
                });
                if (name === 'script' || name === 'style' || name === 'textarea' || name === 'title') {
                    let regex = new RegExp(`</${name} *>`);
                    let text = '';
                    while (i < code.length) {
                        if (match = code.slice(i).match(regex)) {
                            i += match.length + 1;
                        } else {
                            text += code[++i];
                        }
                    }
                    if (name === 'script' || name === 'style') {
                        text = replaceCharRefs(text);
                    }
                    tokens.push({
                        type: 'text',
                        value: text,
                    }, {
                        type: 'closing',
                        name,
                    });
                }
            }
        } else {
            buffer += char;
        }
    }
    return tokens;
}


export interface Element {
    type: 'element';
    name: string;
    attrs: Map<string, string>;
    children: Node[];
}

export interface ScriptElement {
    type: 'script';
    attrs: Map<string, string>;
    raw: string;
    ast: b.Program;
    scope: Scope;
    codeType: string;
}

export interface StyleElement {
    type: 'style';
    attrs: Map<string, string>;
    raw: string;
    ast: csstree.CssNode;
}

export interface Text {
    type: 'text';
    value: string;
}

export interface Doctype {
    type: 'doctype';
    value: string;
}

export interface Comment {
    type: 'comment';
    value: string;
}

export type Node = Element | ScriptElement | StyleElement | Text | Doctype | Comment;



function createSpecialElements(body: Node[], filename: string, scope: Scope): Node[] {
    let out: Node[] = [];
    for (let node of body) {
        if (node.type === 'element') {
            if (node.name === 'script') {
                let type = node.attrs.get('type') ?? 'text/javascript';
                if (type === 'text/javascript' || type === 'module' || type === 'text/javascript-jsx' || type === 'text/typescript' || type === 'text/typescript-jsx') {
                    let code = node.children.length > 0 && node.children[0].type === 'text' ? node.children[0].value : undefined;
                    if (code) {
                        let ast = parse(code, filename, type);
                        let newScope = type === 'module' ? new Scope(scope) : scope;
                        let inferrer = new Inferrer(filename, code, newScope);
                        inferrer.program(ast);
                        out.push({
                            type: 'script',
                            attrs: node.attrs,
                            raw: code,
                            ast,
                            scope: newScope,
                            codeType: type,
                        });
                        continue;
                    }
                }
            } else if (node.name === 'style') {
                let code = node.children.length > 0 && node.children[0].type === 'text' ? node.children[0].value : undefined;
                if (code) {
                    out.push({
                        type: 'style',
                        attrs: node.attrs,
                        raw: code,
                        ast: csstree.parse(code),
                    });
                    continue;
                }
            }
            out.push({
                type: 'element',
                name: node.name,
                attrs: node.attrs,
                children: createSpecialElements(node.children, filename, scope),
            });
        } else {
            out.push(node);
        }
    }
    return out;
}

export interface ParsedHTML {
    type: 'html';
    body: Node[];
    scope: Scope;
}

function createAST(tokens: Token[], filename: string): ParsedHTML {
    let out: Node[] = [];
    let stack: [OpeningTagToken, Node[]][] = [];
    let popped: [OpeningTagToken, Node[]] | undefined;
    for (let token of tokens) {
        if (token.type === 'opening') {
            stack.push([token, out]);
            out = [];
        } else if (token.type === 'closing') {
            while (popped = stack.pop()) {
                let [tag, newOut] = popped;
                newOut.push({
                    type: 'element',
                    name: tag.name,
                    attrs: tag.attrs,
                    children: out,
                });
                out = newOut;
                if (tag.name === token.name) {
                    break;
                }
            }
        } else {
            out.push(token);
        }
    }
    while (popped = stack.pop()) {
        let [tag, newOut] = popped;
        newOut.push({
            type: 'element',
            name: tag.name,
            attrs: tag.attrs,
            children: out,
        });
        out = newOut;
    }
    let scope = new Scope();
    return {
        type: 'html',
        body: createSpecialElements(out, filename, scope),
        scope: new Scope(),
    };
}

export function parseHTML(code: string, filename: string): ParsedHTML {
    return createAST(tokenize(code), filename);
}


export type ParseResult<T extends string = string> = ('text/html' extends T ? ParsedHTML : never) | ('text/css' extends T ? csstree.CssNode : never) | (T extends 'text/html' | 'text/css' ? never : b.Program);

export function parse<T extends string>(code: string, path: string, type: T): ParseResult<T> {
    if (type === 'text/html') {
        // @ts-ignore
        return parseHTML(code);
    } else if (type === 'text/css') {
        // @ts-ignore
        return csstree.parse(code);
    }
    let plugins: parser.ParserPlugin[] = [];
    if (type === 'text/typescript' || type === 'text/typescript-jsx') {
        plugins.push('typescript');
    } else if (type === 'text/javascript-jsx' || type === 'text/typescript-jsx') {
        plugins.push('jsx');
    }
    let ast: b.Program;
    try {
        ast = parser.parse(code, {
            plugins,
            sourceType: 'module',
            sourceFilename: path,
        }).program;
    } catch (error) {
        if (error && typeof error === 'object' && error instanceof SyntaxError && 'code' in error && typeof error.code === 'string' && error.code === 'BABEL_PARSER_SYNTAX_ERROR' && 'loc' in error && error.loc && typeof error.loc === 'object' && 'index' in error.loc && typeof error.loc.index === 'number' && 'line' in error.loc && typeof error.loc.line === 'number' && 'column' in error.loc && typeof error.loc.column === 'number') {
            let [type, msg] = error.message.split(': ');
            let index = error.loc.index;
            throw new CompilerError(type, msg, {
                raw: code.slice(index, index + 1),
                fullRaw: code,
                file: path,
                line: error.loc.line,
                col: error.loc.column,
            });
        } else {
            throw error;
        }
    }
    // @ts-ignore
    return ast;
}
