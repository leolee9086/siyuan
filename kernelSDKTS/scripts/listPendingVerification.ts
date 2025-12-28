/**
 * 待核对 API 列表脚本
 * 
 * 功能：列出需要核对的 API，按优先级排序
 * 用法：pnpm verify:list
 */

import { allApiDefs } from '../src/apiDefs';

// ========== 类型定义 ==========

interface 待核对Api {
    endpoint: string;
    en: string;
    file: string;
    lastVerified: string | null;
    daysSinceVerified: number | null;
    priority: '从未核对' | '高优先级' | '中优先级' | '低优先级';
}

// ========== 工具函数 ==========

/** 计算从某日期到现在的天数 */
function daysSince(日期字符串: string): number {
    const date = new Date(日期字符串);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** 根据上次核对日期确定优先级 */
function getPriority(lastVerified?: string): 待核对Api['priority'] {
    if (!lastVerified) return '从未核对';
    const days = daysSince(lastVerified);
    if (days > 30) return '高优先级';
    if (days > 14) return '中优先级';
    return '低优先级';
}

/** 优先级排序权重 */
const 优先级权重: Record<待核对Api['priority'], number> = {
    '从未核对': 0,
    '高优先级': 1,
    '中优先级': 2,
    '低优先级': 3,
};

/** 优先级对应的图标 */
const 优先级图标: Record<待核对Api['priority'], string> = {
    '从未核对': '🔴',
    '高优先级': '🟠',
    '中优先级': '🟡',
    '低优先级': '🟢',
};

// ========== 主函数 ==========

function main() {
    const pending: 待核对Api[] = [];
    let totalApiCount = 0;

    // 遍历所有 API 定义
    for (const [file, defs] of Object.entries(allApiDefs)) {
        for (const api of defs) {
            totalApiCount++;
            const priority = getPriority(api.lastVerified);

            // 只收集非低优先级的 API
            if (priority !== '低优先级') {
                pending.push({
                    endpoint: api.endpoint,
                    en: api.en,
                    file: `${file}.ts`,
                    lastVerified: api.lastVerified ?? null,
                    daysSinceVerified: api.lastVerified ? daysSince(api.lastVerified) : null,
                    priority,
                });
            }
        }
    }

    // 按优先级排序
    pending.sort((a, b) => 优先级权重[a.priority] - 优先级权重[b.priority]);

    // 统计各优先级数量
    const stats = {
        '从未核对': pending.filter(a => a.priority === '从未核对').length,
        '高优先级': pending.filter(a => a.priority === '高优先级').length,
        '中优先级': pending.filter(a => a.priority === '中优先级').length,
        '低优先级': totalApiCount - pending.length,
    };

    // 输出结果
    console.log('\n📋 待核对 API 列表');
    console.log('='.repeat(80));
    console.log(`\n📊 统计：共 ${totalApiCount} 个 API`);
    console.log(`   🔴 从未核对: ${stats['从未核对']} 个`);
    console.log(`   🟠 高优先级 (>30天): ${stats['高优先级']} 个`);
    console.log(`   🟡 中优先级 (>14天): ${stats['中优先级']} 个`);
    console.log(`   🟢 低优先级 (近期已核对): ${stats['低优先级']} 个`);
    console.log();
    console.log('='.repeat(80));

    if (pending.length === 0) {
        console.log('\n✅ 所有 API 都已在近期核对过，无需立即处理！\n');
        return;
    }

    // 显示待核对列表（最多显示 20 个）
    const displayCount = Math.min(pending.length, 20);
    console.log(`\n🔍 前 ${displayCount} 个待核对 API：\n`);

    for (const api of pending.slice(0, displayCount)) {
        const icon = 优先级图标[api.priority];
        const priorityText = api.priority.padEnd(6);
        const status = api.lastVerified
            ? `${api.daysSinceVerified} 天前`
            : '从未核对';

        console.log(`${icon} [${priorityText}] ${api.endpoint}`);
        console.log(`   └─ ${api.file} :: ${api.en} (${status})`);
    }

    if (pending.length > displayCount) {
        console.log(`\n... 还有 ${pending.length - displayCount} 个待核对 API`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('💡 提示：运行 pnpm verify:report 生成详细报告');
    console.log('='.repeat(80) + '\n');
}

main();
