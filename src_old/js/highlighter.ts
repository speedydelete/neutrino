
export interface HighlightColors {
    brackets: string[],
    identifier: string;
    typeIdentifier: string;
    function: string;
    keyword: string;
    controlKeyword: string;
    typeKeyword: string;
    number: string;
    string: string;
    comment: string;
    other: string;
}

const DEFAULT_COLORS: HighlightColors = {
    brackets: ['93', '95', '34'],
    identifier: '96',
    typeIdentifier: '32',
    function: '93',
    keyword: '34',
    controlKeyword: '95',
    typeKeyword: '34',
    number: '32',
    string: '5;214',
    comment: '92',
    other: '0',
}


const KEYWORDS = ['async', 'class', 'const', 'debugger', 'delete', 'extends', 'false', 'function', 'in', 'instanceof', 'new', 'null', 'of', 'super', 'this', 'true', 'typeof', 'var', 'void', 'let', 'static', 'get', 'set', 'undefined', 'Infinity', 'NaN', 'constructor', 'arguments', 'type', 'interface', 'enum', 'declare', 'namespace', 'module', '=>'];
const CONTROL_KEYWORDS = ['break', 'catch', 'case', 'continue', 'default', 'do', 'else', 'export', 'finally', 'for', 'from', 'if', 'import', 'return', 'switch', 'throw', 'try', 'while', 'with', 'await', 'yield'];
const IN_TYPE_KEYWORDS = ['type', 'interface', 'enum', 'module', 'namespace'];
const TYPE_KEYWORDS = ['keyof', 'readonly', 'infer'];

const BRACKET_COLORS = ['\x1b[93m', '\x1b[95m', '\x1b[34m'];


export function highlight(code: string, colors: HighlightColors = DEFAULT_COLORS, inType: boolean = false): string {
    let out = '';
    let i = 0;
    let match: RegExpMatchArray | null;
    let bracketIndex = 0;
    let inTypeAlias = false;
    let inTypeName = false;
    let inTypeBracketIndex = 0;
    while (i < code.length) {
        if (code[i] === ' ') {
            out += ' ';
            i++;
            continue;
        } else if (match = code.slice(i).match(/^([a-zA-Z_$][a-zA-Z0-9_$]*|=>)/)) {
            let text = match[0];
            i += text.length;
            let found = false;
            for (let keyword of KEYWORDS) {
                if (text === keyword) {
                    out += `\x1b[${colors.keyword}m` + text;
                    if (IN_TYPE_KEYWORDS.includes(keyword)) {
                        inType = true;
                        inTypeBracketIndex = bracketIndex;
                        if (keyword === 'type') {
                            inTypeAlias = true;
                        } else {
                            inTypeName = true;
                        }
                    }
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            for (let keyword of CONTROL_KEYWORDS) {
                if (text === keyword) {
                    out += `\x1b[${colors.controlKeyword}m` + text;
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            if (inType) {
                for (let keyword of TYPE_KEYWORDS) {
                    if (text === keyword) {
                        out += `\x1b[${colors.typeKeyword}m` + text;
                    }
                }
            }
            if (inType) {
                out += `\x1b[${colors.typeIdentifier}m` + text;
            } else if (code[i] === '(') {
                out += `\x1b[${colors.function}m` + text;
            } else {
                out += `\x1b[${colors.identifier}m` + text;
            }
            if (inType && inTypeName) {
                inType = false;
                inTypeName = false;
            }
        } else if ('()[]{}'.includes(code[i]) || (inType && '<>'.includes(code[i]))) {
            let colorIndex = bracketIndex % 3;
            if ('([{<'.includes(code[i])) {
                bracketIndex++;
            } else {
                bracketIndex--;
                colorIndex--;
            }
            if (bracketIndex < 0) {
                out += '\x1b[91m' + code[i];
            } else {
                out += BRACKET_COLORS.at(colorIndex) + code[i];
            }
            i++;
        } else if (match = code.slice(i).match(/^-?((0|[1-9][0-9]*)(\.[0-9]+)?|0b[01]+|0o[0-7]+|0x[0-9A-Fa-f]+)/)) {
            out += '\x1b[32m' + match[0];
            i += match[0].length;
            if (code[i] === 'n') {
                out += `\x1b[${colors.number}mn`;
                i++;
            }
        } else if (code[i] === '"' || code[i] === "'") {
            let endChar = code[i];
            let string = '';
            do {
                string += code[i];
                i++;
            } while (i < code.length && !(code[i] === endChar && code[i - 1] !== '\\'));
            out += `\x1b[38;${colors.string}m` + string + endChar;
            i++;
        } else if (code[i] === '/' && code[i + 1] === '/') {
            let text = '';
            while (code[i] !== '\n' && i > code.length) {
                text += code[i];
                i++;
            }
            out += `\x1b[${colors.comment}m` + text;
        } else if (code[i] === '/' && code[i + 1] === '*') {
            let text = '';
            while ((code[i] !== '*' && code[i + 1] !== '/') && i > code.length) {
                text += code[i];
                i++;
            }
            out += `\x1b[${colors.comment}m` + text;
        } else {
            out += `\x1b[${colors.other}m` + code[i];
            if (code[i] === ':') {
                inType = true;
                inTypeBracketIndex = bracketIndex;
            }
            if (('=,'.includes(code[i]) && !inTypeAlias && inTypeBracketIndex === bracketIndex) || '\n;'.includes(code[i])) {
                inType = false;
            }
            i++;
        }
        if (inType && (bracketIndex < inTypeBracketIndex)) {
            inType = false;
        }
    }
    return out + '\x1b[0m';
}
