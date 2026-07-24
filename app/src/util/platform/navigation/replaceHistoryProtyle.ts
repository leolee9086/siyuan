/** 将单个导航栈中已脱离 DOM 的同文档 Protyle 引用替换为新实例。 */
const replaceStackEntries = (entries: IBackStack[], newProtyle: IProtyle, rootID: string) => {
    for (const entry of entries) {
        const referencesDetachedRoot = entry.protyle &&
            !document.contains(entry.protyle.element) &&
            entry.protyle.block.rootID === rootID;
        if (referencesDetachedRoot) {
            entry.protyle = newProtyle;
        }
    }
};

/**
 * 同步前进和后退历史中的 Protyle 引用。
 *
 * 页签被重新创建后调用，确保两个导航方向都继续指向同一个新编辑器实例。
 * @同步豁免: 生命周期 - 必须在新页签聚焦继续执行前原子替换两个历史栈中的旧实例引用。
 */
export const replaceNavigationHistoryProtyle = (
    options: {
        forwardEntries: IBackStack[];
        backEntries: IBackStack[];
        newProtyle: IProtyle;
        rootID: string;
    },
) => {
    replaceStackEntries(options.forwardEntries, options.newProtyle, options.rootID);
    replaceStackEntries(options.backEntries, options.newProtyle, options.rootID);
};
