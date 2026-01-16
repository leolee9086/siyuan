/** 链接菜单操作所需的上下文信息 */
export interface LinkMenuContext {
    protyle: IProtyle;
    linkElement: HTMLElement;
    nodeElement: HTMLElement;
    id: string;
    html: string;
    linkAddress: string | null;
    inputElements?: NodeListOf<HTMLTextAreaElement>;
}
