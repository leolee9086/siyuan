#!/usr/bin/env node

/**
 * Lint错误统计工具
 * 扫描项目中所有源文件，列出lint错误最多的文件
 */

const path = require("path");
const fs = require("fs");

/**
 * 动态加载ESLint模块
 * @param {string} cwd - 工作目录
 * @returns {typeof import('eslint').ESLint} ESLint类
 */
function loadESLint(cwd) {
    const eslintPath = path.join(cwd, "node_modules", "eslint");
    try {
        const { ESLint } = require(eslintPath);
        return ESLint;
    } catch (error) {
        try {
            const { ESLint } = require("eslint");
            return ESLint;
        } catch (globalError) {
            throw new Error(
                `无法加载 ESLint 模块。请确保在 ${cwd} 目录下安装了 eslint 依赖。\n原始错误: ${error.message}`
            );
        }
    }
}

/**
 * 解析命令行参数
 * @returns {{top: number, json: boolean, help: boolean, cwd: string | null}}
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        top: 10,
        json: false,
        help: false,
        cwd: null
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--top" || arg === "-n") {
            const num = parseInt(args[++i], 10);
            if (!isNaN(num) && num > 0) {
                options.top = num;
            }
        }
        if (arg === "--json") {
            options.json = true;
        }
        if (arg === "--help" || arg === "-h") {
            options.help = true;
        }
        if (arg === "--cwd") {
            options.cwd = args[++i];
        }
    }

    return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
Lint错误统计工具 - 列出lint错误最多的文件

用法:
  pnpm lint:top [选项]

选项:
  --top, -n <数量>  显示前N个文件 (默认: 10)
  --json            输出JSON格式结果
  --cwd <目录>      指定工作目录 (默认: app目录)
  --help, -h        显示此帮助信息

示例:
  pnpm lint:top              # 显示错误最多的10个文件
  pnpm lint:top -n 20        # 显示错误最多的20个文件
  pnpm lint:top --json       # JSON格式输出
`);
}

/**
 * 格式化文件统计结果为表格
 * @param {Array<{file: string, errors: number, warnings: number, total: number}>} stats
 * @param {number} top
 * @returns {string}
 */
function formatTable(stats, top) {
    if (stats.length === 0) {
        return "✅ 没有发现任何lint错误";
    }

    const lines = [];
    lines.push(`\n📊 Lint错误最多的 ${Math.min(top, stats.length)} 个文件:\n`);
    lines.push("┌────┬────────┬────────┬────────┬─────────────────────────────────────────────────────┐");
    lines.push("│ #  │ 错误   │ 警告   │ 总计   │ 文件路径                                            │");
    lines.push("├────┼────────┼────────┼────────┼─────────────────────────────────────────────────────┤");

    const topStats = stats.slice(0, top);
    for (let i = 0; i < topStats.length; i++) {
        const stat = topStats[i];
        const num = String(i + 1).padStart(2);
        const errors = String(stat.errors).padStart(6);
        const warnings = String(stat.warnings).padStart(6);
        const total = String(stat.total).padStart(6);
        const filePath = stat.file.length > 51 
            ? "..." + stat.file.slice(-48) 
            : stat.file.padEnd(51);
        lines.push(`│ ${num} │ ${errors} │ ${warnings} │ ${total} │ ${filePath} │`);
    }

    lines.push("└────┴────────┴────────┴────────┴─────────────────────────────────────────────────────┘");

    // 汇总统计
    const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);
    const totalWarnings = stats.reduce((sum, s) => sum + s.warnings, 0);
    const filesWithErrors = stats.length;

    lines.push(`\n📈 汇总: ${filesWithErrors} 个文件有问题, 共 ${totalErrors} 个错误, ${totalWarnings} 个警告`);

    return lines.join("\n");
}

/**
 * 主函数
 */
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    const cwd = options.cwd || path.join(__dirname, "..");

    if (!fs.existsSync(cwd)) {
        console.error(`❌ 错误: 工作目录不存在: ${cwd}`);
        process.exit(1);
    }

    try {
        const ESLint = loadESLint(cwd);

        const eslint = new ESLint({
            cwd: cwd,
            overrideConfigFile: path.join(cwd, "eslint.config.mjs"),
            warnIgnored: true
        });

        console.error("🔍 正在扫描项目文件...");

        // 使用单一glob模式，避免不存在的文件类型导致错误
        const results = await eslint.lintFiles(["src/**/*.{ts,tsx,vue,mjs}"]);

        console.error(`📁 扫描完成, 共检查 ${results.length} 个文件`);

        // 统计每个文件的错误数
        const fileStats = results
            .filter(r => r.errorCount > 0 || r.warningCount > 0)
            .map(r => ({
                file: path.relative(cwd, r.filePath),
                errors: r.errorCount,
                warnings: r.warningCount,
                total: r.errorCount + r.warningCount
            }))
            .sort((a, b) => b.total - a.total);

        if (options.json) {
            const output = {
                timestamp: new Date().toISOString(),
                totalFiles: results.length,
                filesWithIssues: fileStats.length,
                topFiles: fileStats.slice(0, options.top),
                summary: {
                    totalErrors: fileStats.reduce((sum, s) => sum + s.errors, 0),
                    totalWarnings: fileStats.reduce((sum, s) => sum + s.warnings, 0)
                }
            };
            console.log(JSON.stringify(output, null, 2));
        }

        if (!options.json) {
            console.log(formatTable(fileStats, options.top));
        }

        const hasErrors = fileStats.some(s => s.errors > 0);
        process.exit(hasErrors ? 1 : 0);

    } catch (error) {
        console.error(`❌ ESLint 扫描失败: ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error(`❌ 未处理的错误: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main, parseArgs, formatTable };
