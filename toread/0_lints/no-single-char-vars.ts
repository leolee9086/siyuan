/**
 * 禁止单字母变量名约束
 * 
 * 禁止使用单字母变量名，提高代码可读性。
 * 
 * 例外情况:
 * - 循环计数器 (i, j, k) - 不建议，但如果必须使用循环应该使用有意义的名字
 * - 数学常用变量 (x, y, z, w) - 可以使用，但仅限于明确的数学上下文
 * - 泛型参数 (T, K, V, P, R) - 作为类型参数时允许
 * - 下划线 (_) - 用于表示忽略的参数
 */

/**
 * 用于 id-length 规则的配置
 * 
 * 注意：这个规则不是 no-restricted-syntax 格式
 * 而是 ESLint 内置规则的配置对象
 */
export const ID_LENGTH_RULE_CONFIG = [
    'error',
    {
        min: 2,
        // 允许的例外
        exceptions: [
            // 数学/几何常用变量 - 仅在明确的数学上下文中使用
            'x', 'y', 'z', 'w', 'i', 'j', 'k',
            // 时间相关
            't',
            // 忽略参数的占位符
            '_'
        ],
        // 属性名不做限制
        properties: 'never',
        // 对以下情况做例外处理
        exceptionPatterns: [
            // 单字母后跟数字的模式 (如 x1, y2)
            '^[a-z]\\d+$'
        ]
    }
] as const;

/**
 * 使用 no-restricted-syntax 实现更细粒度的控制
 * 
 * 这个方式可以针对特定的AST节点进行约束
 */
export const NO_SINGLE_CHAR_VAR_RESTRICTIONS = [
    {
        // 禁止单字母变量声明，排除允许的例外
        selector: `VariableDeclarator[id.type="Identifier"][id.name=/^[a-hj-su-vA-SU-Z]$/]`,
        message: '变量名约束：禁止使用单字母变量名。请使用有意义的描述性名称提高可读性。允许的例外: x, y, z, w, t, _'
    },
    {
        // 禁止单字母函数参数，排除允许的例外
        selector: `FunctionDeclaration > Identifier.params[name=/^[a-hj-su-vA-SU-Z]$/]`,
        message: '参数名约束：禁止使用单字母参数名。请使用有意义的描述性名称。允许的例外: x, y, z, w, t, _'
    },
    {
        // 箭头函数参数
        selector: `ArrowFunctionExpression > Identifier.params[name=/^[a-hj-su-vA-SU-Z]$/]`,
        message: '参数名约束：禁止使用单字母参数名。请使用有意义的描述性名称。允许的例外: x, y, z, w, t, _'
    },
    {
        // 普通函数表达式参数
        selector: `FunctionExpression > Identifier.params[name=/^[a-hj-su-vA-SU-Z]$/]`,
        message: '参数名约束：禁止使用单字母参数名。请使用有意义的描述性名称。允许的例外: x, y, z, w, t, _'
    }
];
