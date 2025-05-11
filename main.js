
import {loadConfig, transformAndCompileAll} from './lib/index.js';

try {
    await loadConfig();
    transformAndCompileAll();
} catch (error) {
    if (error && typeof error === 'object') {
        if ('toStringHighlighted' in error) {
            console.error(error.toStringHighlighted());
        }
        if ('stack' in error) {
            let stack = String(error.stack);
            let out = [];
            for (let line of stack.split('\n')) {
                if (line.includes('node:internal')) {
                    break;
                }
                out.push(line);
            }
            console.error(out.join('\n'));
        }
    } else {
        console.error(error);
    }
    process.exit(1);
}
