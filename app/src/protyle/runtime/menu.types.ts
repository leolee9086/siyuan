/**
 * Protyle 使用的菜单能力协议。
 * 菜单项仍由现有编辑器逻辑构造，该接口只负责容器、显示、定位和生命周期，不规定宿主菜单的内部实现。
 */
export interface IProtyleMenuPort {
    element: HTMLElement;
    data?: unknown;
    removeCB?: (() => void) | null;

    append(element?: HTMLElement, index?: number): void;

    remove(isKeyEvent?: boolean): void;

    popup(position: IPosition): void;

    fullscreen(position?: "bottom" | "all"): void;

    showSubMenu(subMenuElement: HTMLElement): void;
}
