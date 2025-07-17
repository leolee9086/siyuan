import {genUUID} from "../../util/genID";
import {moveResize} from "../../dialog/moveResize";
import {Constants} from "../../constants";
import {setStorageVal} from "../util/compatibility";

export interface ICustomPanelOptions {
    id?: string;
    title: string;
    icon?: string;
    content: string | HTMLElement;
    height?: string;
    minHeight?: string;
    maxHeight?: string;
    position?: "top" | "bottom";
    order?: number;
    destroyCallback?: () => void;
    resizeCallback?: (type: string) => void;
}

export class CustomPanel {
    public id: string;
    public title: string;
    public icon?: string;
    public element: HTMLElement;
    public contentElement: HTMLElement;
    public headerElement: HTMLElement;
    public resizeHandle: HTMLElement;
    private destroyCallback?: () => void;
    private resizeCallback?: (type: string) => void;
    private protyle: IProtyle;

    constructor(protyle: IProtyle, options: ICustomPanelOptions) {
        this.protyle = protyle;
        this.id = options.id || genUUID();
        this.title = options.title;
        this.icon = options.icon;
        this.destroyCallback = options.destroyCallback;
        this.resizeCallback = options.resizeCallback;

        // 创建面板容器
        this.element = document.createElement("div");
        this.element.className = "protyle-custom-panel";
        this.element.setAttribute("data-panel-id", this.id);
        this.element.style.cssText = `
            position: relative;
            border-top: 1px solid var(--b3-border-color);
            background: var(--b3-theme-background);
            overflow: hidden;
        `;

        // 创建头部
        this.headerElement = document.createElement("div");
        this.headerElement.className = "protyle-custom-panel__header";
        this.headerElement.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 12px;
            background: var(--b3-theme-surface);
            border-bottom: 1px solid var(--b3-border-color);
            cursor: move;
            user-select: none;
        `;

        // 图标
        if (this.icon) {
            const iconElement = document.createElement("svg");
            iconElement.className = "protyle-custom-panel__icon";
            iconElement.style.cssText = `
                width: 16px;
                height: 16px;
                margin-right: 8px;
                flex-shrink: 0;
            `;
            iconElement.innerHTML = `<use xlink:href="#${this.icon}"></use>`;
            this.headerElement.appendChild(iconElement);
        }

        // 标题
        const titleElement = document.createElement("span");
        titleElement.className = "protyle-custom-panel__title";
        titleElement.textContent = this.title;
        titleElement.style.cssText = `
            flex: 1;
            font-size: 14px;
            font-weight: 500;
            color: var(--b3-theme-on-surface);
        `;
        this.headerElement.appendChild(titleElement);

        // 缩回按钮
        const collapseButton = document.createElement("button");
        collapseButton.className = "protyle-custom-panel__collapse";
        collapseButton.style.cssText = `
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: var(--b3-theme-on-surface);
            opacity: 0.6;
            transition: opacity 0.2s;
            margin-right: 4px;
        `;
        collapseButton.innerHTML = `<svg width="16" height="16"><use xlink:href="#iconDown"></use></svg>`;
        collapseButton.setAttribute("title", "缩回面板");
        collapseButton.addEventListener("mouseenter", () => {
            collapseButton.style.opacity = "1";
        });
        collapseButton.addEventListener("mouseleave", () => {
            collapseButton.style.opacity = "0.6";
        });
        collapseButton.addEventListener("click", () => {
            this.collapse();
        });
        this.headerElement.appendChild(collapseButton);

        // 关闭按钮
        const closeButton = document.createElement("button");
        closeButton.className = "protyle-custom-panel__close";
        closeButton.style.cssText = `
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: var(--b3-theme-on-surface);
            opacity: 0.6;
            transition: opacity 0.2s;
        `;
        closeButton.innerHTML = `<svg width="16" height="16"><use xlink:href="#iconClose"></use></svg>`;
        closeButton.setAttribute("title", "关闭面板");
        closeButton.addEventListener("mouseenter", () => {
            closeButton.style.opacity = "1";
        });
        closeButton.addEventListener("mouseleave", () => {
            closeButton.style.opacity = "0.6";
        });
        closeButton.addEventListener("click", () => {
            this.destroy();
        });
        this.headerElement.appendChild(closeButton);

        // 创建内容容器
        this.contentElement = document.createElement("div");
        this.contentElement.className = "protyle-custom-panel__content";
        this.contentElement.style.cssText = `
            height: ${options.height || "300px"};
            min-height: ${options.minHeight || "200px"};
            max-height: ${options.maxHeight || "80vh"};
            overflow: auto;
            padding: 12px;
        `;

        // 设置内容
        if (typeof options.content === "string") {
            this.contentElement.innerHTML = options.content;
        } else {
            this.contentElement.appendChild(options.content);
        }

        // 创建调节手柄
        this.resizeHandle = document.createElement("div");
        this.resizeHandle.className = "protyle-custom-panel__resize-handle";
        this.resizeHandle.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            cursor: ns-resize;
            background: transparent;
            z-index: 10;
        `;

        // 组装面板
        this.element.appendChild(this.headerElement);
        this.element.appendChild(this.contentElement);
        this.element.appendChild(this.resizeHandle);

        // 绑定调节功能
        this.bindResize();
    }

    private bindResize() {
        let startY = 0;
        let startHeight = 0;
        let isResizing = false;

        this.resizeHandle.addEventListener("mousedown", (event: MouseEvent) => {
            event.preventDefault();
            isResizing = true;
            startY = event.clientY;
            startHeight = this.contentElement.offsetHeight;
            
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        });

        const handleMouseMove = (event: MouseEvent) => {
            if (!isResizing) return;
            
            const deltaY = event.clientY - startY;
            const newHeight = Math.max(200, Math.min(800, startHeight - deltaY));
            
            this.contentElement.style.height = `${newHeight}px`;
            
            if (this.resizeCallback) {
                this.resizeCallback("resize");
            }
        };

        const handleMouseUp = () => {
            isResizing = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            
            // 保存面板高度
            this.savePanelHeight();
        };
    }

    private savePanelHeight() {
        if (!window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION]) {
            window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION] = {};
        }
        
        const panelKey = `custom-panel-${this.id}`;
        window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION][panelKey] = {
            height: this.contentElement.offsetHeight
        };
        setStorageVal(Constants.LOCAL_DIALOGPOSITION, window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION]);
    }

    public show() {
        this.element.classList.remove("fn__none");
        this.protyle.customPanelsElement.classList.remove("fn__none");
    }

    public hide() {
        this.element.classList.add("fn__none");
        // 检查是否还有其他可见面板
        const visiblePanels = this.protyle.customPanelsElement.querySelectorAll(".protyle-custom-panel:not(.fn__none)");
        if (visiblePanels.length === 0) {
            this.protyle.customPanelsElement.classList.add("fn__none");
        }
    }

    public destroy() {
        this.element.remove();
        // 检查是否还有其他面板
        const remainingPanels = this.protyle.customPanelsElement.querySelectorAll(".protyle-custom-panel");
        if (remainingPanels.length === 0) {
            this.protyle.customPanelsElement.classList.add("fn__none");
        }
        
        if (this.destroyCallback) {
            this.destroyCallback();
        }
    }

    public updateContent(content: string | HTMLElement) {
        this.contentElement.innerHTML = "";
        if (typeof content === "string") {
            this.contentElement.innerHTML = content;
        } else {
            this.contentElement.appendChild(content);
        }
    }

    public setHeight(height: string) {
        this.contentElement.style.height = height;
        this.savePanelHeight();
    }

    public setDestroyCallback(callback: () => void) {
        this.destroyCallback = callback;
    }

    public collapse() {
        // 保存当前高度
        const currentHeight = this.contentElement.offsetHeight;
        this.savePanelHeight();
        
        // 隐藏内容区域
        this.contentElement.style.display = "none";
        this.resizeHandle.style.display = "none";
        
        // 更新缩回按钮图标和功能
        const collapseButton = this.headerElement.querySelector('.protyle-custom-panel__collapse') as HTMLButtonElement;
        if (collapseButton) {
            collapseButton.innerHTML = `<svg width="16" height="16"><use xlink:href="#iconUp"></use></svg>`;
            collapseButton.setAttribute("title", "展开面板");
            collapseButton.onclick = () => this.expand();
        }
    }

    public expand() {
        // 显示内容区域
        this.contentElement.style.display = "block";
        this.resizeHandle.style.display = "block";
        
        // 恢复保存的高度
        if (!window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION]) {
            window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION] = {};
        }
        const panelKey = `custom-panel-${this.id}`;
        const savedHeight = window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION][panelKey];
        if (savedHeight && savedHeight.height) {
            this.contentElement.style.height = `${savedHeight.height}px`;
        }
        
        // 更新缩回按钮图标和功能
        const collapseButton = this.headerElement.querySelector('.protyle-custom-panel__collapse') as HTMLButtonElement;
        if (collapseButton) {
            collapseButton.innerHTML = `<svg width="16" height="16"><use xlink:href="#iconDown"></use></svg>`;
            collapseButton.setAttribute("title", "缩回面板");
            collapseButton.onclick = () => this.collapse();
        }
    }
}

// 全局面板管理器
export class CustomPanelManager {
    private static panels = new Map<string, CustomPanel>();

    public static addPanel(protyle: IProtyle, options: ICustomPanelOptions): CustomPanel {
        // 确保自定义面板容器存在
        if (!protyle.customPanelsElement) {
            protyle.customPanelsElement = document.createElement("div");
            protyle.customPanelsElement.className = "protyle-custom-panels fn__none";
            protyle.customPanelsElement.style.cssText = `
                position: relative;
                overflow: hidden;
            `;
            protyle.element.appendChild(protyle.customPanelsElement);
        }

        const panel = new CustomPanel(protyle, options);
        protyle.customPanelsElement.appendChild(panel.element);
        
        // 恢复保存的高度
        if (!window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION]) {
            window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION] = {};
        }
        const panelKey = `custom-panel-${panel.id}`;
        const savedHeight = window.siyuan.storage[Constants.LOCAL_DIALOGPOSITION][panelKey];
        if (savedHeight && savedHeight.height) {
            panel.setHeight(`${savedHeight.height}px`);
        }

        this.panels.set(panel.id, panel);
        return panel;
    }

    public static getPanel(id: string): CustomPanel | undefined {
        return this.panels.get(id);
    }

    public static removePanel(id: string) {
        const panel = this.panels.get(id);
        if (panel) {
            panel.destroy();
            this.panels.delete(id);
        }
    }

    public static getAllPanels(): CustomPanel[] {
        return Array.from(this.panels.values());
    }

    public static clearAllPanels() {
        this.panels.forEach(panel => panel.destroy());
        this.panels.clear();
    }
} 