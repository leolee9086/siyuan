/**
 * 从 GitHub 获取 router.go 并解析 API 列表
 * 
 * 功能：
 * 1. 从 GitHub 获取最新的 router.go
 * 2. 解析出所有 API 端点信息
 * 3. 生成 rawApiList.json 用于后续校验
 * 4. 生成变更报告 diff.md
 */
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const 根目录 = join(__dirname, '..');

const GITHUB_ROUTER_GO_URL = 'https://raw.githubusercontent.com/siyuan-note/siyuan/master/kernel/api/router.go';
const 输出文件 = 'rawApiList.json';
const 差异报告文件 = 'diff.md';

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

/** 差异比较结果 */
interface 差异结果 {
    新增: 原始Api[];
    移除: 原始Api[];
    变更: { old: 原始Api; new: 原始Api }[];
}

async function 获取RouterGo(): Promise<string> {
    console.log('正在从 GitHub 获取 router.go ...');
    const response = await fetch(GITHUB_ROUTER_GO_URL);
    if (!response.ok) {
        throw new Error(`获取 router.go 失败: ${response.status} ${response.statusText}`);
    }
    return response.text();
}

function 解析Go代码(goContent: string): 原始Api[] {
    const rawApis: 原始Api[] = [];
    const lines = goContent.split('\n');

    // 查找各个路由注册函数的起始位置
    const 函数起始列表 = [
        lines.findIndex(line => line.includes('func ServeAPI(ginServer *gin.Engine)')),
        lines.findIndex(line => line.includes('func ConfAPIRoute(ginServer *gin.Engine)')),
        lines.findIndex(line => line.includes('func APIRouteV2(ginServer *gin.Engine)')),
    ];

    const 处理行 = (startIndex: number) => {
        if (startIndex === -1) return;

        for (let i = startIndex; i < lines.length; i++) {
            let line = lines[i].trim();
            // 遇到下一个函数或函数结束就停止
            if (i > startIndex && (line.startsWith('func ') || line === '}')) break;
            // 跳过注释和非 Handle 行
            if (line.startsWith('//') || !line.includes('ginServer.Handle(')) continue;
            // 移除行内注释
            line = line.split('//')[0].trim();
            if (!line) continue;

            // 匹配 ginServer.Handle("METHOD", "/path", ...middlewares, handler)
            const handleRegex = /ginServer\.Handle\(\s*"([A-Z]+)"\s*,\s*"([^"]+)"((?:\s*,\s*(?:[a-zA-Z0-9_]+\.)?[a-zA-Z0-9_]+)*)?\s*,\s*([a-zA-Z0-9_.]+)\s*\)/;
            const match = line.match(handleRegex);

            if (match) {
                const method = match[1];
                const endpoint = match[2];
                const authChecksRaw = match[3];
                let en = match[4];

                // 提取最后一个部分作为方法名
                const enParts = en.split('.');
                en = enParts[enParts.length - 1];
                if (en.includes(',')) {
                    en = en.split(',').pop()!.trim();
                }

                // 解析中间件
                let needAuth = false;
                let needAdminRole = false;
                let unavailableIfReadonly = false;
                const otherAuthChecks: string[] = [];

                if (authChecksRaw) {
                    const checks = authChecksRaw.substring(1).split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
                    for (const check of checks) {
                        if (check === 'model.CheckAuth') needAuth = true;
                        else if (check === 'model.CheckAdminRole') needAdminRole = true;
                        else if (check === 'model.CheckReadonly') unavailableIfReadonly = true;
                        else otherAuthChecks.push(check);
                    }
                }

                // 去重
                if (!rawApis.some(api => api.endpoint === endpoint && api.method === method)) {
                    rawApis.push({
                        method,
                        endpoint,
                        en,
                        needAuth,
                        needAdminRole,
                        unavailableIfReadonly,
                        otherAuthChecks,
                    });
                }
            }
        }
    };

    for (const start of 函数起始列表) {
        处理行(start);
    }

    return rawApis;
}

function 比较Api列表(oldList: 原始Api[], newList: 原始Api[]): 差异结果 {
    const oldMap = new Map(oldList.map(api => [`${api.method}|${api.endpoint}`, api]));
    const newMap = new Map(newList.map(api => [`${api.method}|${api.endpoint}`, api]));

    const 新增: 原始Api[] = [];
    const 移除: 原始Api[] = [];
    const 变更: { old: 原始Api; new: 原始Api }[] = [];

    for (const [key, newApi] of newMap) {
        const oldApi = oldMap.get(key);
        if (!oldApi) {
            新增.push(newApi);
        } else if (JSON.stringify(oldApi) !== JSON.stringify(newApi)) {
            变更.push({ old: oldApi, new: newApi });
        }
    }

    for (const [key, oldApi] of oldMap) {
        if (!newMap.has(key)) {
            移除.push(oldApi);
        }
    }

    return { 新增, 移除, 变更 };
}

function 生成差异报告(diff: 差异结果): string {
    let md = '# API 变更报告\n\n';
    let hasChanges = false;

    if (diff.新增.length > 0) {
        hasChanges = true;
        md += '## 新增 API\n\n';
        md += '| 方法 | 端点 | 处理函数 | 认证 |\n';
        md += '|------|------|----------|------|\n';
        for (const api of diff.新增) {
            const auth = [
                api.needAuth && 'Auth',
                api.needAdminRole && 'Admin',
                api.unavailableIfReadonly && 'Readonly',
            ].filter(Boolean).join(', ');
            md += `| ${api.method} | \`${api.endpoint}\` | \`${api.en}\` | ${auth} |\n`;
        }
        md += '\n';
    }

    if (diff.移除.length > 0) {
        hasChanges = true;
        md += '## 移除 API\n\n';
        md += '| 方法 | 端点 | 处理函数 |\n';
        md += '|------|------|----------|\n';
        for (const api of diff.移除) {
            md += `| ${api.method} | \`${api.endpoint}\` | \`${api.en}\` |\n`;
        }
        md += '\n';
    }

    if (diff.变更.length > 0) {
        hasChanges = true;
        md += '## 变更 API\n\n';
        for (const change of diff.变更) {
            md += `### \`${change.new.method}\` \`${change.new.endpoint}\`\n\n`;
            md += '```diff\n';
            md += `- ${JSON.stringify(change.old, null, 2)}\n`;
            md += `+ ${JSON.stringify(change.new, null, 2)}\n`;
            md += '```\n\n';
        }
    }

    return hasChanges ? md : '';
}

async function main() {
    // 确保 scripts 目录存在用于放置输出
    const 输出目录 = 根目录;

    const goContent = await 获取RouterGo();
    console.log('正在解析 router.go ...');
    const rawApis = 解析Go代码(goContent);
    console.log(`解析到 ${rawApis.length} 个 API`);

    const 输出路径 = join(输出目录, 输出文件);
    const 差异路径 = join(输出目录, 差异报告文件);

    // 读取旧列表进行对比
    let oldList: 原始Api[] = [];
    try {
        const oldContent = await readFile(输出路径, 'utf8');
        oldList = JSON.parse(oldContent);
    } catch {
        // 文件不存在，忽略
    }

    const diff = 比较Api列表(oldList, rawApis);
    const diffMd = 生成差异报告(diff);

    if (diffMd) {
        await writeFile(差异路径, diffMd, 'utf8');
        console.log(`已生成变更报告: ${差异路径}`);
    } else {
        console.log('未检测到变更');
    }

    await writeFile(输出路径, JSON.stringify(rawApis, null, 2), 'utf8');
    console.log(`已更新 API 列表: ${输出路径}`);
}

main().catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
});
