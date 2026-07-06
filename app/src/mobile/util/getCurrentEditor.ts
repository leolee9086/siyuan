/**
 * 移动端当前编辑器查询。
 *
 * 独立模块以打破 closePanel → keyboardToolbar → mobile/editor → closePanel 循环依赖。
 * 原位于 mobile/editor.ts。
 */
export const getCurrentEditor = () => {
    return window.siyuan.mobile.popEditor || window.siyuan.mobile.editor;
};
