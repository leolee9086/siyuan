/** 将书签过滤输入规范化为不区分大小写的关键词列表。 */
export const getBookmarkFilterKeywords = (value: string) => value.toLowerCase().trim().split(/\s+/).filter(Boolean);

/** 按顶层书签分组名称筛选，并要求名称同时包含全部关键词。 */
export const filterBookmarkData = (data: IBlockTree[], keywords: string[]) => data.filter(item => {
    const name = item.name.toLowerCase();
    return keywords.every(keyword => name.includes(keyword));
});
