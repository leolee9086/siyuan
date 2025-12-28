/**
 * 核对状态报告生成器
 * 
 * 功能：生成 API 核对状态的详细 Markdown 报告
 * 用法：pnpm verify:report
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { allApiDefs } from '../src/apiDefs';

// ========== 工具函数 ==========

/** 计算从某日期到现在的天数 */
function daysSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** 获取今天的 ISO 日期字符串 */
function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

/** 根据上次核对日期确定优先级 */
function getPriority(lastVerified?: string): string {
    if (!lastVerified) return '从未核对';
    const days = daysSince(lastVerified);
    if (days > 30) return '高优先级';
    if (days > 14) return '中优先级';
    return '低优先级';
}

// ========== 主函数 ==========

interface FileStats {
    fileName: string;
    total: number;
    never: number;
    high: number;
    medium: number;
    low: number;
    apis: Array<{
        en: string;
        endpoint: string;
        lastVerified: string | null;
        priority: string;
    }>;
}

function main() {
    const today = getToday();
    const fileStats: FileStats[] = [];
    let grandTotal = 0;
    let grandNever = 0;
    let grandHigh = 0;
    let grandMedium = 0;
    let grandLow = 0;

    // 遍历所有文件
    for (const [fileName, defs] of Object.entries(allApiDefs)) {
        const stats: FileStats = {
            fileName: `${fileName}.ts`,
            total: defs.length,
            never: 0,
            high: 0,
            medium: 0,
            low: 0,
            apis: [],
        };

        for (const api of defs) {
            const priority = getPriority(api.lastVerified);

            if (priority === '从未核对') stats.never++;
            else if (priority === '高优先级') stats.high++;
            else if (priority === '中优先级') stats.medium++;
            else stats.low++;

            stats.apis.push({
                en: api.en,
                endpoint: api.endpoint,
                lastVerified: api.lastVerified ?? null,
                priority,
            });
        }

        grandTotal += stats.total;
        grandNever += stats.never;
        grandHigh += stats.high;
        grandMedium += stats.medium;
        grandLow += stats.low;

        fileStats.push(stats);
    }

    // 按待核对数量排序（从未核对 + 高优先级）
    fileStats.sort((a, b) => (b.never + b.high) - (a.never + a.high));

    // 生成报告
    const lines: string[] = [];

    lines.push('# API 核对状态报告');
    lines.push('');
    lines.push(`> 生成时间: ${today}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📊 总览');
    lines.push('');
    lines.push(`| 指标 | 数量 | 占比 |`);
    lines.push('|------|------|------|');
    lines.push(`| 总计 | ${grandTotal} | 100% |`);
    lines.push(`| 🔴 从未核对 | ${grandNever} | ${(grandNever / grandTotal * 100).toFixed(1)}% |`);
    lines.push(`| 🟠 高优先级 (>30天) | ${grandHigh} | ${(grandHigh / grandTotal * 100).toFixed(1)}% |`);
    lines.push(`| 🟡 中优先级 (>14天) | ${grandMedium} | ${(grandMedium / grandTotal * 100).toFixed(1)}% |`);
    lines.push(`| 🟢 低优先级 (近期已核对) | ${grandLow} | ${(grandLow / grandTotal * 100).toFixed(1)}% |`);
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 📁 按文件统计');
    lines.push('');
    lines.push('| 文件 | 总数 | 🔴 从未 | 🟠 高 | 🟡 中 | 🟢 低 |');
    lines.push('|------|------|---------|-------|-------|------|');

    for (const stats of fileStats) {
        lines.push(
            `| ${stats.fileName} | ${stats.total} | ${stats.never} | ${stats.high} | ${stats.medium} | ${stats.low} |`
        );
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## 🔴 从未核对的 API');
    lines.push('');

    let hasNeverVerified = false;
    for (const stats of fileStats) {
        const neverApis = stats.apis.filter(a => a.priority === '从未核对');
        if (neverApis.length > 0) {
            hasNeverVerified = true;
            lines.push(`### ${stats.fileName}`);
            lines.push('');
            for (const api of neverApis) {
                lines.push(`- \`${api.endpoint}\` - ${api.en}`);
            }
            lines.push('');
        }
    }

    if (!hasNeverVerified) {
        lines.push('✅ 所有 API 都已核对过至少一次！');
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('## 🟠 高优先级待核对 (>30天)');
    lines.push('');

    let hasHighPriority = false;
    for (const stats of fileStats) {
        const highApis = stats.apis.filter(a => a.priority === '高优先级');
        if (highApis.length > 0) {
            hasHighPriority = true;
            lines.push(`### ${stats.fileName}`);
            lines.push('');
            for (const api of highApis) {
                const days = api.lastVerified ? daysSince(api.lastVerified) : 0;
                lines.push(`- \`${api.endpoint}\` - ${api.en} (${days}天前)`);
            }
            lines.push('');
        }
    }

    if (!hasHighPriority) {
        lines.push('✅ 没有超过 30 天未核对的 API！');
        lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*报告结束*');

    // 写入文件
    const reportPath = path.join(process.cwd(), 'VERIFICATION_STATUS.md');
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');

    console.log(`\n✅ 报告已生成: ${reportPath}\n`);
    console.log('📊 快速统计:');
    console.log(`   总计: ${grandTotal} 个 API`);
    console.log(`   🔴 从未核对: ${grandNever} 个`);
    console.log(`   🟠 高优先级: ${grandHigh} 个`);
    console.log(`   🟡 中优先级: ${grandMedium} 个`);
    console.log(`   🟢 低优先级: ${grandLow} 个\n`);
}

main();
