
interface TagToken {
    type: 'tag';
    name: string;
    closing: boolean;
    rawAttrs: string;
    attrs: {[key: string]: string};
}

export interface HTMLTag {
    type: 'tag';
    name: string;
    attrs: {[key: string]: string};
    content: Tag[];
}

export interface Doctype {
    type: 'doctype';
    dtd: string;
}

export interface TagComment {
    type: 'comment';
    text: string;
}

type TokenList = (TagToken | TagComment | string)[];

export type Tag = HTMLTag | Doctype | TagComment | string;


const COMMENT_REGEX = /<--(.*?)-->/
const TAG_REGEX = /<(\/?)(!?[a-zA-Z][a-zA-Z0-9-]*)((?:\s+(?:[^<>"]+|"(?:\\.|[^"])*"|'(?:\\.|[^'])*')*)?)\s*\/?>/;
const ATTR_REGEX = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*["']((?:\\.|[^"\\])*?)["']/g;
const DQ_ESC_REGEX = /(?<!\\)\\"/g;
const SQ_ESC_REGEX = /(?<!\\)\\'/g;

function tokenize(code: string): TokenList {
    let out: TokenList = [];
    let text: string;
    let match: RegExpMatchArray | null;
    while (code.length > 0) {
        text = '';
        while (!code.startsWith('<') && code.length > 0) {
            text += code[0];
            code = code.slice(1);
        }
        out.push(text);
        if (code.length === 0) {
            break;
        }
        if (code.startsWith('<--')) {
            if (match = code.match(COMMENT_REGEX)) {
                code = code.slice(match[0].length);
                out.push({
                    type: 'comment',
                    text: match[1],
                });
            } else {
                code = code.slice(code.indexOf('>'));
            }
        } else {
            if (match = code.match(TAG_REGEX)) {
                code = code.slice(match[0].length);
                let attrMatch = match[3].matchAll(ATTR_REGEX);
                let attrs = Object.fromEntries(Array.from(attrMatch).map(x => {
                    let key = x[1];
                    let value = x[2];
                    if ((value.startsWith('"') && value.endsWith('"'))) {
                        value = value.slice(1, -1).replaceAll(DQ_ESC_REGEX, '"');
                    } else if ((value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1).replaceAll(SQ_ESC_REGEX, "'");
                    }
                    return [key, value];
                }));
                out.push({
                    type: 'tag',
                    name: match[2],
                    closing: match[1] === '/',
                    rawAttrs: match[3],
                    attrs,
                });
            }
        }
    }
    return out;
}

function getTags(tags: TokenList): Tag[] {
    let stack: [TagToken | null, Tag[]][] = [];
    let currentTag: TagToken | null = null;
    let content: Tag[] = [];
    for (let tag of tags) {
        if (typeof tag === 'string' || tag.type === 'comment') {
            content.push(tag);
        } else {
            if (tag.closing) {
                if (currentTag !== null) {
                    let newTag: Tag = {
                        type: 'tag',
                        name: currentTag.name,
                        attrs: currentTag.attrs,
                        content,
                    };
                    [currentTag, content] = stack.pop();
                    content.push(newTag);
                }
            } else if (tag.name.toUpperCase().startsWith('!DOCTYPE')) {
                content.push({
                    type: 'doctype',
                    dtd: tag.rawAttrs.trim(),
                });
            } else {
                stack.push([currentTag, content]);
                currentTag = tag;
                content = [];
            }
        }
    }
    return content;
}

export function parse(code: string): Tag[] {
    return getTags(tokenize(code));
}
