#!/usr/bin/env node

/**
 * 思源笔记一键构建脚本
 * 支持自动检测平台并构建对应的安装包
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 执行命令并输出
function runCommand(command, cwd = process.cwd(), options = {}) {
  colorLog('cyan', `执行命令: ${command}`);
  try {
    const result = execSync(command, {
      cwd,
      stdio: 'inherit',
      encoding: 'utf8',
      ...options
    });
    return result;
  } catch (error) {
    colorLog('red', `命令执行失败: ${command}`);
    colorLog('red', error.message);
    process.exit(1);
  }
}

// 检测平台
function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();
  
  colorLog('yellow', `检测到平台: ${platform}, 架构: ${arch}`);
  
  return { platform, arch };
}

// 清理构建目录
function cleanBuildDirs() {
  colorLog('blue', '清理构建目录...');
  
  const dirsToClean = [
    'app/build',
    'app/kernel',
    'app/kernel',
    'app/kernel',
    'app/kernel',
    'app/kernel',
    'app/kernel',
    'app/kernel'
  ];
  
  dirsToClean.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        colorLog('green', `已清理: ${dir}`);
      } catch (error) {
        colorLog('yellow', `清理失败: ${dir}, ${error.message}`);
      }
    }
  });
}

// 构建Go内核
function buildKernel(platform, arch) {
  colorLog('blue', '开始构建Go内核...');
  
  const kernelDir = path.join(process.cwd(), 'kernel');
  
  // 设置Go环境变量
  const goEnv = {
    ...process.env,
    GO111MODULE: 'on',
    GOPROXY: 'https://mirrors.aliyun.com/goproxy/',
    CGO_ENABLED: '1',
    GOWORK: 'off'  // 禁用go work模式，避免模块冲突
  };
  
  let kernelDirName = '';
  let goOS = '';
  let goArch = '';
  
  // 根据平台设置参数
  if (platform === 'darwin') {
    goOS = 'darwin';
    kernelDirName = arch === 'arm64' ? 'kernel-darwin-arm64' : 'kernel-darwin';
    // Go 中 x64 架构应该使用 amd64
    goArch = arch === 'x64' ? 'amd64' : arch;
  } else if (platform === 'linux') {
    goOS = 'linux';
    kernelDirName = arch === 'arm64' ? 'kernel-linux-arm64' : 'kernel-linux';
    // Go 中 x64 架构应该使用 amd64
    goArch = arch === 'x64' ? 'amd64' : arch;
  } else if (platform === 'win32') {
    goOS = 'windows';
    kernelDirName = arch === 'arm64' ? 'kernel-windows-arm64' : 'kernel';
    // Go 中 x64 架构应该使用 amd64
    goArch = arch === 'x64' ? 'amd64' : arch;
  } else {
    colorLog('red', `不支持的平台: ${platform}`);
    process.exit(1);
  }
  
  goEnv.GOOS = goOS;
  goEnv.GOARCH = goArch;
  
  // 创建内核输出目录
  const kernelOutputDir = path.join(process.cwd(), 'app', kernelDirName);
  if (!fs.existsSync(kernelOutputDir)) {
    fs.mkdirSync(kernelOutputDir, { recursive: true });
  }
  
  // 设置输出文件名
  const outputName = platform === 'win32' ? 'SiYuan-Kernel.exe' : 'SiYuan-Kernel';
  const outputPath = path.join('..', 'app', kernelDirName, outputName);
  
  // 构建命令
  const buildCommand = `go build --tags fts5 -v -o "${outputPath}" -ldflags "-s -w" .`;
  
  colorLog('cyan', `构建内核 (${goOS}/${goArch}): ${buildCommand}`);
  colorLog('cyan', `工作目录: ${kernelDir}`);
  
  try {
    // 确保在kernel目录中执行
    process.chdir(kernelDir);
    execSync(buildCommand, {
      cwd: kernelDir,
      stdio: 'inherit',
      env: goEnv
    });
    // 切换回原目录
    process.chdir(path.join(process.cwd(), '..'));
    colorLog('green', '内核构建完成');
  } catch (error) {
    // 确保即使出错也切换回原目录
    try {
      process.chdir(path.join(process.cwd(), '..'));
    } catch (e) {
      // 忽略切换目录的错误
    }
    colorLog('red', '内核构建失败');
    colorLog('red', error.message);
    process.exit(1);
  }
}

// 构建前端应用
function buildFrontend() {
  colorLog('blue', '开始构建前端应用...');
  
  const appDir = path.join(process.cwd(), 'app');
  
  // 安装依赖
  colorLog('cyan', '安装前端依赖...');
  runCommand('pnpm install', appDir);
  
  // 构建前端
  colorLog('cyan', '构建前端代码...');
  runCommand('pnpm run build', appDir);

  colorLog('green', '前端构建完成');
}

// 构建Electron安装包
function buildElectronApp(platform, arch) {
  colorLog('blue', '开始构建Electron安装包...');
  
  const appDir = path.join(process.cwd(), 'app');
  
  // 设置Electron镜像环境变量
  const electronEnv = {
    ...process.env,
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
  };
  
  let buildCommand = '';
  
  // 根据平台选择构建命令
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      buildCommand = 'pnpm run dist-darwin-arm64';
    } else {
      buildCommand = 'pnpm run dist-darwin';
    }
  } else if (platform === 'linux') {
    if (arch === 'arm64') {
      buildCommand = 'pnpm run dist-linux-arm64';
    } else {
      buildCommand = 'pnpm run dist-linux';
    }
  } else if (platform === 'win32') {
    if (arch === 'arm64') {
      buildCommand = 'pnpm run dist-arm64';
    } else {
      buildCommand = 'pnpm run dist';
    }
  } else {
    colorLog('red', `不支持的平台: ${platform}`);
    process.exit(1);
  }
  
  colorLog('cyan', `构建Electron应用: ${buildCommand}`);
  
  try {
    execSync(buildCommand, {
      cwd: appDir,
      stdio: 'inherit',
      env: electronEnv
    });
    colorLog('green', 'Electron应用构建完成');
  } catch (error) {
    colorLog('red', 'Electron应用构建失败');
    colorLog('red', error.message);
    process.exit(1);
  }
}

// 主函数
function main() {
  colorLog('bright', '=================================');
  colorLog('bright', '    思源笔记一键构建脚本');
  colorLog('bright', '=================================');
  
  // 检测平台
  const { platform, arch } = detectPlatform();
  
  // 清理构建目录
  cleanBuildDirs();
  
  // 构建Go内核
  buildKernel(platform, arch);
  
  // 构建前端应用
  buildFrontend();
  
  // 构建Electron安装包
  buildElectronApp(platform, arch);
  
  colorLog('bright', '=================================');
  colorLog('green', '构建完成！');
  colorLog('cyan', `安装包位置: ${path.join(process.cwd(), 'app', 'build')}`);
  colorLog('bright', '=================================');
}

// 解析命令行参数
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');

if (helpFlag) {
  console.log(`
思源笔记一键构建脚本

用法:
  node build.js [选项]

选项:
  --help, -h     显示帮助信息

示例:
  node build.js                # 自动检测平台并构建
  pnpm run build                # 使用pnpm执行构建

注意:
  - 需要安装Node.js、pnpm和Go环境
  - 不同平台需要相应的构建环境
  - macOS构建需要额外的证书和配置文件
`);
  process.exit(0);
}

// 执行主函数
main();