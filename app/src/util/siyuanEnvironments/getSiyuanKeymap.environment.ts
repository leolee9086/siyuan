/**
 * 思源编辑器快捷键配置环境包装器
 *
 * 从 getSiyuanConfig.environment.ts 拆分出来，
 * 因为该文件已达到300行限制
 * @同步豁免: 遗留代码
 */

/**
 * 获取编辑器的表格快捷键配置
 * @returns 编辑器表格快捷键配置对象，可能为 undefined
 *
 * @example
 * const tableKeymap = getSiyuanEditorTableKeymap();
 * if (tableKeymap && matchHotKey(tableKeymap.moveToUp.custom, event)) {
 *     // 处理上移行快捷键
 * }
 * @同步豁免: 遗留代码
 */
export const getSiyuanEditorTableKeymap = () => {
    return window.siyuan?.config?.keymap?.editor?.table;
};
