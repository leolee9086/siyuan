/**
 * 用途：表示表情选择面板渲染与交互所需的完整业务操作集合。
 * 使用场景：入口创建面板时注入，面板渲染和键盘处理共享同一实现。
 * 关联类型：操作由 Emoji 领域入口组合，面板模块不依赖入口或布局实现。
 */
export interface EmojiPanelOperations {
    unicode2Emoji: (unicode: string, className?: string, needSpan?: boolean, lazy?: boolean) => string;
    getEmojiDesc: (emoji: IEmojiItem) => string;
    getEmojiTitle: (index: number) => string;
    filterEmoji: (key?: string, max?: number, hideCustom?: boolean) => string;
    getRandomEmoji: () => string;
    lazyLoadEmoji: (element: HTMLElement) => void;
    lazyLoadEmojiImg: (element: Element) => void;
    addEmoji: (unicode: string) => void;
    updateFileTreeEmoji: (unicode: string, id: string, icon?: string) => void;
    updateOutlineEmoji: (unicode: string, id: string) => void;
}
