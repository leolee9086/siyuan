
import type {IBazaarData} from "./types";

export const bazaarData: IBazaarData = {
    themes: [] as IBazaarItem[],
    templates: [] as IBazaarItem[],
    icons: [] as IBazaarItem[],
    widgets: [] as IBazaarItem[],
    plugins: [] as IBazaarItem[],
    downloaded: [] as IBazaarItem[],
    downloadedDefault: [] as IBazaarItem[],
    update: {
        themes: [] as IBazaarItem[],
        templates: [] as IBazaarItem[],
        icons: [] as IBazaarItem[],
        widgets: [] as IBazaarItem[],
        plugins: [] as IBazaarItem[],
    },
    keywords: {
        themes: [] as string[],
        templates: [] as string[],
        icons: [] as string[],
        widgets: [] as string[],
        plugins: [] as string[],
    },
    selectedKeywords: {
        themes: [] as string[],
        templates: [] as string[],
        icons: [] as string[],
        widgets: [] as string[],
        plugins: [] as string[],
    }
};

// 提取并统计关键词
export const extractKeywords = (items: IBazaarItem[]): string[] => {
    const keywordCount: { [key: string]: number } = {};

    for (const item of items) {
        if (item.keywords) {
            for (const keyword of item.keywords) {
                if (keywordCount[keyword]) {
                    keywordCount[keyword]++;
                } else {
                    keywordCount[keyword] = 1;
                }
            }
        }
    }


    // 按出现频率排序，返回前10个关键词
    const data = Object.entries(keywordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(entry => entry[0]);

    return data;
};

const matchesKeywords = (item: IBazaarItem, selectedKeywords: string[]) => {
    if (!item.keywords || item.keywords.length === 0) {
        return false;
    }
    // 检查是否包含所有选中的关键词
    return selectedKeywords.every(selectedKeyword =>
        item.keywords!.includes(selectedKeyword)
    );
};

// 根据选中的关键词过滤包
export const filterPackagesByKeywords = (bazaarType: TBazaarType) => {
    const selectedKeywords = bazaarData.selectedKeywords[bazaarType];
    const allPackages = bazaarData[bazaarType];

    // 如果没有选中任何关键词，显示所有包
    if (selectedKeywords.length === 0) {
        return allPackages;
    }

    // 过滤包含所有选中关键词的包
    return allPackages.filter(item => matchesKeywords(item, selectedKeywords));
};
