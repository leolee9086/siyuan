/** AI 编辑器动作入口的跨域契约。 */
export type AIActionsHandler = (
    elements: Element[],
    protyle: IProtyle,
    range?: Range,
) => void;
