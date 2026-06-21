/**
 * openMenuPanel 拆分后各子模块共享的上下文接口。
 *
 * 用途：封装 openMenuPanel 函数内部闭包变量，使提取到独立文件的事件处理器
 *       能够访问原闭包中的可变状态（data、fields、tabRect、closeCB）。
 * 使用场景：openMenuPanel.drag.ts、openMenuPanel.click.*.ts 等拆分文件。
 * 关联类型：IAV、IAVColumn 来自全局类型定义。
 */
export interface IMenuPanelContext {
    options: {
        protyle: IProtyle,
        blockElement: Element,
        type: string,
        colId?: string,
        editData?: {
            previousID: string,
            colData: IAVColumn,
        },
        cellElements?: HTMLElement[],
        cb?: (avPanelElement: Element) => void
    };
    data: IAV;
    fields: IAVColumn[];
    avID: string;
    blockID: string;
    isCustomAttr: boolean;
    menuElement: HTMLElement;
    avPanelElement: HTMLElement;
    tabRect: DOMRect;
    closeCB?: () => void;
}

/**
 * buildColItemHTML 的安全参数。
 * 所有字符串字段在传入前必须完成 HTML 转义/预处理，
 * 不得将未经处理的用户输入直接传入。
 */
export interface ColItemSafeHTML {
    /** data-id 属性值（系统内建 ID） */
    id: string;
    /** 已处理的图标 HTML（完整 <svg>/emoji），不含未转义的用户输入 */
    iconHTML: string;
    /** 已转义的列名称，空时传入 "&nbsp;" */
    nameHTML: string;
    /** 显示/隐藏操作按钮的完整 HTML（含 class + data-type + <use>） */
    actionHTML: string;
}

/**
 * getPropertiesHTML 的上下文依赖接口。
 * 由调用方在 openMenuPanel.ts 中构造并传入，以消除本模块对父级目录的导入依赖。
 */
export interface PropertiesHTMLDeps {
    /** Emoji unicode → HTML 图标 */
    unicode2Emoji: (unicode: string, className?: string, needSpan?: boolean) => string;
    /** HTML 转义 */
    escapeHtml: (html: string) => string;
    /** 国际化文案对象（仅列出本模块使用的 key） */
    siyuanI18n: {
        hideCol: string;
        showAll: string;
        fields: string;
        showCol: string;
        hideAll: string;
        new: string;
    };
}
