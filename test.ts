
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import {spawn} from 'child_process';

async function run(cmd: string, args: string[], cwd: string): Promise<{code: number | null, stdout: string, stderr: string}> {
    return new Promise((resolve) => {
        let proc = spawn(cmd, args, { cwd });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', chunk => (stdout += chunk));
        proc.stderr.on('data', chunk => (stderr += chunk));
        proc.on('close', code => resolve({code, stdout, stderr}));
    });
}

let tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test262-runner-'));
let test262Dir = path.resolve('test262');
let testsDir = path.join(test262Dir, 'test/language', process.argv[2] ?? '');

fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
    name: 'test262-temp',
    type: 'module',
}, null, 2));
await run('npm', ['link', import.meta.dirname], tmp);

function getTestFiles(dir: string): string[] {
    let entries = fs.readdirSync(dir, {withFileTypes: true});
    let out: string[] = [];
    for (let entry of entries) {
        let res = path.resolve(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...getTestFiles(res));
        } else if (entry.isFile() && res.endsWith('.js')) {
            out.push(res);
        }
    }
    return out;
}

let out = '';
let count = 0;
let successful = 0;
let files = getTestFiles(testsDir);
let total = files.length;

let header = `'use strict';\n`;

fs.writeFileSync(path.join(tmp, 'neutrino.config.js'), `export default {files: ['tests/index.js'], __isTest262: true}`);

for (let file of files) {
    let content = header + fs.readFileSync(file, 'utf8');
    content = content.replaceAll('assert._isSameValue', 'assert__isSameValue');
    content = content.replaceAll('assert.notSameValue', 'assert__notSameValue');
    content = content.replaceAll('assert._toString', 'assert__toString');
    let testName = path.basename(file);
    let testDir = path.join(tmp, 'tests');
    let testPath = path.join(testDir, 'index.js');
    fs.rmSync(testDir, {recursive: true, force: true});
    fs.mkdirSync(testDir);
    fs.writeFileSync(testPath, content);
    let {code, stdout, stderr} = await run('npx', ['neutrino'], tmp);
    if (!code) {
        successful++;
    }
    out += `\n\n\n## ${testName} (${file})\nexited with code ${code}\n`;
    if (stdout) {
        out += `\n### stdout\n${stdout}`;
    }
    if (stderr) {
        out += `\n### stderr\n${stderr}`;
        if (fs.existsSync(testPath + '.c')) {
            out += `### generated C:\n${fs.readFileSync(testPath + '.c')}`;
        }
    }
    count++;
    if (count % 10 === 0) {
        console.log(`ran ${count}/${total} tests (${(count / total * 100).toFixed(2)}%)`);
    }
}

fs.rmSync(tmp, {recursive: true, force: true});

out = out.replaceAll(/\x1b\[[^m]+?m/g, '');

let final = `${successful}/${total} tests successful (${(successful / total * 100).toFixed(2)}%)`;

fs.writeFileSync('test_results.md', `# Test262 Results\n\n${final}\n\n` + out);
console.log(final);
