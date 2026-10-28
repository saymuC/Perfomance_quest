import { spawn } from 'node:child_process';

const backend = spawn(process.execPath, ['--env-file-if-exists=.env', 'backend/server.js'], { stdio: 'inherit' });
const frontend = spawn(process.execPath, ['server.js'], { stdio: 'inherit' });

for (const [child, other] of [[backend, frontend], [frontend, backend]]) {
  child.on('exit', code => {
    if (other.exitCode === null) other.kill();
    process.exitCode = code || 1;
  });
}

process.on('SIGINT', () => {
  backend.kill();
  frontend.kill();
});
