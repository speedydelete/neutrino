
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import {spawn} from 'child_process';


interface TestResult {
    test: string;
    filePath: string;
    compilation: {
        code: number | null;
        stdout: string;
        stderr: string;
    };
}


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

let results: TestResult[] = [];

for (let file of getTestFiles(test262Dir)) {
    let content = `'use strict';\n` + fs.readFileSync(file, 'utf8');
    let testName = path.basename(file);
    let testDir = path.join(tmp, 'tests');
    let testPath = path.join(testDir, 'index.js');
    fs.rmSync(testDir, {recursive: true, force: true});
    fs.mkdirSync(testDir);
    fs.writeFileSync(testPath, content);
    let configPath = path.join(tmp, 'compiler.config.js');
    fs.writeFileSync(configPath, `export default { files: ["tests/index.js"] }`);
    let compileRes = await run('npx', ['neutrino', configPath], tmp);
    results.push({
        test: testName,
        filePath: file,
        compilation: compileRes,
    });
}

fs.writeFileSync('test_results.json', JSON.stringify(results, null, 2));
