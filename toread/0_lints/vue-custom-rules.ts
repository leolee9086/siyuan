/**
 * Vue 组件自定义规则
 * 
 * 包括:
 * - Vue 模板行数限制
 * - Vue Script 行数限制
 * - 禁止使用 <style> 块
 */

/**
 * 提示词字典
 */
export const PROMPTS = {
    VUE_TEMPLATE_TOO_LONG: {
        id: 'UI-001: Giant Template',
        mode: 'UI_COMPONENT_SPECIALIST',
        reason: "检测到 Vue 组件模板部分超过 50 行。",
        action: "请执行 '组件提取' 重构。"
    },
    VUE_SCRIPT_TOO_LONG: {
        id: 'UI-002: Fat Script',
        mode: 'LOGIC_EXTRACTION_SPECIALIST',
        reason: "检测到 Vue 组件 Script 部分超过 50 行。",
        action: "请执行 '逻辑提取' 重构，移入 .utils.ts 或 .ctx.ts。"
    }
};

/**
 * 生成 Agent 指令信息
 */
export function generateAgentInstruction(prompt: any): string {
    return `🤖 Agent指令: ${prompt.id} | ${prompt.mode}\n${prompt.reason}\n${prompt.action}`;
}

/**
 * 本地规则插件
 */
export const localRulesPlugin = {
    rules: {
        'vue-template-max-lines': {
            meta: { type: 'problem' },
            create(context: any) {
                const MAX_LINES = 50;
                return {
                    Program(node: any) {
                        const templateBody = node.templateBody;
                        if (!templateBody || !templateBody.loc) return;
                        const lines = templateBody.loc.end.line - templateBody.loc.start.line;
                        if (lines > MAX_LINES) {
                            context.report({
                                node: templateBody,
                                message: generateAgentInstruction(PROMPTS.VUE_TEMPLATE_TOO_LONG)
                            });
                        }
                    }
                };
            }
        },
        'vue-script-max-lines': {
            meta: { type: 'problem' },
            create(context: any) {
                const MAX_LINES = 50;
                return {
                    Program(node: any) {
                        const services = context.sourceCode?.parserServices || context.parserServices;
                        const df = services?.getDocumentFragment?.();
                        if (df && df.children) {
                            df.children.forEach((child: any) => {
                                if (child.type === 'VElement' && child.name === 'script') {
                                    const lines = child.loc.end.line - child.loc.start.line;
                                    if (lines > MAX_LINES) {
                                        context.report({
                                            node: child,
                                            message: generateAgentInstruction(PROMPTS.VUE_SCRIPT_TOO_LONG)
                                        });
                                    }
                                }
                            });
                        }
                    }
                };
            }
        },
        'no-vue-style-block': {
            meta: { type: 'problem' },
            create(context: any) {
                return {
                    Program(node: any) {
                        const services = context.sourceCode?.parserServices || context.parserServices;
                        const df = services?.getDocumentFragment?.();
                        if (df && df.children) {
                            df.children.forEach((child: any) => {
                                if (child.type === 'VElement' && child.name === 'style') {
                                    context.report({
                                        node: child,
                                        message: '禁止使用 <style>。请使用 Tailwind CSS 或外部 CSS 文件。'
                                    });
                                }
                            });
                        }
                    }
                };
            }
        }
    }
};
