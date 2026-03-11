#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const platform = os.platform();
const kernelDir = path.join(__dirname, '../../kernel');
const appDir = path.join(__dirname, '..');

// 确定可执行文件名
const exeName = platform === 'win32' ? 'SiYuan-Kernel.exe' : 'SiYuan-Kernel';
const kernelBinDir = path.join(appDir, 'kernel');

// 构建命令
console.log('Building kernel for forge mode...');
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
console.log('Starting forge mode...');
const startCmd = platform === 'win32'
  ? `.\\${exeName} --wd=.. --mode=forge --workspace=../../.dev-workspace`
  : `./${exeName} --wd=.. --mode=forge --workspace=../../.dev-workspace`;

try {
  execSync(startCmd, {
    cwd: kernelBinDir,
    stdio: 'inherit'
  });
} catch (error) {
  // 用户可能按 Ctrl+C 退出，这是正常的
  process.exit(0);
}
