/**
 * 用途：描述 zoomOut 的入参结构；使用场景：editorMenu 的退出聚焦流程；关联类型：IProtyle 与回调函数类型；问题/改进：当前仍允许可选字段在运行时被补默认值。
 */
export type ZoomOutOptions = {
    protyle: IProtyle;
    id: string;
    focusId?: string;
    isPushBack?: boolean;
    callback?: () => void;
    reload?: boolean;
    dataDocType?: string;
};
