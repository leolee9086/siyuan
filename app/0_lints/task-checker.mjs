/**
 * Task Checker Plugin
 *
 * 元任务检查器：检查 task.md。
 * 查找范围：从 cwd 向上遍历至项目根目录（含 .git 的目录），收集所有 task.md。
 * 如果包含未完成的任务，则抛出特定的 lint 错误。
 * 通过 custom processor，确保只有在代码没有语法和常规 lint 错误时，才显示此错误。
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TASK_RULE_ID = "task-checker/require-task";

/**
 * 从 startDir 向上查找所有包含 task.md 的目录，直到遇到 .git 所在目录（项目根）或文件系统根。
 * 返回所有找到的 task.md 绝对路径（从 cwd 到项目根，由近到远）。
 */
function findTaskFiles(startDir) {
    const results = [];
    let current = path.resolve(startDir);
    const root = path.parse(current).root;

    while (true) {
        const taskPath = path.join(current, "task.md");
        if (fs.existsSync(taskPath)) {
            results.push(taskPath);
        }
        // 遇到 .git 目录说明已到项目根，收集完毕
        if (fs.existsSync(path.join(current, ".git"))) {
            break;
        }
        const parent = path.dirname(current);
        // 已到文件系统根
        if (parent === current || current === root) {
            break;
        }
        current = parent;
    }
    return results;
}

function hasPendingTasks(taskMdContent) {
    if (!taskMdContent || taskMdContent.trim() === "") {
        return false;
    }
    const lines = taskMdContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes("[ ]")) {
            return true;
        }
    }
    return taskMdContent.trim().length > 0 && !taskMdContent.includes("[x]") && !taskMdContent.includes("[/]");
}

export const taskCheckerPlugin = {
    rules: {
        "require-task": {
            meta: {
                type: "problem",
                docs: {
                    description: "强制要求查阅并完成 task.md 中的内容",
                    category: "Meta Workflow",
                },
                schema: [],
            },
            create(context) {
                return {
                    Program(node) {
                        try {
                            const taskFiles = findTaskFiles(process.cwd());
                            for (const taskFilePath of taskFiles) {
                                const content = fs.readFileSync(taskFilePath, "utf8");
                                if (hasPendingTasks(content)) {
                                    const relPath = path.relative(process.cwd(), taskFilePath);
                                    context.report({
                                        node,
                                        message: `🎯 [Mission Control] 此文件已经满足基础代码规范！但${relPath}中存在未完成的任务,除非你正在其它任务执行过程中，否则立刻查看此文件领取其中一个任务并开始执行.绝对禁止以"非代码问题""非代码质量问题"等绕过此要求`,
                                    });
                                    break;
                                }
                            }
                        } catch {
                            // ignore file read error
                        }
                    }
                };
            }
        }
    },
    processors: {
        "task-processor": {
            // preprocess 钩子：不改变源码，直接返回
            preprocess: function (text) {
                return [text];
            },
            // postprocess 钩子：拦截并过滤 lint 结果
            postprocess: function (messages) {
                // messages 结构： [[ { ruleId: '...', message: '...', severity: 2 }, ... ]]
                // 因为我们只生成了一个扁平的代码块返回（preprocess 返回 [text]），所以取 messages[0]
                const fileMessages = messages[0] || [];

                // 检查是否有*除了*我们的元任务错误以外的“真实代码错误” (severity 2 兜底，其实 warning 也可以过滤)
                const hasOtherErrors = fileMessages.some(m => m.ruleId !== TASK_RULE_ID && m.severity === 2);

                // 如果代码里还有别的红线报错
                if (hasOtherErrors) {
                    // 把元任务错误隐藏掉，让哥哥先专心修代码！
                    return fileMessages.filter(m => m.ruleId !== TASK_RULE_ID);
                }

                // 如果代码完美无瑕（或者只有 warning 无关痛痒），那就把元任务报错放行！
                return fileMessages;
            },
            supportsAutofix: true
        }
    }
};
