/**
 * 校验 apiDefs 与 rawApiList.json (来自 router.go) 的一致性
 * 
 * 检查项：
 * 1. rawApiList 中有但 apiDefs 中没有的 (新增 API，需补充定义)
 * 2. apiDefs 中有但 rawApiList 中没有的 (需标记 deprecated)
 * 3. en、needAuth 等属性是否一致
 * 4. zh_cn、description 是否填写
 */
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { allApiDefs } from '../src/apiDefs/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const 根目录 = join(__dirname, '..');

const RAW_API_LIST_PATH = join(根目录, 'rawApiList.json');
const RESULT_FILE_PATH = join(根目录, 'sync_check_result.md');

/** 原始 API 信息 */
interface 原始Api {
    method: string;
    endpoint: string;
    en: string;
    needAuth: boolean;
    needAdminRole: boolean;
    unavailableIfReadonly: boolean;
    otherAuthChecks: string[];
}

/** API 定义 */
interface ApiDef {
    method: string;
    endpoint: string;
    en: string;
    zh_cn?: string;
    description?: string;
    needAuth?: boolean;
    needAdminRole?: boolean;
    unavailableIfReadonly?: boolean;
    deprecated?: boolean;
    zodRequestSchema?: unknown;
    zodResponseSchema?: unknown;
}

/** 校验问题 */
interface 校验问题 {
    类型: string;
    分组: string;
    method?: string;
    endpoint?: string;
    消息: string;
    期望?: unknown;
    实际?: unknown;
}

async function main() {
    // 检查 rawApiList.json 是否存在
    let rawApiList: 原始Api[];
    try {
        const content = await readFile(RAW_API_LIST_PATH, 'utf8');
        rawApiList = JSON.parse(content);
    } catch {
        console.error(`错误: 未找到 ${RAW_API_LIST_PATH}`);
        console.error('请先运行 pnpm sync:update 从 GitHub 获取 API 列表');
        process.exit(1);
    }

    // 按分组整理原始 API
    const 分组RawApis = new Map<string, 原始Api[]>();
    for (const api of rawApiList) {
        const parts = api.endpoint.split('/');
        const groupName = (parts.length > 2 && parts[1] === 'api') ? parts[2] : 'misc';
        if (!分组RawApis.has(groupName)) {
            分组RawApis.set(groupName, []);
        }
        分组RawApis.get(groupName)!.push(api);
    }

    console.log('开始校验 API 定义...\n');
    const 问题列表: 校验问题[] = [];

    // 从 allApiDefs 构建所有已定义的 API 映射
    // 键: "method endpoint", 值: { def, groupName }
    const 已定义APIs = new Map<string, { def: ApiDef; groupName: string }>();
    for (const [groupName, defs] of Object.entries(allApiDefs)) {
        for (const def of defs) {
            const key = `${def.method} ${def.endpoint}`;
            已定义APIs.set(key, { def: def as ApiDef, groupName });
        }
    }

    // 遍历每个分组检查
    for (const [groupName, rawApis] of 分组RawApis) {
        // 检查该分组是否有定义
        const groupDefs = allApiDefs[groupName];

        if (!groupDefs || groupDefs.length === 0) {
            // 该分组没有任何定义
            问题列表.push({
                类型: '缺失定义文件',
                分组: groupName,
                消息: `分组 ${groupName} 没有 API 定义，该分组有 ${rawApis.length} 个 API 需要定义`,
            });
            for (const api of rawApis) {
                问题列表.push({
                    类型: '缺失API定义',
                    分组: groupName,
                    method: api.method,
                    endpoint: api.endpoint,
                    消息: `${api.method} ${api.endpoint} (${api.en}) 需要添加定义`,
                });
            }
            continue;
        }

        const 已处理端点 = new Set<string>();

        // 检查定义中的 API
        for (const def of groupDefs) {
            const key = `${def.method} ${def.endpoint}`;
            已处理端点.add(key);

            const rawMatch = rawApis.find(r => r.method === def.method && r.endpoint === def.endpoint);

            if (!rawMatch) {
                // 定义中有但 rawApiList 中没有
                if (!def.deprecated) {
                    问题列表.push({
                        类型: '应标记废弃',
                        分组: groupName,
                        method: def.method,
                        endpoint: def.endpoint,
                        消息: `${def.method} ${def.endpoint} 不在 rawApiList 中，应设置 deprecated: true`,
                    });
                }
                continue;
            }

            // 校验属性一致性
            if (def.deprecated) {
                问题列表.push({
                    类型: '不应标记废弃',
                    分组: groupName,
                    method: def.method,
                    endpoint: def.endpoint,
                    消息: `${def.method} ${def.endpoint} 存在于 rawApiList，不应标记为废弃`,
                });
            }

            if (def.en !== rawMatch.en) {
                问题列表.push({
                    类型: 'en不匹配',
                    分组: groupName,
                    method: def.method,
                    endpoint: def.endpoint,
                    消息: `en 不匹配`,
                    期望: rawMatch.en,
                    实际: def.en,
                });
            }

            // 检查认证标志
            const defAuth = {
                needAuth: def.needAuth ?? false,
                needAdminRole: def.needAdminRole ?? false,
                unavailableIfReadonly: def.unavailableIfReadonly ?? false,
            };
            const rawAuth = {
                needAuth: rawMatch.needAuth,
                needAdminRole: rawMatch.needAdminRole,
                unavailableIfReadonly: rawMatch.unavailableIfReadonly,
            };
            if (JSON.stringify(defAuth) !== JSON.stringify(rawAuth)) {
                问题列表.push({
                    类型: '认证标志不匹配',
                    分组: groupName,
                    method: def.method,
                    endpoint: def.endpoint,
                    消息: `认证标志不一致`,
                    期望: rawAuth,
                    实际: defAuth,
                });
            }

            // 检查必填字段
            if (!def.zh_cn?.trim()) {
                问题列表.push({
                    类型: '缺失zh_cn',
                    分组: groupName,
                    method: def.method,
                    endpoint: def.endpoint,
                    消息: `缺少中文名称 (zh_cn)`,
                });
            }

            if (!def.description?.trim()) {
                问题列表.push({
                    类型: '缺失description',
                    分组: groupName,
                    method: def.method,
                    endpoint: def.endpoint,
                    消息: `缺少描述 (description)`,
                });
            }
        }

        // 检查 rawApiList 中有但定义中没有的
        for (const api of rawApis) {
            const key = `${api.method} ${api.endpoint}`;
            if (!已处理端点.has(key)) {
                问题列表.push({
                    类型: '缺失API定义',
                    分组: groupName,
                    method: api.method,
                    endpoint: api.endpoint,
                    消息: `${api.method} ${api.endpoint} (${api.en}) 在 rawApiList 中但未定义`,
                });
            }
        }
    }

    // 输出结果
    const 输出到文件: string[] = [];
    输出到文件.push(`# API 定义同步检查结果`);
    输出到文件.push(`\n检查时间: ${new Date().toLocaleString('zh-CN')}\n`);

    if (问题列表.length === 0) {
        const msg = '✅ 校验通过，所有 API 定义与 rawApiList.json 一致';
        console.log(msg + '\n');
        输出到文件.push(msg);
        await writeFile(RESULT_FILE_PATH, 输出到文件.join('\n'), 'utf-8');
        console.log(`结果已写入: ${RESULT_FILE_PATH}`);
        return;
    }

    const summaryMsg = `\n发现 ${问题列表.length} 个问题:\n`;
    console.warn(summaryMsg);
    输出到文件.push(`## 发现 ${问题列表.length} 个问题\n`);

    // 按类型分组输出
    const 按类型分组 = new Map<string, 校验问题[]>();
    for (const issue of 问题列表) {
        if (!按类型分组.has(issue.类型)) {
            按类型分组.set(issue.类型, []);
        }
        按类型分组.get(issue.类型)!.push(issue);
    }

    for (const [type, issues] of [...按类型分组].sort((a, b) => a[0].localeCompare(b[0]))) {
        const header = `\n--- ${type} (${issues.length}) ---`;
        console.warn(header);
        输出到文件.push(`\n### ${type} (${issues.length})\n`);

        for (const issue of issues) {
            let detail = `[${issue.分组}] ${issue.method ?? ''} ${issue.endpoint ?? ''}: ${issue.消息}`;
            if (issue.期望 !== undefined) {
                detail += `\n    期望: ${JSON.stringify(issue.期望)}`;
                detail += `\n    实际: ${JSON.stringify(issue.实际)}`;
            }
            console.warn(detail);
            输出到文件.push(`- \`${issue.分组}\` ${issue.method ?? ''} \`${issue.endpoint ?? ''}\`: ${issue.消息}`);
            if (issue.期望 !== undefined) {
                输出到文件.push(`  - 期望: \`${JSON.stringify(issue.期望)}\``);
                输出到文件.push(`  - 实际: \`${JSON.stringify(issue.实际)}\``);
            }
        }
    }

    const finalMsg = `\n共处理 ${分组RawApis.size} 个 API 分组，allApiDefs 中有 ${Object.keys(allApiDefs).length} 个模块`;
    console.log(finalMsg);
    输出到文件.push(`\n---\n\n共处理 ${分组RawApis.size} 个 API 分组`);

    await writeFile(RESULT_FILE_PATH, 输出到文件.join('\n'), 'utf-8');
    console.log(`\n结果已写入: ${RESULT_FILE_PATH}`);
    process.exit(1);
}

main().catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
});
