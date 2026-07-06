/**
 * 优先级 Lint 引擎
 *
 * 提供三层能力：
 * 1. 规则优先级注册表——进程级 Map，支持任意数值，不限层级
 * 2. createPriorityPlugin() 工厂——包装标准 ESLint 插件并注册其规则优先级
 * 3. priorityLintProcessor 插件——postprocess 中按优先级过滤消息
 *
 * 工作原理：
 * - 所有自定义插件经 createPriorityPlugin() 包装后，其规则的优先级被注册到全局 Map
 * - eslint.config.mjs 中声明 processor: "priority-lint/processor"
 * - ESLint 完成所有规则检查后，postprocess 收到该文件的全部消息
 * - postprocess 查找每条 error 的规则优先级（数字越小优先级越高）
 * - 只保留最高优先级（最小数字）的 error，低优先级 error 被隐藏
 * - warning 始终展示，不参与优先级过滤
 * - 高优先级 error 清零后，次高优先级 error 自动浮现
 *
 * 优先级使用任意数值，没有硬编码级别限制。
 * 约定：0 = 最高优先级，数值越大优先级越低。
 * 未注册的规则默认优先级为 DEFAULT_PRIORITY，确保不遗漏也不抢占。
 */

// ─── 优先级注册表（进程级单例 Map） ───
// key: ruleId（如 "restrictions/no-else" 或 "semi" 或 "@typescript-eslint/no-explicit-any"）
// value: 数字（越小优先级越高）

const registry = new Map();

/**
 * 默认优先级：未注册的规则获得此值。
 * 设为 15 而非 0：确保用户显式注册的 code-size (0) 和 if-nesting (10)
 * 占据前两位后，未注册的基础安全规则处于第三档，优先级不低于业务约束规则。
 */
const DEFAULT_PRIORITY = 15;

/**
 * 注册单个规则的优先级
 * @param {string} ruleId - 完整规则 ID（含插件前缀）
 * @param {number} level - 优先级数字（越小越高）
 */
export function registerPriority(ruleId, level) {
    if (typeof level !== "number" || !Number.isFinite(level)) {
        throw new TypeError(`[priority-lint] 规则 "${ruleId}" 的优先级必须是有限数字，收到: ${level}`);
    }
    registry.set(ruleId, level);
}

/**
 * 批量注册规则优先级
 * @param {Record<string, number>} mapping - { ruleId: level, ... }
 */
export function registerPriorities(mapping) {
    for (const [ruleId, level] of Object.entries(mapping)) {
        registerPriority(ruleId, level);
    }
}

/**
 * 查询规则优先级
 * @param {string} ruleId
 * @returns {number} 优先级数字（越小越高，未注册的返回 DEFAULT_PRIORITY）
 */
export function getPriority(ruleId) {
    return registry.get(ruleId) ?? DEFAULT_PRIORITY;
}

/**
 * 获取注册表快照（调试用）
 * @returns {Map<string, number>}
 */
export function getRegistrySnapshot() {
    return new Map(registry);
}

// ─── 插件工厂 ───

/**
 * 将标准 ESLint 插件包装并注册其规则的优先级。
 *
 * 该函数不修改插件行为本身——过滤逻辑完全由 processor 统一处理。
 * 副作用是将每个规则的优先级写入 registry，供电处理器在 postprocess 阶段查询。
 *
 * @param {Object} plugin - 标准 ESLint 插件对象 { rules: { ... } }
 * @param {string} pluginName - 插件名（用于构造完整 ruleId: "pluginName/ruleName"）
 * @param {number|Object<string,number>} [priorityOrMap] -
 *   传数字 → 整个插件统一优先级；
 *   传对象 → 按规则名分别指定（缺省规则回退到 meta.priority 或 DEFAULT_PRIORITY）；
 *   不传 → 从规则定义的 meta.priority 自动读取
 * @returns {Object} 原插件对象（行为不变）
 */
export function createPriorityPlugin(plugin, pluginName, priorityOrMap) {
    for (const [ruleName, ruleDef] of Object.entries(plugin.rules || {})) {
        const fullRuleId = `${pluginName}/${ruleName}`;
        let level;

        if (typeof priorityOrMap === "number") {
            // 用法 1：统一优先级
            level = priorityOrMap;
        } else if (priorityOrMap && typeof priorityOrMap === "object") {
            // 用法 2：按规则映射，缺省回退到 meta.priority
            level = priorityOrMap[ruleName] ?? ruleDef.meta?.priority ?? DEFAULT_PRIORITY;
        } else {
            // 用法 3：从 meta.priority 读取
            level = ruleDef.meta?.priority ?? DEFAULT_PRIORITY;
        }

        registerPriority(fullRuleId, level);
    }

    return plugin;
}

// ─── 处理器插件 ───

/**
 * 优先级处理器插件
 *
 * 在 eslint.config.mjs 的 config block 中声明：
 *   processor: "priority-lint/processor"
 *
 * 环境变量：
 * - PRIORITY_LINT_SHOW_ALL=1：跳过优先级过滤，显示所有错误（调试/全量查看用）
 *
 * postprocess 逻辑：
 * 1. 收到该文件所有规则的 messages（不限于自家插件）
 * 2. 分离 error (severity=2) 和 warning (severity=1)
 * 3. 为每个 error 查优先级，找到当前存在的最高优先级（最小数字）
 * 4. 过滤掉所有高于该数字（更低优先级）的 error
 * 5. 保留所有 warning + 最高优先级的 error
 */
export const priorityLintPlugin = {
    processors: {
        processor: {
            // preprocess：原样返回源码，不修改
            preprocess(text) {
                return [text];
            },

            postprocess(messages) {
                // messages 结构：[[msg, msg, ...]]（因为 preprocess 返回 [text]）
                const fileMessages = messages[0] || [];

                // 调试模式：跳过过滤，返回全部消息
                if (process.env.PRIORITY_LINT_SHOW_ALL === "1") {
                    return fileMessages;
                }

                // 分离 error 和 warning
                // warning 始终展示，不参与优先级过滤
                const errors = fileMessages.filter(m => m.severity === 2);

                if (errors.length === 0) {
                    // 没有 error，直接返回全部（含 warning）
                    return fileMessages;
                }

                // 找到最高优先级（最小数字）
                let minPriority = Infinity;
                for (const msg of errors) {
                    const p = getPriority(msg.ruleId);
                    if (p < minPriority) {
                        minPriority = p;
                    }
                }

                // 保留：所有 warning + 最高优先级的 error
                return fileMessages.filter(msg => {
                    if (msg.severity !== 2) return true;  // warning 始终保留
                    return getPriority(msg.ruleId) === minPriority;
                });
            },

            supportsAutofix: true,
        },
    },
};