#!/usr/bin/env node

/**
 * Lint错误类型统计工具
 * 扫描项目中所有源文件，按规则ID统计错误数量
 */

const path = require("path");

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

async function main() {
    const cwd = process.cwd();
    const ESLint = loadESLint(cwd);

    const eslint = new ESLint({ cwd });

    console.log("🔍 正在扫描项目文件...");
    const results = await eslint.lintFiles(["src/**/*.{ts,tsx,js,jsx}"]);
    console.log(`📁 扫描完成, 共检查 ${results.length} 个文件`);

    const ruleStats = {};
    let totalErrors = 0;
    let totalWarnings = 0;
    let filesWithIssues = 0;

    for (const result of results) {
        if (result.messages.length > 0) {
            filesWithIssues++;
        }
        for (const msg of result.messages) {
            const ruleId = msg.ruleId || "parse-error";
            const severity = msg.severity; // 1=warning, 2=error
            if (!ruleStats[ruleId]) {
                ruleStats[ruleId] = { errors: 0, warnings: 0, total: 0 };
            }
            if (severity === 2) {
                ruleStats[ruleId].errors++;
                totalErrors++;
            } else {
                ruleStats[ruleId].warnings++;
                totalWarnings++;
            }
            ruleStats[ruleId].total++;
        }
    }

    const sorted = Object.entries(ruleStats)
        .sort((a, b) => b[1].total - a[1].total);

    const isJson = process.argv.includes("--json");

    if (isJson) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            totalFiles: results.length,
            filesWithIssues,
            summary: { totalErrors, totalWarnings },
            rules: sorted.map(([rule, stats]) => ({ rule, ...stats }))
        }, null, 2));
    } else {
        console.log("\n📊 Lint错误按规则统计:\n");
        console.log("┌────┬────────┬────────┬────────┬─────────────────────────────────────────────┐");
        console.log("│ #  │ 错误   │ 警告   │ 总计   │ 规则ID                                      │");
        console.log("├────┼────────┼────────┼────────┼─────────────────────────────────────────────┤");
        sorted.forEach(([rule, stats], i) => {
            const num = String(i + 1).padStart(2);
            const err = String(stats.errors).padStart(5);
            const warn = String(stats.warnings).padStart(5);
            const tot = String(stats.total).padStart(5);
            console.log(`│ ${num} │ ${err}  │ ${warn}  │ ${tot}  │ ${rule.padEnd(43)} │`);
        });
        console.log("└────┴────────┴────────┴────────┴─────────────────────────────────────────────┘");
        console.log(`\n📈 汇总: ${filesWithIssues} 个文件有问题, 共 ${totalErrors} 个错误, ${totalWarnings} 个警告, ${sorted.length} 种规则`);
    }

    process.exit(filesWithIssues > 0 ? 1 : 0);
}

main().catch(err => {
    console.error("执行失败:", err.message);
    process.exit(2);
});
