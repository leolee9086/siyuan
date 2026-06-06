/**
 * 表格修复中间件的上下文类型
 *
 * 意图：封装fixTable中间件链所需的全部上下文信息，
 *       采用与keydown.ts一致的AbortController中间件模式
 * 调用时机：由fixTable主调度器构造，传递给各个子中间件
 *
 * 问题/改进：当前cellElement和nodeElement的类型为HTMLElement，
 *           未来可考虑收窄为HTMLTableCellElement和HTMLTableElement
 */
export type TableFixContext = {
    /** 编辑器实例 */
    protyle: IProtyle;
    /** 键盘事件 */
    event: KeyboardEvent;
    /** 当前选区 */
    range: Range;
    /** 当前所在的表格单元格（TD或TH） */
    cellElement: HTMLElement;
    /** 表格所在的块级元素 */
    nodeElement: HTMLElement;
    /** 中止控制器，abort后终止后续中间件执行 */
    controller: AbortController;
};

/**
 * 行跨度分析结果
 *
 * 意图：表格结构操作需要知道行中是否存在合并单元格或隐藏单元格，
 *       以决定操作是否安全可执行
 */
export type RowSpanInfo = {
    /** 行中存在隐藏单元格（fn__none） */
    hasNone: boolean;
    /** 行中存在列合并（colSpan > 1） */
    hasColSpan: boolean;
    /** 行中存在行合并（rowSpan > 1） */
    hasRowSpan: boolean;
};

/**
 * 表格结构操作的预分析上下文
 *
 * 意图：结构操作中间件共享相同的前置分析（行跨度、列纯净度），
 *       提取为独立类型避免每个中间件重复计算
 */
export type StructureContext = {
    /** 表格快捷键配置 */
    tableKeymap: Config.IKeymapEditorTable;
    /** 表格DOM元素 */
    tableElement: HTMLTableElement;
    /** 当前行元素 */
    rowElement: Element;
    /** 当前行跨度分析 */
    currentRowInfo: RowSpanInfo;
    /** 上一行跨度分析，不存在则为null */
    prevRowInfo: RowSpanInfo | null;
    /** 下一行跨度分析，不存在则为null */
    nextRowInfo: RowSpanInfo | null;
    /** 当前列索引 */
    colIndex: number;
    /** 当前列是否纯净 */
    colPure: boolean;
    /** 左侧列是否纯净 */
    prevColPure: boolean;
    /** 右侧列是否纯净 */
    nextColPure: boolean;
};
