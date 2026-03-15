/**
 * 共享常量文件
 *
 * 用于避免循环依赖，存放需要在多个 lint 规则文件中共享的常量
 */

// 共用提示语：少于300行文件应修复所有lint错误
export const 全量修复提示 = `\n\n📋 注意: 对于少于 300 行实际代码的文件，处理完本错误后，如果编辑器提示有其他lint错误,应该一并修复,否则只修复你新编写的代码产生的错误。
绝对禁止仅为绕过lint滥用豁免规则;
复杂重构应该遵循先备份,再修改,再核对的原则进行;
代码实际行数以lint检查的行数为唯一标准,不报错则代表没有超过300行实际代码。
`;

// 英文别名导出
export const FULL_FIX_REMINDER = 全量修复提示;

// 单文件lint检查提示
export const 单文件检查提示 = "\n\n💡 提示: 使用 `cd app && pnpm run lint:file -- <文件路径>` 检查单个文件的lint错误。";

// 英文别名导出
export const SINGLE_FILE_LINT_TIP = 单文件检查提示;

// 柯里化豁免注释标记
export const 柯里化豁免注释 = "@柯里化";
export const CURRYING_EXEMPT_COMMENT = 柯里化豁免注释;

/**
 * 检查节点前面的注释是否包含柯里化豁免标记
 * @param {object} node - AST节点
 * @param {object} sourceCode - ESLint sourceCode对象
 * @returns {boolean} 是否包含豁免标记
 */
export function 检查柯里化豁免(node, sourceCode) {
    // 检查节点本身前的注释
    const comments = sourceCode.getCommentsBefore(node);
    if (comments.some((comment) => comment.value.includes(柯里化豁免注释))) {
        return true;
    }

    // 对于 VariableDeclarator 中的函数，检查 VariableDeclaration 前的注释
    if (node.parent && node.parent.type === "VariableDeclarator") {
        const declarator = node.parent;
        const declaratorComments = sourceCode.getCommentsBefore(declarator);
        if (declaratorComments.some((comment) => comment.value.includes(柯里化豁免注释))) {
            return true;
        }

        // 检查 VariableDeclaration 前的注释
        if (declarator.parent && declarator.parent.type === "VariableDeclaration") {
            const declaration = declarator.parent;
            const declarationComments = sourceCode.getCommentsBefore(declaration);
            if (declarationComments.some((comment) => comment.value.includes(柯里化豁免注释))) {
                return true;
            }
        }
    }

    return false;
}

// 英文别名导出
export const checkCurryingExempt = 检查柯里化豁免;
