/** 用途：描述空段落替换前后的 DOM。使用场景：构造批量更新与替换节点。关联类型：目标类型由共享空段落命令提供。 */
export type TEmptyParagraphReplacement = {
    nodeElement: Element,
    oldHTML: string,
    newElement: HTMLElement,
};
