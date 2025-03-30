
const KEYWORDS = ['async', 'class', 'const', 'debugger', 'delete', 'extends', 'false', 'function', 'in', 'instanceof', 'new', 'null', 'super', 'this', 'true', 'typeof', 'var', 'void', 'let', 'static', 'undefined', 'Infinity', 'NaN', 'constructor', 'type', 'interface', 'enum', 'declare', 'get', 'module', 'namespace', 'set'];

const CONTROL_KEYWORDS = ['break', 'catch', 'case', 'continue', 'default', 'do', 'else', 'export', 'finally', 'for', 'if', 'import', 'return', 'switch', 'throw', 'try', 'while', 'with', 'await', 'yield'];

const IN_TYPE_KEYWORDS = ['type', 'interface', 'enum', 'module', 'namespace'];

const BRACKET_COLORS = ['\x1b[93m', '\x1b[95m', '\x1b[34m'];


export function highlight(code: string): string {
    let out = '';
    let i = 0;
    let match: RegExpMatchArray | null;
    let bracketIndex = 0;
    let inType = false;
    let inTypeAlias = false;
    let inTypeName = false;
    let inTypeBracketIndex = 0;
    main: while (i < code.length) {
        if (code[i] === ' ') {
            out += ' ';
            i++;
            continue;
        } else if (match = code.slice(i).match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/)) {
            let text = match[0];
            i += text.length;
            for (let keyword of KEYWORDS) {
                if (text === keyword) {
                    out += '\x1b[34m' + text;
                    if (IN_TYPE_KEYWORDS.includes(keyword)) {
                        inType = true;
                        inTypeBracketIndex = bracketIndex;
                        if (keyword === 'type') {
                            inTypeAlias = true;
                        } else {
                            inTypeName = true;
                        }
                    }
                    continue main;
                }
            }
            for (let keyword of CONTROL_KEYWORDS) {
                if (text === keyword) {
                    out += '\x1b[95m' + text;
                    continue main;
                }
            }
            if (inType) {
                out += '\x1b[32m' + text;
            } else if (code[i] === '(') {
                out += '\x1b[93m' + text;
            } else {
                out += '\x1b[96m' + text;
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
                out += '\x1b[34mn';
                i++;
            }
        } else if (code[i] === '"' || code[i] === "'") {
            let endChar = code[i];
            let string = '';
            do {
                string += code[i];
                i++;
            } while (i < code.length && !(code[i] === endChar && code[i - 1] !== '\\'));
            out += '\x1b[38;5;214m' + string + endChar;
            i++;
        } else if (code[i] === '/' && code[i + 1] === '/') {
            let text = '';
            while (code[i] !== '\n' && i > code.length) {
                text += code[i];
                i++;
            }
            out += '\x1b[92m' + text;
        } else if (code[i] === '/' && code[i + 1] === '*') {
            let text = '';
            while ((code[i] !== '*' && code[i + 1] !== '/') && i > code.length) {
                text += code[i];
                i++;
            }
            out += '\x1b[92m' + text;
        } else {
            out += '\x1b[0m' + code[i];
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
