/** 历史文档点击流程所需的完整宿主上下文。 */
export interface IHistoryDocClickContext<TEditor, TDialog> {
    readonly target: HTMLElement;
    readonly type: string | null;
    readonly event: MouseEvent;
    readonly element: HTMLElement;
    readonly firstPanelElement: HTMLElement;
    readonly historyEditor: TEditor;
    readonly dialog: TDialog | undefined;
    readonly clearHistoryEditor: () => void;
}
