import { Menu as SiyuanMenu } from "../menus/Menu";
/** 用途：约束插件菜单对外公开的完整能力；使用范围：Menu class 公共 API；解耦评估：纯领域契约，具体菜单继续由本类封装。 */
import type {IPluginMenu} from "./menu/menu.types";

interface PendingMenuItem {
    option: IMenu | Promise<IMenu>;
    resolve: (value: HTMLElement | undefined) => void;
    reject: (reason?: any) => void;
    index: number;
    timeoutId?: number | NodeJS.Timeout;
}

export class Menu implements IPluginMenu {
    private menu: SiyuanMenu;
    public isOpen: boolean;
    public element: HTMLElement;
    private pendingItems: PendingMenuItem[] = [];
    private processingQueue = false;
    private nextIndex = 0;

    constructor(id?: string, closeCB?: () => void, independent = false) {
        if (independent) {
            const element = window.siyuan.menus.menu.element.cloneNode(true) as HTMLElement;
            element.removeAttribute("id");
            element.removeAttribute("data-name");
            element.removeAttribute("data-from");
            element.removeAttribute("style");
            element.setAttribute("data-menu", "true");
            element.classList.add("fn__none");
            element.classList.remove("b3-menu--list", "b3-menu--fullscreen");
            element.firstElementChild.classList.add("fn__none");
            element.lastElementChild.innerHTML = "";
            document.body.append(element);
            this.menu = new SiyuanMenu(element);
        } else {
            this.menu = window.siyuan.menus.menu;
        }
        this.isOpen = false;
        this.element = this.menu.element;

        if (id && !independent) {
            const dataName = this.menu.element.getAttribute("data-name");
            if (dataName && dataName === id) {
                this.isOpen = true;
            }
        }
        this.menu.remove();
        if (!this.isOpen) {
            if (id) {
                this.menu.element.setAttribute("data-name", id);
            }
            if (independent) {
                const closeEvent = (event: MouseEvent) => {
                    if (!this.element.contains(event.target as Node)) {
                        this.close();
                    }
                };
                const keydownEvent = (event: KeyboardEvent) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                        event.preventDefault();
                        this.close();
                    }
                };
                window.addEventListener("click", closeEvent, true);
                this.element.addEventListener("keydown", keydownEvent);
                this.menu.removeCB = () => {
                    window.removeEventListener("click", closeEvent, true);
                    this.element.removeEventListener("keydown", keydownEvent);
                    closeCB?.();
                    this.element.remove();
                };
            } else {
                this.menu.removeCB = closeCB;
            }
        }
    }

    showSubMenu(subMenuElement: HTMLElement) {
        this.menu.showSubMenu(subMenuElement);
    }

    addItem(option: IMenu) {
        if (this.isOpen) {
            return;
        }
        return this.menu.addItem(option);
    }

    addAsyncItem(option: IMenu | Promise<IMenu>, timeout: number = 5000): Promise<HTMLElement | undefined> {
        return new Promise((resolve, reject) => {
            const pendingItem: PendingMenuItem = {
                option,
                resolve,
                reject,
                index: this.nextIndex++
            };

            // 设置超时
            const timeoutId = setTimeout(() => {
                const index = this.pendingItems.indexOf(pendingItem);
                if (index !== -1) {
                    this.pendingItems.splice(index, 1);
                    reject(new Error("异步菜单项超时"));
                }
            }, timeout);

            // 保存 timeoutId 以便清理
            pendingItem.timeoutId = timeoutId;

            this.pendingItems.push(pendingItem);
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processingQueue) {
            return;
        }
        this.processingQueue = true;

        // 创建队列的快照，避免处理过程中添加新项目
        const queueSnapshot = [...this.pendingItems];
        this.pendingItems = [];

        while (queueSnapshot.length > 0) {
            const item = queueSnapshot.shift();
            if (!item) {
                continue;
            }

            try {
                const resolvedOption = await this.resolveOption(item);

                // 即使菜单已关闭，也继续处理
                if (!this.isOpen) {
                    const element = this.menu.addItem(resolvedOption);
                    item.resolve(element);
                } else {
                    // 菜单已打开，存储选项等待下次打开
                    item.resolve(undefined);
                }
            } catch (error) {
                console.error("处理异步菜单项时出错:", error);
                item.reject(error);
            } finally {
                // 清理超时定时器
                if (item.timeoutId) {
                    clearTimeout(item.timeoutId);
                }
            }
        }

        this.processingQueue = false;

        // 如果在处理过程中有新项目添加，再次处理
        if (this.pendingItems.length > 0) {
            this.processQueue();
        }
    }

    addSeparator(options?: number | {
        index?: number,
        id?: string,
        ignore?: boolean
    }, ignoreParam = false) {
        // 兼容 3.1.24 之前的版本  addSeparator(index?: number, ignore?: boolean): HTMLElement;
        let id: string;
        let index: number;
        let ignore = false;
        if (typeof options === "object") {
            ignore = options.ignore || false;
            index = options.index;
            id = options.id;
        } else if (typeof options === "number") {
            index = options;
            ignore = ignoreParam;
        }
        if (ignore || this.isOpen) {
            return;
        }
        return this.menu.addItem({ id, type: "separator", index });
    }

    open(options: IPosition) {
        if (this.isOpen) {
            return;
        }
        this.menu.popup(options);
    }

    fullscreen(position: "bottom" | "all" = "all") {
        if (this.isOpen) {
            return;
        }
        this.menu.fullscreen(position);
    }

    close() {
        this.menu.remove();
    }

    /**
     * 取消指定索引的异步菜单项
     * @param index 菜单项索引
     * @returns 是否成功取消
     */
    cancelAsyncItem(index: number): boolean {
        const itemIndex = this.pendingItems.findIndex(item => item.index === index);
        if (itemIndex !== -1) {
            const item = this.pendingItems[itemIndex];
            this.pendingItems.splice(itemIndex, 1);
            item.reject(new Error("异步菜单项已取消"));
            if (item.timeoutId) {
                clearTimeout(item.timeoutId);
            }
            return true;
        }
        return false;
    }

    /**
     * 解析菜单选项，增强类型安全
     * @param option 菜单选项
     * @returns 解析后的菜单选项
     */
    private async resolveOption(item: PendingMenuItem): Promise<IMenu> {
        if (item.option instanceof Promise) {
            return await item.option;
        } else if (typeof item.option === "object" && item.option !== null) {
            return item.option;
        } else {
            throw new Error("无效的菜单选项类型");
        }
    }
}
