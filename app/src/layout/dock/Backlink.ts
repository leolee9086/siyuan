import type {LayoutTab} from "../layout.types";
import { Model } from "../Model";
import { Tree } from "../../util/file/tree/Tree";
import { setPanelFocus } from "../utils/setPanelFocus";
import {getDockByType} from "./imports";
import { fetchPost } from "../../util/network/fetch";
import { Constants } from "../../constants";
import { updateHotkeyAfterTip } from "../../protyle/util/compatibility";
import { MenuItem } from "../../menus/Menu.Item";
import type { AppFacade } from "../../app/AppFacade.types";
import { isSupportCSSHL, searchMarkRender } from "../../protyle/render/searchMarkRender";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {getDocDisplayName} from "../../util/file/pathName";
import {isEncryptedBox} from "../../util/file/notebook/store";
import {getAllModels} from "../getAll";
import type {BacklinkPresentation, BacklinkRenderData, BacklinkStatusItem, BacklinkUserTrigger, ProtyleDomain, TreeDomain} from "./backlink/backlink.types";
import {backlinkModelBrand} from "./backlink/backlink.types";
import {resolveBacklinkToolbarCommand, type BacklinkToolbarCommand} from "./backlink/backlinkToolbar.router";
import {reportBacklinkUserOperationIntent} from "./backlink/backlinkOperationIntent";

export class Backlink extends Model<AppFacade, LayoutTab> {
    public get [backlinkModelBrand]() {
        return "Backlink" as const;
    }

    public element: HTMLElement;
    public inputsElement: NodeListOf<HTMLInputElement>;
    public type: BacklinkPresentation;
    public blockId: string;
    public rootId: string; // "local" 必传
    public ownerProtyle?: ProtyleDomain["protyle"];
    public tree: TreeDomain;
    private notebookId = "";
    public mTree: TreeDomain;
    public editors: ProtyleDomain[] = [];
    public status: Record<string, BacklinkStatusItem> = {};
    private dirty = false;
    private isDestroyed = false;
    private focusRefreshTimer: number | undefined;
    private restoreScrollTimer: number | undefined;
    private readonly handleFocusOut = () => {
        window.clearTimeout(this.focusRefreshTimer);
        this.focusRefreshTimer = window.setTimeout(() => this.refreshIfVisible());
    };

    constructor(options: {
        app: AppFacade,
        tab?: LayoutTab,
        element?: HTMLElement,
        blockId: string,
        rootId?: string,
        type: BacklinkPresentation,
        ownerProtyle?: ProtyleDomain["protyle"],
    }) {
        super({app: options.app});
        if (options.tab) {
            this.parent = options.tab;
        }
        if (options.type !== "bottom") {
            if (!options.tab) {
                throw new Error("Dock Backlink requires a layout tab");
            }
            this.connect({
                id: options.tab.id,
                type: "backlink",
                callback: this.handelCallback.bind(this),
                msgCallback: this.handleMsgCallback.bind(this),
            });
        }

        this.blockId = options.blockId;
        this.rootId = options.rootId || "";
        this.type = options.type;
        if (options.ownerProtyle) {
            this.ownerProtyle = options.ownerProtyle;
        }
        const element = options.element || options.tab?.panelElement;
        if (!element) {
            throw new Error("Backlink requires a panel element");
        }
        this.element = element;
        this.element.classList.add("fn__flex-column", "file-tree", "sy__backlink", "dockPanel");
        if (this.type === "bottom") {
            this.element.classList.add("sy__backlink--bottom");
            this.element.tabIndex = -1;
            this.element.addEventListener("focusout", this.handleFocusOut);
        }
        const backlinkSort = window.siyuan.config.editor.backlinkSort;
        const backmentionSort = window.siyuan.config.editor.backmentionSort;
        this.element.innerHTML = `<div class="block__icons">
    <div class="block__logo fn__flex-1${this.type === "bottom" ? " fn__pointer" : ""}"${this.type === "bottom" ? ' data-type="backlink"' : ""}>${siyuanI18n.backlinks}</div>
    <span class="counter listCount" style="margin-left: 0"></span>
    <span class="fn__space"></span>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${window.siyuan.languages.filterKeywordEnter}" />
    <span data-type="search" class="block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.filter}"><svg><use xlink:href='#iconFilter'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="refresh" class="block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.refresh}"><svg><use xlink:href='#iconRefresh'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="sort" data-sort="${backlinkSort}" class="block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.sort}"><svg><use xlink:href='#iconSort'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="expand" class="block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.expand}${updateHotkeyAfterTip(window.siyuan.config.keymap.editor.general.expand.custom)}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="collapse" class="block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.collapse}${updateHotkeyAfterTip(window.siyuan.config.keymap.editor.general.collapse.custom)}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="${this.type === "bottom" ? "" : "fn__none "}fn__space"></span>
    <span data-type="bLayout" class="${this.type === "bottom" ? "" : "fn__none "}block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.collapse}"><svg><use xlink:href='#iconDown'></use></svg></span>
    <span class="${this.type === "pin" ? "" : "fn__none "}fn__space"></span>
    <span data-type="min" class="${this.type === "pin" ? "" : "fn__none "}block__icon ariaLabel" data-position="north" aria-label="${window.siyuan.languages.min}${updateHotkeyAfterTip(window.siyuan.config.keymap.general.closeTab.custom)}"><svg><use xlink:href='#iconMin'></use></svg></span>
</div>
<div class="backlinkList fn__flex-1"></div>
<div class="block__icons">
    <div class="block__logo fn__flex-1 fn__pointer" data-type="mention">${siyuanI18n.mentions}</div>
    <span class="counter listMCount" style="margin-left: 0;"></span>
    <span class="fn__space"></span>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <span data-type="search" class="block__icon b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.filter}"><svg><use xlink:href='#iconFilter'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="mSort" data-sort="${backmentionSort}" class="block__icon b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.sort}"><svg><use xlink:href='#iconSort'></use></svg></span>
    <span class="fn__space"></span>
    <span data-type="mExpand" class="block__icon b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.expand}">
        <svg><use xlink:href="#iconExpand"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="mCollapse" class="block__icon b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.collapse}">
        <svg><use xlink:href="#iconContract"></use></svg>
    </span>
    <span class="fn__space"></span>
    <span data-type="layout" class="block__icon b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.down}">
        <svg><use xlink:href="#iconDown"></use></svg>
    </span>
</div>
<div class="backlinkMList fn__flex-1"></div>`;

        this.inputsElement = this.element.querySelectorAll("input");
        this.inputsElement.forEach((item) => {
            item.addEventListener("blur", (event: KeyboardEvent) => {
                const inputElement = event.target as HTMLInputElement;
                inputElement.classList.add("fn__none");
                const filterIconElement = inputElement.nextElementSibling;
                if (inputElement.value) {
                    filterIconElement.classList.add("block__icon--active");
                    filterIconElement.setAttribute("aria-label", siyuanI18n.filter + " " + inputElement.value);
                } else {
                    filterIconElement.classList.remove("block__icon--active");
                    filterIconElement.setAttribute("aria-label", siyuanI18n.filter);
                }
            });
            item.addEventListener("keydown", (event: KeyboardEvent) => {
                if (!event.isComposing && event.key === "Enter") {
                    this.searchBacklinks();
                    this.reportUserOperation("filter", "filter-backlinks", "keyboard");
                }
            });
        });
        this.tree = new Tree({
            element: this.element.querySelector(".backlinkList") as HTMLElement,
            data: null,
            click: (element) => {
                this.activateTreeItem(element, "click");
            },
            ctrlClick: (element) => {
                options.app.openBlock({
                    id: element.getAttribute("data-node-id"),
                    action: [Constants.CB_GET_CONTEXT],
                    zoomIn: false,
                });
                this.mTree.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                this.reportUserOperation("tree", "open-backlink-result", "ctrl-click", element.getAttribute("data-node-id"));
            },
            altClick: (element) => {
                options.app.openBlock({
                    id: element.getAttribute("data-node-id"),
                    position: "right",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT],
                    zoomIn: false,
                });
                this.mTree.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                this.reportUserOperation("tree", "open-backlink-result", "alt-click", element.getAttribute("data-node-id"));
            },
            shiftClick: (element) => {
                options.app.openBlock({
                    id: element.getAttribute("data-node-id"),
                    position: "bottom",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT],
                    zoomIn: false,
                });
                this.mTree.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                this.reportUserOperation("tree", "open-backlink-result", "shift-click", element.getAttribute("data-node-id"));
            },
            toggleClick: (liElement) => {
                this.activateTreeItem(liElement, "click");
            }
        });
        this.mTree = new Tree({
            element: this.element.querySelector(".backlinkMList") as HTMLElement,
            data: null,
            click: (element) => {
                this.activateTreeItem(element, "click");
            },
            ctrlClick: (element) => {
                options.app.openBlock({
                    id: element.getAttribute("data-node-id"),
                    action: [Constants.CB_GET_CONTEXT],
                    zoomIn: false,
                });
                this.tree.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                this.reportUserOperation("tree", "open-backmention-result", "ctrl-click", element.getAttribute("data-node-id"));
            },
            altClick: (element) => {
                options.app.openBlock({
                    id: element.getAttribute("data-node-id"),
                    position: "right",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT],
                    zoomIn: false,
                });
                this.tree.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                this.reportUserOperation("tree", "open-backmention-result", "alt-click", element.getAttribute("data-node-id"));
            },
            shiftClick: (element) => {
                options.app.openBlock({
                    id: element.getAttribute("data-node-id"),
                    position: "bottom",
                    action: [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT],
                    zoomIn: false,
                });
                this.tree.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                this.reportUserOperation("tree", "open-backmention-result", "shift-click", element.getAttribute("data-node-id"));
            },
            toggleClick: (liElement) => {
                this.activateTreeItem(liElement, "click");
            },
            blockExtHTML: `<span class="b3-list-item__action b3-tooltips b3-tooltips__nw" aria-label="${siyuanI18n.more}"><svg><use xlink:href="#iconMore"></use></svg></span>`
        });
        this.tree.element.addEventListener("scroll", () => {
            this.tree.element.querySelectorAll(".protyle-gutters").forEach(item => {
                item.classList.add("fn__none");
                item.innerHTML = "";
            });
            this.tree.element.querySelectorAll(".protyle-wysiwyg--hl").forEach((hlItem) => {
                hlItem.classList.remove("protyle-wysiwyg--hl");
            });
        });
        this.mTree.element.addEventListener("scroll", () => {
            this.mTree.element.querySelectorAll(".protyle-gutters").forEach(item => {
                item.classList.add("fn__none");
                item.innerHTML = "";
            });
            this.mTree.element.querySelectorAll(".protyle-wysiwyg--hl").forEach((hlItem) => {
                hlItem.classList.remove("protyle-wysiwyg--hl");
            });
        });
        this.element.addEventListener("click", (event) => {
            let target = event.target as HTMLElement;
            const eventProtyleElement = target.closest(".protyle");
            if (this.type !== "bottom" || !eventProtyleElement || !this.element.contains(eventProtyleElement)) {
                this.setFocus();
            }
            while (target && !target.isEqualNode(this.element)) {
                if ((target.classList.contains("block__icon") || target.classList.contains("block__logo")) &&
                    target.parentElement.parentElement === this.element) {
                    this.executeToolbarCommand(resolveBacklinkToolbarCommand(target.getAttribute("data-type"), this.type), target, event);
                }
                target = target.parentElement;
            }
        });

        this.searchBacklinks(true);
    }

    /** Runs commands that were already partitioned by the toolbar state router. */
    private executeToolbarCommand(command: BacklinkToolbarCommand, target: HTMLElement, event: MouseEvent) {
        switch (command.kind) {
            case "refresh":
                this.refresh();
                this.reportUserOperation("toolbar", "refresh-backlinks", "click");
                break;
            case "expand-backlinks":
                this.setTreeExpanded(this.tree, false, true);
                this.reportUserOperation("toolbar", "expand-backlinks", "click");
                break;
            case "collapse-backlinks":
                this.setTreeExpanded(this.tree, false, false);
                this.reportUserOperation("toolbar", "collapse-backlinks", "click");
                break;
            case "expand-mentions":
                this.setTreeExpanded(this.mTree, true, true);
                this.reportUserOperation("toolbar", "expand-backmentions", "click");
                break;
            case "collapse-mentions":
                this.setTreeExpanded(this.mTree, true, false);
                this.reportUserOperation("toolbar", "collapse-backmentions", "click");
                break;
            case "minimize":
                getDockByType("backlink").toggleModel("backlink", false, true);
                this.reportUserOperation("toolbar", "minimize-backlinks", "click");
                break;
            case "show-filter": {
                const input = target.previousElementSibling;
                if (!(input instanceof HTMLInputElement)) {
                    return;
                }
                input.classList.remove("fn__none");
                input.select();
                this.reportUserOperation("toolbar", "open-filter", "click");
                break;
            }
            case "show-sort": {
                const sort = target.getAttribute("data-sort");
                if (sort === null) {
                    return;
                }
                this.showSortMenu(command.sortTarget, sort);
                window.siyuan.menus.menu.popup({x: event.clientX, y: event.clientY});
                this.reportUserOperation("toolbar", "open-sort-menu", "click");
                break;
            }
            case "cycle-mention-layout": {
                const layoutElement = target.getAttribute("data-type") === "mention"
                    ? target.parentElement?.querySelector<HTMLElement>('[data-type="layout"]')
                    : target;
                if (!layoutElement) {
                    return;
                }
                this.setLayout(layoutElement);
                this.reportUserOperation("toolbar", "cycle-backmention-layout", "click");
                break;
            }
            case "toggle-bottom-layout": {
                const control = target.parentElement?.querySelector<HTMLElement>(command.target === "backlink"
                    ? '[data-type="bLayout"]'
                    : '[data-type="layout"]');
                if (!control) {
                    return;
                }
                const list = command.target === "backlink" ? this.tree.element : this.mTree.element;
                this.setBottomLayout(control, list);
                this.reportUserOperation(
                    "toolbar",
                    command.target === "backlink" ? "toggle-backlinks-layout" : "toggle-backmentions-layout",
                    "click",
                );
                break;
            }
            case "ignore":
                return;
        }
        event.stopPropagation();
    }

    /** Executes the same routed toolbar action for a keyboard gesture. */
    public executeKeyboardToolbarAction(action: "expand" | "collapse") {
        const command = resolveBacklinkToolbarCommand(action, this.type);
        if (command.kind === "expand-backlinks") {
            this.setTreeExpanded(this.tree, false, true);
            this.reportUserOperation("toolbar", "expand-backlinks", "keyboard");
            return;
        }
        if (command.kind === "collapse-backlinks") {
            this.setTreeExpanded(this.tree, false, false);
            this.reportUserOperation("toolbar", "collapse-backlinks", "keyboard");
        }
    }

    /** Activates a result from a mouse or keyboard interaction. */
    public activateTreeItem(item: HTMLElement, trigger: BacklinkUserTrigger) {
        const isBackmention = this.mTree.element.contains(item);
        this.toggleItem(item, isBackmention);
        this.setFocus();
        (isBackmention ? this.tree : this.mTree).element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        this.reportUserOperation(
            "tree",
            isBackmention ? "toggle-backmention-result" : "toggle-backlink-result",
            trigger,
            item.getAttribute("data-node-id"),
        );
    }

    /** Expands or folds the nested document underneath a focused result. */
    public toggleTreeItem(item: HTMLElement, trigger: BacklinkUserTrigger) {
        const isBackmention = this.mTree.element.contains(item);
        (isBackmention ? this.mTree : this.tree).toggleBlocks(item);
        this.reportUserOperation(
            "tree",
            isBackmention ? "toggle-backmention-children" : "toggle-backlink-children",
            trigger,
            item.getAttribute("data-node-id"),
        );
    }

    /** Reports keyboard focus movement after the keydown owner updates DOM focus. */
    public reportKeyboardTreeNavigation(item: HTMLElement) {
        const isBackmention = this.mTree.element.contains(item);
        this.reportUserOperation(
            "tree",
            isBackmention ? "focus-backmention-result" : "focus-backlink-result",
            "keyboard",
            item.getAttribute("data-node-id"),
        );
    }

    private reportUserOperation(
        source: "toolbar" | "tree" | "filter" | "sort-menu",
        operation: string,
        trigger: BacklinkUserTrigger,
        targetBlockId?: string | null,
    ) {
        const intent = {
            actor: "user",
            surface: "backlink",
            presentation: this.type,
            source,
            operation,
            trigger,
            blockId: this.blockId || null,
        } as const;
        reportBacklinkUserOperationIntent(this.app, targetBlockId === undefined
            ? intent
            : {...intent, targetBlockId});
    }

    private setTreeExpanded(tree: TreeDomain, isBackmention: boolean, expanded: boolean) {
        if (expanded) {
            Array.from(tree.element.firstElementChild?.children || []).forEach((item: HTMLElement) => {
                if (item.tagName === "LI" && !item.querySelector(".b3-list-item__arrow--open")) {
                    this.toggleItem(item, isBackmention);
                }
            });
            return;
        }
        tree.element.querySelectorAll(".protyle").forEach(item => item.classList.add("fn__none"));
        tree.element.querySelectorAll(".b3-list-item__arrow").forEach(item => item.classList.remove("b3-list-item__arrow--open"));
    }

    private handelCallback() {
        if (this.type === "local") {
            fetchPost("/api/block/checkBlockExist", {id: this.blockId}, existResponse => {
                if (!existResponse.data) {
                    this.parent?.parent.removeTab(this.parent.id);
                }
            });
        }
    }

    private handleMsgCallback(data: IWebSocketData) {
        if (data && this.type === "local") {
            switch (data.cmd) {
                case "rename":
                    if (this.rootId === data.data.id) {
                        this.parent?.updateTitle(getDocDisplayName(data.data.title, data.data.empty));
                    }
                    break;
                case "closeBox":
                case "removeBox":
                    if (this.notebookId === data.data.box && this.type === "local") {
                        this.parent?.parent.removeTab(this.parent.id);
                    }
                    break;
                case "removeDoc":
                    if (data.data.ids.includes(this.rootId) && this.type === "local") {
                        this.parent?.parent.removeTab(this.parent.id);
                    }
                    break;
            }
        }
    }

    private setLayout(element: HTMLElement) {
        if (this.mTree.element.style.flex) {
            if (this.mTree.element.style.height === "0px") {
                this.tree.element.classList.remove("fn__none");
                this.mTree.element.removeAttribute("style");
                element.setAttribute("aria-label", window.siyuan.languages.up);
                element.querySelector("use").setAttribute("xlink:href", "#iconUp");
            } else {
                this.tree.element.classList.remove("fn__none");
                this.mTree.element.removeAttribute("style");
                element.setAttribute("aria-label", window.siyuan.languages.down);
                element.querySelector("use").setAttribute("xlink:href", "#iconDown");
            }
        } else {
            if (element.getAttribute("aria-label") === window.siyuan.languages.down) {
                this.tree.element.classList.remove("fn__none");
                this.mTree.element.setAttribute("style", "flex:none;height:0px");
                element.setAttribute("aria-label", window.siyuan.languages.up);
                element.querySelector("use").setAttribute("xlink:href", "#iconUp");
            } else {
                this.tree.element.classList.add("fn__none");
                this.mTree.element.setAttribute("style", `flex:none;height:${this.element.clientHeight - this.tree.element.previousElementSibling.clientHeight * 2}px`);
                element.setAttribute("aria-label", window.siyuan.languages.down);
                element.querySelector("use").setAttribute("xlink:href", "#iconDown");
            }
        }
        this.tree.element.dispatchEvent(new CustomEvent("scroll"));
        this.mTree.element.dispatchEvent(new CustomEvent("scroll"));
    }

    /** Bottom panels fold each result list independently without changing the dock layout. */
    private setBottomLayout(element: HTMLElement, listElement: HTMLElement) {
        const folded = !listElement.classList.contains("fn__none");
        listElement.classList.toggle("fn__none", folded);
        if (folded) {
            listElement.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        }
        element.setAttribute("aria-label", folded ? window.siyuan.languages.expand : window.siyuan.languages.collapse);
        element.querySelector("use")?.setAttribute("xlink:href", folded ? "#iconRight" : "#iconDown");
        this.saveStatus();
    }

    private setFocus() {
        if (this.type === "bottom") {
            this.setOwnerFocus();
            this.element.focus({preventScroll: true});
            return;
        }
        if (this.type === "local") {
            const panel = this.element.parentElement?.parentElement;
            if (panel) {
                setPanelFocus(panel);
            }
        } else {
            setPanelFocus(this.element);
        }
    }

    private setOwnerFocus() {
        const wndElement = this.ownerProtyle?.element.closest('[data-type="wnd"]');
        if (wndElement) {
            setPanelFocus(wndElement);
        }
    }

    private showSortMenu(type: string, sort: string) {
        const clickEvent = (currentSort: string) => {
            (type === "sort" ? this.tree : this.mTree).element.previousElementSibling.querySelector(`[data-type="${type}"]`).setAttribute("data-sort", currentSort);
            // 保存排序状态到配置
            const sortValue = parseInt(currentSort);
            if (type === "sort") {
                window.siyuan.config.editor.backlinkSort = sortValue;
            } else {
                window.siyuan.config.editor.backmentionSort = sortValue;
            }
            fetchPost("/api/setting/setEditor", window.siyuan.config.editor, (response) => {
                window.siyuan.config.editor = response.data;
            });
            this.searchBacklinks();
            this.reportUserOperation("sort-menu", type === "sort" ? "sort-backlinks" : "sort-backmentions", "click");
        };
        window.siyuan.menus.menu.remove();
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "0" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameASC,
            click: () => {
                clickEvent("0");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "1" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameDESC,
            click: () => {
                clickEvent("1");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "4" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameNatASC,
            click: () => {
                clickEvent("4");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "5" ? "iconSelect" : undefined,
            label: siyuanI18n.fileNameNatDESC,
            click: () => {
                clickEvent("5");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({ type: "separator" }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "9" ? "iconSelect" : undefined,
            label: siyuanI18n.createdASC,
            click: () => {
                clickEvent("9");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "10" ? "iconSelect" : undefined,
            label: siyuanI18n.createdDESC,
            click: () => {
                clickEvent("10");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "2" ? "iconSelect" : undefined,
            label: siyuanI18n.modifiedASC,
            click: () => {
                clickEvent("2");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            icon: sort === "3" ? "iconSelect" : undefined,
            label: siyuanI18n.modifiedDESC,
            click: () => {
                clickEvent("3");
            }
        }).element);
    }

    private toggleItem(liElement: HTMLElement, isMention: boolean) {
        if (this.isDestroyed) {
            return;
        }
        const svgElement = liElement.firstElementChild?.firstElementChild;
        if (!svgElement || svgElement.getAttribute("disabled")) {
            return;
        }
        svgElement.setAttribute("disabled", "disabled");
        const docId = liElement.getAttribute("data-node-id");
        if (svgElement.classList.contains("b3-list-item__arrow--open")) {
            svgElement.classList.remove("b3-list-item__arrow--open");
            this.editors.find((item, index) => {
                if (item.protyle.block.rootID === docId && liElement.nextElementSibling && item.protyle.element === liElement.nextElementSibling) {
                    item.destroy();
                    this.editors.splice(index, 1);
                    liElement.nextElementSibling.remove();
                    return true;
                }
            });
            svgElement.removeAttribute("disabled");
        } else {
            const keyword = isMention ? this.inputsElement[1].value : this.inputsElement[0].value;
            fetchPost(isMention ? "/api/ref/getBackmentionDoc" : "/api/ref/getBacklinkDoc", {
                defID: this.blockId,
                refTreeID: docId,
                highlight: !isSupportCSSHL(),
                keyword,
            }, (response) => {
                if (this.isDestroyed) {
                    return;
                }
                svgElement.removeAttribute("disabled");
                svgElement.classList.add("b3-list-item__arrow--open");
                const editorElement = document.createElement("div");
                editorElement.style.minHeight = "auto";
                editorElement.setAttribute("data-defid", this.blockId);
                editorElement.setAttribute("data-ismention", isMention ? "true" : "false");
                liElement.after(editorElement);
                const editor = this.app.createProtyle(editorElement, {
                    blockId: docId,
                    click: {
                        preventInsetEmptyBlock: true
                    },
                    backlinkData: isMention ? response.data.backmentions : response.data.backlinks,
                    render: {
                        background: false,
                        gutter: true,
                        scroll: false,
                        breadcrumb: false,
                    }
                });
                editor.protyle.notebookId = liElement.getAttribute("data-notebook-id");
                searchMarkRender(editor.protyle, response.data.keywords);
                this.editors.push(editor);
            });
        }
    }

    public refresh() {
        const element = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (this.isDestroyed || !this.blockId || !element || element.classList.contains("fn__rotate")) {
            return;
        }
        element.classList.add("fn__rotate");
        fetchPost("/api/ref/refreshBacklink", {
            id: this.blockId,
        }, () => {
            if (this.isDestroyed) {
                return;
            }
            element.classList.remove("fn__rotate");
            this.searchBacklinks();
        });
    }

    private searchBacklinks(init = false) {
        const element = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (this.isDestroyed || !element || element.classList.contains("fn__rotate")) {
            return;
        }
        element.classList.add("fn__rotate");
        // 首次查询尚无响应中的 box，需从承载该根文档的编辑器确定加密数据源。
        let notebookId = this.notebookId;
        const contextRootId = this.rootId || this.blockId;
        if (!notebookId && contextRootId) {
            getAllModels().editor.some(item => {
                if (item.editor.protyle.block.rootID === contextRootId) {
                    notebookId = item.editor.protyle.notebookId;
                    return true;
                }
            });
        }
        const param: IObject = {
            sort: parseInt(this.tree.element.previousElementSibling.querySelector('[data-type="sort"]').getAttribute("data-sort")).toString(),
            mSort: parseInt(this.mTree.element.previousElementSibling.querySelector('[data-type="mSort"]').getAttribute("data-sort")).toString(),
            k: this.inputsElement[0].value,
            mk: this.inputsElement[1].value,
            id: this.blockId,
        };
        if (isEncryptedBox(notebookId)) {
            param.notebook = notebookId;
        }
        fetchPost("/api/ref/getBacklink2", param, response => {
            if (this.isDestroyed) {
                return;
            }
            if (!init) {
                this.saveStatus();
            }
            this.render(response.data);
        });
    }

    public saveStatus() {
        this.status[this.blockId] = {
            sort: parseInt(this.tree.element.previousElementSibling.querySelector('[data-type="sort"]').getAttribute("data-sort")),
            mSort: parseInt(this.mTree.element.previousElementSibling.querySelector('[data-type="mSort"]').getAttribute("data-sort")),
            scrollTop: this.tree.element.scrollTop,
            mScrollTop: this.mTree.element.scrollTop,
            backlinkOpenIds: [],
            backlinkMOpenIds: [],
            backlinkMStatus: 3, // 0 全展开，1 展开一半箭头向下，2 展开一半箭头向上，3 全收起
            backlinkFolded: this.tree.element.classList.contains("fn__none"),
            backmentionFolded: this.mTree.element.classList.contains("fn__none"),
        };
        this.tree.element.querySelectorAll(".b3-list-item__arrow--open").forEach(item => {
            this.status[this.blockId].backlinkOpenIds.push(item.parentElement.parentElement.getAttribute("data-node-id"));
        });
        this.mTree.element.querySelectorAll(".b3-list-item__arrow--open").forEach(item => {
            this.status[this.blockId].backlinkMOpenIds.push(item.parentElement.parentElement.getAttribute("data-node-id"));
        });
        if (this.mTree.element.style.flex) {
            if (this.mTree.element.style.height === "0px") {
                this.status[this.blockId].backlinkMStatus = 3;
            } else {
                this.status[this.blockId].backlinkMStatus = 0;
            }
        } else {
            if (this.mTree.element.previousElementSibling.querySelector('[data-type="layout"]').getAttribute("aria-label") === siyuanI18n.down) {
                this.status[this.blockId].backlinkMStatus = 1;
            } else {
                this.status[this.blockId].backlinkMStatus = 2;
            }
        }
    }

    public render(data: BacklinkRenderData | undefined) {
        if (this.isDestroyed) {
            return;
        }
        if (!data) {
            data = {
                box: "",
                backlinks: [],
                backmentions: [],
                linkRefsCount: 0,
                mentionsCount: 0,
                k: "",
                mk: ""
            };
        }

        this.editors.forEach(item => {
            item.destroy();
        });
        this.editors = [];
        this.element.querySelector('.block__icon[data-type="refresh"] svg').classList.remove("fn__rotate");
        this.notebookId = data.box;
        this.inputsElement[0].value = data.k;
        this.inputsElement[1].value = data.mk;
        this.tree.updateData(data.backlinks);
        this.mTree.updateData(data.backmentions);

        const countElement = this.element.querySelector(".listCount");
        if (data.linkRefsCount === 0) {
            countElement.classList.add("fn__none");
        } else {
            countElement.classList.remove("fn__none");
            countElement.textContent = data.linkRefsCount.toString();
        }
        const mCountElement = this.element.querySelector(".listMCount");
        if (data.mentionsCount === 0) {
            mCountElement.classList.add("fn__none");
        } else {
            mCountElement.classList.remove("fn__none");
            mCountElement.textContent = data.mentionsCount.toString();
        }

        if (!this.status[this.blockId]) {
            this.status[this.blockId] = {
                sort: window.siyuan.config.editor.backlinkSort,
                mSort: window.siyuan.config.editor.backmentionSort,
                scrollTop: 0,
                mScrollTop: 0,
            backlinkOpenIds: [],
            backlinkMOpenIds: [],
            backlinkMStatus: 3,
            backlinkFolded: false,
            backmentionFolded: false,
            };
            if (data.mentionsCount === 0 || window.siyuan.config.editor.backmentionExpandCount === -1) {
                this.status[this.blockId].backlinkMStatus = 3;
            } else {
                Array.from({ length: window.siyuan.config.editor.backmentionExpandCount }).forEach((item, index) => {
                    if (data.backmentions[index]) {
                        this.status[this.blockId].backlinkMOpenIds.push(data.backmentions[index].id);
                    }
                });
                if (data.mentionsCount === 0) {
                    this.status[this.blockId].backlinkMStatus = 3;
                } else {
                    if (data.linkRefsCount === 0) {
                        this.status[this.blockId].backlinkMStatus = 0;
                    } else {
                        this.status[this.blockId].backlinkMStatus = 1;
                    }
                }
            }
            if (data.linkRefsCount > 0) {
                Array.from({ length: window.siyuan.config.editor.backlinkExpandCount }).forEach((item, index) => {
                    if (data.backlinks[index]) {
                        this.status[this.blockId].backlinkOpenIds.push(data.backlinks[index].id);
                    }
                });
            }
        }

        // restore status
        this.status[this.blockId].backlinkOpenIds.forEach(item => {
            const liElement = this.tree.element.querySelector(`.b3-list-item[data-node-id="${item}"]`) as HTMLElement;
            if (liElement) {
                this.toggleItem(liElement, false);
            }
        });
        this.status[this.blockId].backlinkMOpenIds.forEach(item => {
            const liElement = this.mTree.element.querySelector(`.b3-list-item[data-node-id="${item}"]`) as HTMLElement;
            if (liElement) {
                this.toggleItem(liElement, true);
            }
        });
        // 0 全展开，1 展开一半箭头向下，2 展开一半箭头向上，3 全收起
        const layoutElement = this.mTree.element.previousElementSibling.querySelector('[data-type="layout"]');
        if (this.status[this.blockId].backlinkMStatus === 2 || this.status[this.blockId].backlinkMStatus === 1) {
            this.tree.element.classList.remove("fn__none");
            this.mTree.element.removeAttribute("style");
            if (this.status[this.blockId].backlinkMStatus === 1) {
                layoutElement.setAttribute("aria-label", siyuanI18n.down);
                layoutElement.querySelector("use").setAttribute("xlink:href", "#iconDown");
            } else {
                layoutElement.setAttribute("aria-label", siyuanI18n.up);
                layoutElement.querySelector("use").setAttribute("xlink:href", "#iconUp");
            }
        } else if (this.status[this.blockId].backlinkMStatus === 3) {
            this.tree.element.classList.remove("fn__none");
            this.mTree.element.setAttribute("style", "flex:none;height:0px");
            layoutElement.setAttribute("aria-label", siyuanI18n.up);
            layoutElement.querySelector("use").setAttribute("xlink:href", "#iconUp");
        } else {
            this.tree.element.classList.add("fn__none");
            this.mTree.element.setAttribute("style", `flex:none;height:${this.element.clientHeight - this.tree.element.previousElementSibling.clientHeight * 2}px`);
            layoutElement.setAttribute("aria-label", siyuanI18n.down);
            layoutElement.querySelector("use").setAttribute("xlink:href", "#iconDown");
        }
        this.tree.element.previousElementSibling.querySelector('[data-type="sort"]').setAttribute("data-sort", this.status[this.blockId].sort.toString());
        this.mTree.element.previousElementSibling.querySelector('[data-type="mSort"]').setAttribute("data-sort", this.status[this.blockId].mSort.toString());

        if (this.type === "bottom") {
            const backlinkLayout = this.element.querySelector<HTMLElement>('[data-type="bLayout"]');
            const backmentionLayout = this.element.querySelector<HTMLElement>('[data-type="layout"]');
            if (backlinkLayout) {
                this.restoreBottomLayout(backlinkLayout, this.tree.element, this.status[this.blockId].backlinkFolded === true);
            }
            if (backmentionLayout) {
                this.restoreBottomLayout(backmentionLayout, this.mTree.element, this.status[this.blockId].backmentionFolded === true);
            }
        }

        window.clearTimeout(this.restoreScrollTimer);
        this.restoreScrollTimer = window.setTimeout(() => {
            if (this.isDestroyed) {
                return;
            }
            this.tree.element.scrollTop = this.status[this.blockId].scrollTop;
            this.mTree.element.scrollTop = this.status[this.blockId].mScrollTop;
        }, Constants.TIMEOUT_LOAD);

        const refreshAfterRender = this.dirty && this.type === "bottom" && !this.element.classList.contains("fn__none");
        this.dirty = false;
        if (refreshAfterRender) {
            this.searchBacklinks();
        }
    }

    /** A data change may arrive while the panel is off-screen; defer I/O until it becomes visible. */
    public markDirty() {
        if (!this.isDestroyed) {
            this.dirty = true;
        }
    }

    /** Focus and observer paths share the same visibility-aware refresh boundary. */
    public refreshIfVisible() {
        if (this.type !== "bottom" || this.isDestroyed || this.element.classList.contains("fn__none")) {
            return;
        }
        this.refreshDirty();
    }

    /** Executes one deferred refresh only when no request is already rendering this panel. */
    public refreshDirty() {
        const refreshIcon = this.element.querySelector('.block__icon[data-type="refresh"] svg');
        if (this.isDestroyed || !this.dirty || refreshIcon?.classList.contains("fn__rotate")) {
            return;
        }
        this.dirty = false;
        this.searchBacklinks();
    }

    /** Releases child editors, timers, focus listeners, and the optional model transport. */
    public destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        window.clearTimeout(this.focusRefreshTimer);
        window.clearTimeout(this.restoreScrollTimer);
        this.element.removeEventListener("focusout", this.handleFocusOut);
        this.editors.forEach(item => item.destroy());
        this.editors = [];
        this.dispose();
    }

    private restoreBottomLayout(element: HTMLElement, listElement: HTMLElement, folded: boolean) {
        listElement.classList.toggle("fn__none", folded);
        element.setAttribute("aria-label", folded ? window.siyuan.languages.expand : window.siyuan.languages.collapse);
        element.querySelector("use")?.setAttribute("xlink:href", folded ? "#iconRight" : "#iconDown");
    }
}
