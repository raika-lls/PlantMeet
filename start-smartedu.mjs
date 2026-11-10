import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const bundled=join(process.env.USERPROFILE||'.','.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const command=existsSync(bundled)?bundled:process.platform==='win32'?'py':'python3';
const proc=spawn(command,[...(command==='py'?['-3']:[]),fileURLToPath(new URL('./SmartEdu/server.py',import.meta.url)),'--browser'],{stdio:'inherit'});
proc.on('error',()=>{console.error('Python 3.10+ орнатыңыз.');process.exitCode=1});
proc.on('exit',code=>process.exitCode=code??1);
