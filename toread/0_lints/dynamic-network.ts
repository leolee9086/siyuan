/**
 * 动态导入与网络请求约束
 * 
 * 包括:
 * - 禁止动态导入 (import())
 * - 禁止直接发起网络请求 (fetch/axios)
 */

/**
 * 禁止使用动态导入
 */
export const RESTRICTION_NO_DYNAMIC_IMPORT = {
    // 包含 ImportExpression 和 TSImportType 以捕获所有动态导入形式
    selector: ':matches(ImportExpression, TSImportType)',
    message: [
        '架构严令：禁止使用内联导入或动态导入。',
        '1. 如果是类型引用 (import("...")), 请在文件头部使用 standard "import type" 语句。',
        '2. 如果是运行时懒加载 (await import("...")), 请将逻辑移至 *.loader.ts。'
    ].join('\n')
};

/**
 * 禁止直接发起网络请求
 */
export const RESTRICTION_NO_NETWORK = {
    selector: ':matches(CallExpression[callee.name="fetch"], CallExpression[callee.name="axios"], CallExpression[callee.object.name="axios"])',
    message: '架构严令：禁止直接发起网络请求 (fetch/axios)。数据获取逻辑请移至 *.api.ts 或 *.fetcher.ts。'
};
