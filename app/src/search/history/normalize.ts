/** 将最新词条前置、去重，并按配置限制截断；保留原实现对输入数组先行插入的语义。 */
/** @同步豁免: 生命周期 */
export const prependSearchHistory = (list: string[], value: string, limit: number) => {
    list.splice(0, 0, value);
    const uniqueList = Array.from(new Set(list));
    // 超过用户配置的历史容量时只保留最近的唯一词条。
    if (uniqueList.length > limit) {
        uniqueList.splice(limit, uniqueList.length - limit);
    }
    return uniqueList;
};
