import { FULL_FIX_REMINDER, 检查柯里化豁免 } from "./shared-constants.mjs";

/**
 * ESLint 规则: 禁止只有一行的无意义包装函数
 *
 * 豁免: 如果是合理的柯里化场景（需要闭包捕获上下文），可以在前面添加 // @柯里化 注释
 * 
 * 目的: 检测并禁止那些只有一行代码、仅仅是调用另一个函数并固定部分参数的"包装函数"。
 * 这种函数没有实际的逻辑价值，应该：
 * 1. 在调用处使用柯里化或部分应用 (Partial Application)
 * 2. 直接调用原函数并传入参数
 * 3. 使用 bind() 创建柯里化版本
 * 
 * 例如，以下代码会被标记：
 * ```ts
 * // ❌ 不好的写法
 * const getFlashcardHTML = (item, id) => generateHTML(item, id, true);
 * 
 * // ✅ 好的写法 - 在调用处直接使用
 * const html = generateHTML(item, id, true);
 * 
 * // ✅ 好的写法 - 使用 bind 柯里化
 * const getFlashcardHTML = generateHTML.bind(null, undefined, undefined, true);
 * ```
 */

/**
 * 提示词字典
 */
const PROMPTS = {
    TRIVIAL_WRAPPER: {
        id: 'FUNC-002: Trivial Wrapper Function',
        mode: 'CODE_REFACTORING_SPECIALIST',
        reason: "检测到只有一行的包装函数，仅调用另一个函数并固定部分参数。",
        action: "请考虑: 1) 在调用处直接使用原函数 2) 使用柯里化技巧传入上下文 3) 在调用处即时创建柯里化版本 4)其它更合适的重构方式。"
    }
};

/**
 * 生成 Agent 指令信息
 */
function generateAgentInstruction(prompt) {
    return `🤖 Agent指令: ${prompt.id} | ${prompt.mode}\n${prompt.reason}\n${prompt.action}` + FULL_FIX_REMINDER;
}

/**
 * 获取被调用函数的名称
 */
function getCalleeName(callee) {
    // 简单标识符: foo()
    if (callee.type === "Identifier") {
        return callee.name;
    }

    // 成员表达式: obj.foo() 或 obj.nested.foo()
    if (callee.type === "MemberExpression") {
        const parts = [];
        let current = callee;

        while (current.type === "MemberExpression") {
            if (current.property.type === "Identifier") {
                parts.unshift(current.property.name);
            } else {
                return null; // 计算属性，无法获取名称
            }
            current = current.object;
        }

        if (current.type === "Identifier") {
            parts.unshift(current.name);
            return parts.join(".");
        }

        return null;
    }

    return null;
}

/**
 * 检查函数体是否只是一个简单的 return 调用另一个函数
 */
function checkIsTrivialWrapper(bodyNode) {
    // 箭头函数的表达式形式: () => foo()
    if (bodyNode.type === "CallExpression") {
        const calleeName = getCalleeName(bodyNode.callee);
        return { isTrivial: !!calleeName, calleeName };
    }

    // 函数体形式: { return foo(); }
    if (bodyNode.type === "BlockStatement") {
        const statements = bodyNode.body;

        // 只有一条语句
        if (statements.length === 1) {
            const statement = statements[0];

            // return 语句: return foo();
            if (statement.type === "ReturnStatement") {
                const returnArg = statement.argument;
                if (returnArg && returnArg.type === "CallExpression") {
                    const calleeName = getCalleeName(returnArg.callee);
                    return { isTrivial: !!calleeName, calleeName };
                }
            }

            // 表达式语句: foo(); (无返回值)
            if (statement.type === "ExpressionStatement") {
                const expression = statement.expression;
                if (expression.type === "CallExpression") {
                    const calleeName = getCalleeName(expression.callee);
                    return { isTrivial: !!calleeName, calleeName };
                }
            }
        }
    }

    return { isTrivial: false, calleeName: null };
}

/**
 * 获取函数名称
 */
function getFunctionName(node) {
    // 箭头函数作为变量声明的初始化值
    if (node.parent && node.parent.type === "VariableDeclarator") {
        if (node.parent.id && node.parent.id.type === "Identifier") {
            return node.parent.id.name;
        }
    }

    // 函数声明
    if (node.type === "FunctionDeclaration" && node.id) {
        return node.id.name;
    }

    // 函数表达式
    if (node.type === "FunctionExpression" && node.id) {
        return node.id.name;
    }

    return "(匿名函数)";
}

export const noTrivialWrapperPlugin = {
    rules: {
        "no-trivial-wrapper": {
            meta: {
                type: "suggestion",
                docs: {
                    description: "禁止只有一行的无意义包装函数",
                    category: "Best Practices",
                    recommended: true
                },
                schema: [],
            },
            create(context) {
                const sourceCode = context.getSourceCode();
                
                const 处理函数 = (node) => {
                    const functionName = getFunctionName(node);
                    const bodyNode = node.body;

                    const { isTrivial, calleeName } = checkIsTrivialWrapper(bodyNode);

                    if (!isTrivial) {
                        return;
                    }

                    // 不报告匿名函数（通常是回调）
                    if (functionName === "(匿名函数)") {
                        return;
                    }

                    // 检查柯里化豁免注释
                    if (检查柯里化豁免(node, sourceCode)) {
                        return;
                    }

                    context.report({
                        node,
                        message: generateAgentInstruction(PROMPTS.TRIVIAL_WRAPPER) +
                            `\n\n📝 详情: 函数 '${functionName}' 只是简单地调用 '${calleeName}' 并固定部分参数。`
                    });
                };

                return {
                    ArrowFunctionExpression: 处理函数,
                    FunctionDeclaration: 处理函数,
                    FunctionExpression: 处理函数,
                };
            },
        },
    },
};
