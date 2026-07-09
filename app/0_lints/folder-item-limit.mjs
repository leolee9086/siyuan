/**
 * 文件夹内容数量限制规则
 *
 * 检查被 lint 文件所在目录中的文件和子文件夹数量（分别计数），
 * 超过阈值时报错，引导开发者按职责拆分目录。
 */

import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

/**
 * 带 TTL 的目录条目数缓存
 * 同一轮 lint 运行内复用（避免同目录下 N 个文件触发 N 次磁盘读取），
 * 跨轮次自动过期（IDE 长驻 ESLint 服务器场景下目录内容变更后不会误判）。
 *
 * @type {Map<string, { fileCount: number, dirCount: number, expiry: number }>}
 */
const 目录条目数缓存 = new Map();

/** 缓存有效期：30秒，足够覆盖单次全量 lint，又不会跨轮次残留 */
const 缓存TTL_MS = 30_000;

/**
 * 读取目录中非隐藏、非忽略后缀的文件和子文件夹数量（带 TTL 缓存）
 * @param {string} dirPath - 目录绝对路径
 * @returns {{ fileCount: number, dirCount: number }} 非隐藏且非忽略后缀的文件数和子文件夹数
 */
function 读取目录条目数(dirPath) {
    const cached = 目录条目数缓存.get(dirPath);
    if (cached && Date.now() < cached.expiry) {
        return { fileCount: cached.fileCount, dirCount: cached.dirCount };
    }

    const 忽略后缀列表 = [".md", ".ts.bak", ".ts.remote", ".ts.backup", ".remote.ts"];
    const entries = readdirSync(dirPath);
    let fileCount = 0;
    let dirCount = 0;

    for (const name of entries) {
        if (name.startsWith(".")) {
            continue;
        }
        if (忽略后缀列表.some(suffix => name.endsWith(suffix))) {
            continue;
        }

        const fullPath = join(dirPath, name);
        try {
            if (statSync(fullPath).isDirectory()) {
                dirCount++;
            } else {
                fileCount++;
            }
        } catch {
            // 无法 stat 时跳过
        }
    }

    目录条目数缓存.set(dirPath, { fileCount, dirCount, expiry: Date.now() + 缓存TTL_MS });
    return { fileCount, dirCount };
}

/**
 * 生成报错信息
 * @param {{ fileCount: number, dirCount: number }} counts - 当前文件数和子文件夹数
 * @param {number} maxFiles - 最大允许文件数
 * @param {number} maxDirs - 最大允许子文件夹数
 * @param {string} dirPath - 目录路径
 * @returns {string} 格式化的报错信息
 */
function 生成超限信息({ fileCount, dirCount }, maxFiles, maxDirs, dirPath) {
    const parts = [];
    if (fileCount > maxFiles) {
        parts.push(`文件 ${fileCount} 个（允许 ${maxFiles} 个）`);
    }
    if (dirCount > maxDirs) {
        parts.push(`子文件夹 ${dirCount} 个（允许 ${maxDirs} 个）`);
    }

    return [
        `❌ 目录 "${dirPath}" 条目超限：${parts.join("，")}。`,
        "目录内容过多会降低可发现性和可维护性，需要将文件重新组织到子目录中。",
        "具体的拆分策略应根据目录内文件的实际职责和关联关系决定，经用户确认后执行。",
        "绝对禁止以超出单个文件修改为由拒绝任务,必要时切换自身为任务编排模式,分派子任务完成目录拆分。",
        "如果此错误由正常编码行为触发,继续专注于当前任务,并在任务完成后额外提出你认为最优的目录拆分建议"
    ].join("\n")
        + 全量修复提示
        + 单文件检查提示;
}

/** 文件夹内容数量限制插件 */
export const 文件夹内容数量限制插件 = {
    rules: {
        "folder-item-limit": {
            meta: {
                type: "problem",
                docs: {
                    description: "限制文件所在目录中文件和子文件夹的数量",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [
                    {
                        type: "object",
                        properties: {
                            max: { type: "integer", default: 10 }
                        },
                        additionalProperties: false
                    }
                ]
            },
            create(context) {
                return {
                    Program() {
                        const filePath = context.filename || context.getFilename();
                        const dirPath = dirname(filePath);

                        let counts;
                        try {
                            counts = 读取目录条目数(dirPath);
                        } catch {
                            // 目录不可读时静默跳过
                            return;
                        }

                        const { fileCount, dirCount } = counts;
                        const maxFiles = 10;
                        const maxDirs = 10;

                        if (fileCount > maxFiles || dirCount > maxDirs) {
                            context.report({
                                loc: { line: 1, column: 0 },
                                message: 生成超限信息({ fileCount, dirCount }, maxFiles, maxDirs, dirPath)
                            });
                        }
                    }
                };
            }
        }
    }
};

// 英文别名导出
export const folderItemLimitPlugin = 文件夹内容数量限制插件;
