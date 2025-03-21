
import {parse, type Tag} from './html_parser';
import {compile as compileJS, getCString} from './js_compiler';


let varIndex = -1;

function getVar() {
    varIndex++;
    return 'temp_' + varIndex.toString(36);
}


function compileTags(tags: Tag[], elt: string = 'document'): string {
    let out = '';
    for (let tag of tags) {
        if (typeof tag === 'string') {
            out += `Node_appendChild((Node*)${elt},(Node*)Document_createTextNode(document,${getCString(tag)}));`
        } else if (tag.type === 'doctype') {
            let args: string;
            if (tag.dtd === 'html') {
                args = '"html","",""';
            } else {
                args = `"",${getCString(tag.dtd)},""`;
            }
            out += `Node_appendChild((Node*)${elt},(Node*)create_DocumentType(${args})});`
        } else if (tag.type === 'comment') {
            out += `Node_appendChild((Node*)${elt},(Node*)Document_createComment(document,${getCString(tag.text)}))`;
        } else {
            let name = getVar();
            out += `Element*${name}=Document_createElement(document,${getCString(tag.name)});`;
            for (let key in tag.attrs) {
                out += `Node_appendChild((Node*)${name},(Node*)Document_createAttr(document,${getCString(key)},${getCString(tag.attrs[key])}));`;
            }
            out += compileTags(tag.content, name);
            out += `Node_appendChild((Node*)${elt},(Node*)${name});`
            if (tag.name === 'script' && typeof tag.content[0] === 'string') {
                out += compileJS(tag.content[0]);
            }
        }
    }
    return out;
}

export function compile(code: string): string {
    return compileTags(parse(code));
}
