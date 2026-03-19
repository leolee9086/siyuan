/**
 * 文件夹内容数量限制规则
 *
 * 检查被 lint 文件所在目录中的文件和子文件夹数量，
 * 超过阈值时报错，引导开发者按职责拆分目录。
 */

import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { 全量修复提示, 单文件检查提示 } from "./shared-constants.mjs";

/**
 * 带 TTL 的目录条目数缓存
 * 同一轮 lint 运行内复用（避免同目录下 N 个文件触发 N 次磁盘读取），
 * 跨轮次自动过期（IDE 长驻 ESLint 服务器场景下目录内容变更后不会误判）。
 *
 * @type {Map<string, { count: number, expiry: number }>}
 */
const 目录条目数缓存 = new Map();

/** 缓存有效期：30秒，足够覆盖单次全量 lint，又不会跨轮次残留 */
const 缓存TTL_MS = 30_000;

/**
 * 读取目录中非隐藏、非忽略后缀条目的数量（带 TTL 缓存）
 * @param {string} dirPath - 目录绝对路径
 * @returns {number} 非隐藏且非忽略后缀条目数量
 */
function 读取目录条目数(dirPath) {
    const cached = 目录条目数缓存.get(dirPath);
    if (cached && Date.now() < cached.expiry) {
        return cached.count;
    }

    const 忽略后缀列表 = [".md", ".ts.bak", ".ts.remote", ".ts.backup", ".remote.ts"];
    const entries = readdirSync(dirPath);
    const count = entries.filter((name) => {
        if (name.startsWith(".")) {
            return false;
        }
        return !忽略后缀列表.some(suffix => name.endsWith(suffix));
    }).length;

    目录条目数缓存.set(dirPath, { count, expiry: Date.now() + 缓存TTL_MS });
    return count;
}

/**
 * 生成报错信息
 * @param {number} count - 当前条目数量
 * @param {number} max - 最大允许数量
 * @param {string} dirPath - 目录路径
 * @returns {string} 格式化的报错信息
 */
function 生成报错信息(count, max, dirPath) {
    return [
        `❌ 文件夹内容数量超限：目录 "${dirPath}" 包含 ${count} 个条目（文件+子文件夹），超过最大允许数量 ${max}。`,
        "目录内容过多会降低可发现性和可维护性，需要将文件重新组织到子目录中。",
        "具体的拆分策略应根据目录内文件的实际职责和关联关系决定，经用户确认后执行。",
        "绝对禁止以超出单个文件修改为由拒绝任务,必要时切换自身为任务编排模式,分派子任务完成目录拆分。"
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
                const options = context.options[0] || {};
                const max = options.max || 10;

                return {
                    Program() {
                        const filePath = context.filename || context.getFilename();
                        const dirPath = dirname(filePath);

                        let count;
                        try {
                            count = 读取目录条目数(dirPath);
                        } catch {
                            // 目录不可读时静默跳过
                            return;
                        }

                        if (count > max) {
                            context.report({
                                loc: { line: 1, column: 0 },
                                message: 生成报错信息(count, max, dirPath)
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
