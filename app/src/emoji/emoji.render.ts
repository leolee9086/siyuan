/**
 * 将 Unicode 标识或自定义图片路径渲染为表情 HTML。
 * @同步豁免: UI构建 - 调用方在模板字符串和 innerHTML 赋值期间必须立即取得渲染结果。
 * @参数豁免: 遗留代码 - 公共表情渲染 API 签名
 */
export function unicode2Emoji(unicode: string, className = "", needSpan = false, lazy = false) {
    if (!unicode) {
        return "";
    }
    if (unicode.startsWith("api/icon/getDynamicIcon")) {
        return Lute.Sanitize(`<img class="${className}" ${lazy ? "data-" : ""}src="${unicode}"/>`);
    }
    if (unicode.indexOf(".") > -1) {
        return Lute.Sanitize(`<img class="${className}" ${lazy ? "data-" : ""}src="/emojis/${unicode}"/>`);
    }
    let emoji = "";
    try {
        for (const item of unicode.split("-")) {
            const codePoint = item.length < 5 ? "0" + item : item;
            emoji += String.fromCodePoint(parseInt(codePoint, 16));
        }
        if (needSpan) {
            emoji = `<span class="${className}">${emoji}</span>`;
        }
    } catch (e) {
        // 自定义表情搜索报错 https://github.com/siyuan-note/siyuan/issues/5883
        // 这里忽略错误不做处理
    }
    return emoji;
}

/**
 * 根据当前语言返回表情条目的可访问描述。
 * @同步豁免: UI构建 - 表情按钮的 aria-label 在同步 HTML 生成期间立即读取。
 */
export const getEmojiDesc = (emoji: IEmojiItem) => {
    if (window.siyuan.config.lang === "zh-CN") {
        return emoji.description_zh_cn;
    }
    if (window.siyuan.config.lang === "ja") {
        return emoji.description_ja_jp;
    }
    return emoji.description;
};

/**
 * 根据当前语言返回指定表情分类标题。
 * @同步豁免: UI构建 - 分类标题在同步 HTML 生成期间立即插入模板。
 */
export const getEmojiTitle = (index: number) => {
    const category = window.siyuan.emojis[index];
    if (window.siyuan.config.lang === "zh-CN") {
        return category.title_zh_cn;
    }
    if (window.siyuan.config.lang === "ja") {
        return category.title_ja_jp;
    }
    return category.title;
};
