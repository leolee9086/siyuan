/**
 * 闪卡全局配置访问封装
 * 
 * 作用：封装对window.siyuan.config.flashcard的访问
 * 意图：避免直接访问window对象，符合lint规范
 * 调用时机：需要访问闪卡配置时
 */

/**
 * 获取闪卡配置
 * @同步豁免: 性能考虑 - 配置读取是高频同步操作，异步化会严重影响性能
 */
export const getFlashcardConfig = () => {
    return window.siyuan?.config?.flashcard;
};

/**
 * 检查是否启用超级块隐藏
 * @同步豁免: 性能考虑 - 配置读取是高频同步操作
 */
export const isSuperBlockHideEnabled = () => {
    return window.siyuan?.config?.flashcard?.superBlock ?? false;
};

/**
 * 检查是否启用标题隐藏
 * @同步豁免: 性能考虑 - 配置读取是高频同步操作
 */
export const isHeadingHideEnabled = () => {
    return window.siyuan?.config?.flashcard?.heading ?? false;
};

/**
 * 检查是否启用列表隐藏
 * @同步豁免: 性能考虑 - 配置读取是高频同步操作
 */
export const isListHideEnabled = () => {
    return window.siyuan?.config?.flashcard?.list ?? false;
};

/**
 * 检查是否启用标记隐藏
 * @同步豁免: 性能考虑 - 配置读取是高频同步操作
 */
export const isMarkHideEnabled = () => {
    return window.siyuan?.config?.flashcard?.mark ?? false;
};
