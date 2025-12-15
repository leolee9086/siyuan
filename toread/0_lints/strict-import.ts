/**
 * 孤岛导入约束
 * 
 * 包括:
 * - 禁止从父级目录导入
 * - 禁止直接导入第三方包
 * - 所有外部导入必须通过 imports.ts 转发
 */
export const STRICT_IMPORT_RESTRICTIONS = [
    {
        selector: 'ImportDeclaration[source.value=/^\\u002E\\u002E\\u002F/]',
        message: '禁止从父级目录导入 (../)。必须通过本目录同层级的 ./imports.ts 转发。'
    },
    {
        selector: 'ExportNamedDeclaration[source.value=/^\\u002E\\u002E\\u002F/]',
        message: '禁止从父级目录重导出 (../)。'
    },
    {
        selector: 'ExportAllDeclaration[source.value=/^\\u002E\\u002E\\u002F/]',
        message: '禁止从父级目录全量重导出 (../)。'
    },
    {
        selector: 'ImportDeclaration[source.value=/^[^.]/]',
        message: '禁止直接导入第三方包或别名。必须通过本目录同层级 ./imports.ts 转发。'
    },
    {
        selector: 'ExportNamedDeclaration[source.value=/^[^.]/]',
        message: '禁止直接重导出第三方包或别名。'
    },
    {
        selector: 'ExportAllDeclaration[source.value=/^[^.]/]',
        message: '禁止直接全量重导出第三方包或别名。'
    }
    // 注意：export ... from 的全局禁令已移至 BASE_ARCHITECTURE_RESTRICTIONS
];
