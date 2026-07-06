#!/usr/bin/env node

/**
 * 单文件 ESLint 检查工具
 * 用于检查指定文件的 lint 错误，支持格式化输出和 JSON 格式
 */

const path = require("path");
const fs = require("fs");

// 动态加载 ESLint，确保从正确的目录加载
function loadESLint(cwd) {
    const eslintPath = path.join(cwd, "node_modules", "eslint");
    try {
        const { ESLint } = require(eslintPath);
        return ESLint;
    } catch (error) {
        // 如果从指定目录加载失败，尝试全局加载
        try {
            const { ESLint } = require("eslint");
            return ESLint;
        } catch (globalError) {
            throw new Error(`无法加载 ESLint 模块。请确保在 ${cwd} 目录下安装了 eslint 依赖。\n原始错误: ${error.message}`);
        }
    }
}

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        filePath: null,
        json: false,
        help: false,
        cwd: null,
        showAll: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case "--json":
                options.json = true;
                break;
            case "--help":
            case "-h":
                options.help = true;
                break;
            case "--cwd":
                options.cwd = args[++i];
                break;
            case "--show-all":
                options.showAll = true;
                break;
            default:
                if (!options.filePath && !arg.startsWith("--")) {
                    options.filePath = arg;
                }
                break;
        }
    }

    return options;
}

// 显示帮助信息
function showHelp() {
    console.log(`
单文件 ESLint 检查工具

用法:
  pnpm lint:file <文件路径> [选项]

选项:
  --json          输出 JSON 格式结果
  --show-all      显示所有优先级的错误（跳过优先级过滤）
  --cwd <目录>    指定工作目录 (默认: app 目录)
  --help, -h      显示此帮助信息

示例:
  pnpm lint:file src/util/events/eventEmitter.ts
  pnpm lint:file src/util/events/eventEmitter.ts --json
  pnpm lint:file src/util/events/eventEmitter.ts --show-all

注意:
  - 文件路径可以是相对于 app 目录的路径
  - JSON 输出便于程序化处理结果
  - --show-all 可绕过优先级过滤，查看被隐藏的低优先级错误
`);
}

// 动态加载优先级查询函数（从 priority-config.mjs 间接导入 priority-lint.mjs）
// 使用动态 import 因为 priority-config.mjs 是 ESM 模块
let _getPriorityFn = null;
async function getPriorityFn(appDir) {
    if (_getPriorityFn) return _getPriorityFn;
    try {
        const modulePath = "file://" + path.join(appDir, "0_lints", "priority-config.mjs").replace(/\\/g, "/");
        const mod = await import(modulePath);
        _getPriorityFn = mod.getPriority;
    } catch {
        // 加载失败时返回默认优先级
        _getPriorityFn = () => 15;
    }
    return _getPriorityFn;
}

// 格式化输出单个错误（含优先级标注）
function formatError(error, filePath, getPriority) {
    const severity = error.severity === 2 ? "ERROR" : "WARN";
    const ruleId = error.ruleId || "unknown";
    const priorityLabel = error.severity === 2 ? `[P${getPriority(error.ruleId)}]` : "[W]";
    
    return `${filePath}:${error.line}:${error.column} ${priorityLabel} [${severity}] ${error.message} (${ruleId})`;
}

// 格式化输出结果
async function formatResults(results, getPriority) {
    if (!results || results.length === 0) {
        return "✅ 没有发现 lint 错误";
    }

    const result = results[0];
    const { filePath, messages } = result;
    
    if (messages.length === 0) {
        return "✅ 没有发现 lint 错误";
    }

    const output = [];
    output.push(`\n📁 文件: ${filePath}`);
    output.push(`🔍 发现 ${messages.length} 个问题:\n`);

    messages.forEach((message, index) => {
        output.push(`${index + 1}. ${formatError(message, path.basename(filePath), getPriority)}`);
    });

    // 统计错误和警告数量
    const errors = messages.filter(m => m.severity === 2).length;
    const warnings = messages.filter(m => m.severity === 1).length;
    
    output.push(`\n📊 统计: ${errors} 个错误, ${warnings} 个警告`);
    
    return output.join("\n");
}

// 主函数
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    if (!options.filePath) {
        console.error("❌ 错误: 请提供要检查的文件路径");
        console.error("使用 --help 查看使用说明");
        process.exit(1);
    }

    // 确定工作目录 - 脚本现在位于 app/scripts，所以默认 cwd 是 app 目录
    const cwd = options.cwd || path.join(__dirname, "..");
    
    // 检查工作目录是否存在
    if (!fs.existsSync(cwd)) {
        console.error(`❌ 错误: 工作目录不存在: ${cwd}`);
        process.exit(1);
    }

    // 解析文件路径
    let targetFile;
    if (path.isAbsolute(options.filePath)) {
        targetFile = options.filePath;
    } else {
        targetFile = path.resolve(cwd, options.filePath);
    }

    // 检查文件是否存在
    if (!fs.existsSync(targetFile)) {
        console.error(`❌ 错误: 文件不存在: ${targetFile}`);
        process.exit(1);
    }

    try {
        // --show-all 模式：设置环境变量让 processor 跳过优先级过滤
        if (options.showAll) {
            process.env.PRIORITY_LINT_SHOW_ALL = "1";
        }

        // 加载优先级查询函数
        const getPriority = await getPriorityFn(cwd);

        // 动态加载 ESLint 类
        const ESLint = loadESLint(cwd);
        
        // 创建 ESLint 实例
        const eslint = new ESLint({
            cwd: cwd,
            overrideConfigFile: path.join(cwd, "eslint.config.mjs")
        });

        // 检查文件
        console.error(`🔍 正在检查文件: ${path.relative(cwd, targetFile)}` + (options.showAll ? " (--show-all 模式，跳过优先级过滤)" : ""));
        const results = await eslint.lintFiles([targetFile]);

        if (options.json) {
            // JSON 输出（在每条 message 中添加 priority 字段）
            const messages = (results[0]?.messages || []).map(msg => ({
                ...msg,
                priority: msg.severity === 2 ? getPriority(msg.ruleId) : null,
            }));
            const jsonOutput = {
                filePath: targetFile,
                relativePath: path.relative(cwd, targetFile),
                errorCount: results[0]?.errorCount || 0,
                warningCount: results[0]?.warningCount || 0,
                showAll: options.showAll,
                messages,
            };
            console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
            // 格式化输出
            console.log(await formatResults(results, getPriority));
        }

        // 设置退出码
        const hasErrors = results.some(result => result.errorCount > 0);
        process.exit(hasErrors ? 1 : 0);

    } catch (error) {
        console.error(`❌ ESLint 检查失败: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main().catch(error => {
        console.error(`❌ 未处理的错误: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main, parseArgs, formatResults };
