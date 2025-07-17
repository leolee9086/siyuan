#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
    log(`\n${colors.bright}${colors.cyan}=== ${step} ===${colors.reset}`);
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logInfo(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// 检测操作系统
function getPlatform() {
    const platform = os.platform();
    const arch = os.arch();
    
    if (platform === 'win32') {
        return { platform: 'windows', arch, executable: 'SiYuan-Kernel.exe' };
    } else if (platform === 'darwin') {
        return { platform: 'darwin', arch, executable: 'SiYuan-Kernel' };
    } else if (platform === 'linux') {
        return { platform: 'linux', arch, executable: 'SiYuan-Kernel' };
    } else {
        throw new Error(`不支持的操作系统: ${platform}`);
    }
}

// 检查依赖
function checkDependencies() {
    logStep('检查依赖');
    
    try {
        // 检查 Go
        const goVersion = execSync('go version', { encoding: 'utf8' });
        logSuccess(`Go: ${goVersion.trim()}`);
    } catch (error) {
        logError('Go 未安装或不在 PATH 中');
        process.exit(1);
    }
    
    try {
        // 检查 pnpm
        const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' });
        logSuccess(`pnpm: ${pnpmVersion.trim()}`);
    } catch (error) {
        logError('pnpm 未安装或不在 PATH 中');
        process.exit(1);
    }
    
    // 检查必要目录
    const requiredDirs = ['kernel', 'app'];
    for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
            logError(`目录不存在: ${dir}`);
            process.exit(1);
        }
    }
    
    logSuccess('依赖检查完成');
}

// 编译内核
function buildKernel() {
    logStep('编译内核');
    
    const { platform, arch, executable } = getPlatform();
    const kernelDir = path.join(process.cwd(), 'kernel');
    const outputDir = path.join(process.cwd(), 'app', 'kernel');
    const outputPath = path.join(outputDir, executable);
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    

    try {
        logInfo(`编译内核中`);
        
        // 构建命令行参数
        const buildArgs = ['build', '--tags', 'fts5', '-o', outputPath];
    
        
        // 使用 spawn 而不是 execSync 来避免参数解析问题
        const { spawnSync } = require('child_process');
        const result = spawnSync('go', buildArgs, {
            cwd: kernelDir,
            env: {
                ...process.env,
                CGO_ENABLED: '1'  // 禁用CGO以避免需要GCC编译器
            },
            stdio: 'inherit'
        });
        
        if (result.status !== 0) {
            throw new Error(`编译失败，退出代码: ${result.status}`);
        }
        
        logSuccess(`内核编译完成: ${outputPath}`);
    } catch (error) {
        logError('内核编译失败');
        console.error(error);
        process.exit(1);
    }
}

// 启动内核
function startKernel() {
    logStep('启动内核');
    
    const { platform, executable } = getPlatform();
    const kernelPath = path.join(process.cwd(), 'app', 'kernel', executable);
    const appDir = path.join(process.cwd(), 'app');
    
    if (!fs.existsSync(kernelPath)) {
        logError(`内核文件不存在: ${kernelPath}`);
        process.exit(1);
    }
    
    logInfo(`启动内核: ${kernelPath}`);
    logInfo(`工作目录: ${appDir}`);
    logInfo(`模式: dev`);
    
    const kernelProcess = spawn(kernelPath, ['--wd=.', '--mode=dev'], {
        cwd: appDir,
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'development'
        }
    });
    
    kernelProcess.on('error', (error) => {
        logError(`内核启动失败: ${error.message}`);
        process.exit(1);
    });
    
    kernelProcess.on('exit', (code) => {
        if (code === 0) {
            logSuccess('内核正常退出');
        } else {
            logError(`内核异常退出，代码: ${code}`);
        }
    });
    
    // 处理进程信号
    process.on('SIGINT', () => {
        logInfo('收到中断信号，正在关闭内核...');
        kernelProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        logInfo('收到终止信号，正在关闭内核...');
        kernelProcess.kill('SIGTERM');
    });
}

// 主函数
function main() {
    log(`${colors.bright}${colors.magenta}🚀 SiYuan 开发环境启动脚本${colors.reset}`);
    log(`${colors.cyan}版本: 1.0.0${colors.reset}`);
    log(`${colors.cyan}作者: 织${colors.reset}\n`);
    
    try {
        const { platform, arch } = getPlatform();
        logInfo(`检测到平台: ${platform} (${arch})`);
        
        checkDependencies();
        buildKernel();
        startKernel();
        
    } catch (error) {
        logError(`启动失败: ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = {
    getPlatform,
    checkDependencies,
    buildKernel,
    startKernel
}; 