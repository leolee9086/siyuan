/** 插件和内置功能共用的菜单控制面，不包含菜单的队列与 DOM 实现。 */
export interface IPluginMenu {
    readonly isOpen: boolean;
    readonly element: HTMLElement;
    showSubMenu: (subMenuElement: HTMLElement) => void;
    addItem: (option: IMenu) => HTMLElement | undefined;
    addAsyncItem: (option: IMenu | Promise<IMenu>, timeout?: number) => Promise<HTMLElement | undefined>;
    addSeparator: (options?: number | {
        index?: number;
        id?: string;
        ignore?: boolean;
    }, ignoreParam?: boolean) => HTMLElement | undefined;
    open: (options: IPosition) => void;
    fullscreen: (position?: "bottom" | "all") => void;
    close: () => void;
    cancelAsyncItem: (index: number) => boolean;
}
