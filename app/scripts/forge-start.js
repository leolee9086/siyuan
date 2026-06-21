#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const net = require('net');

const platform = os.platform();
const kernelDir = path.join(__dirname, '../../kernel');
const appDir = path.join(__dirname, '..');

// 从命令行参数解析 --port 值
const portArgIndex = process.argv.findIndex((arg) => arg.startsWith('--port='));
const port = portArgIndex !== -1 ? process.argv[portArgIndex].split('=')[1] : '6806';

// 在启动前检测端口是否可用
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

(async () => {
  if (!(await isPortAvailable(port))) {
    console.error(`端口 ${port} 已被占用，请先关闭占用该端口的进程后重试`);
    process.exit(1);
  }

  // 确定可执行文件名
  const exeName = platform === 'win32' ? 'SiYuan-Kernel.exe' : 'SiYuan-Kernel';
  const kernelBinDir = path.join(appDir, 'kernel');

  // 构建命令
  console.log(`Building kernel for forge mode (port=${port})...`);
  try {
    execSync(`go build --tags "fts5" -o "../app/kernel/${exeName}"`, {
      cwd: kernelDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }

  // 启动命令
  console.log(`Starting forge mode on port ${port}...`);
  const startCmd = platform === 'win32'
    ? `.\\${exeName} serve --wd=.. --mode=forge --port=${port} --workspace=../../.dev-workspace`
    : `./${exeName} serve --wd=.. --mode=forge --port=${port} --workspace=../../.dev-workspace`;

  try {
    execSync(startCmd, {
      cwd: kernelBinDir,
      stdio: 'inherit'
    });
  } catch (error) {
    // 用户可能按 Ctrl+C 退出，这是正常的
    process.exit(0);
  }
})();
