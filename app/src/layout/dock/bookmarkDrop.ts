import {Constants} from "../../constants";
import {fetchPost} from "../../util/network/fetch";
import {isBookmarkTabDropData} from "./bookmark.guard";
import {parseBlockReferenceDropData} from "../../util/blockReferenceDrop.guard";

interface IBookmarkDropOptions {
    element: HTMLElement;
    onChanged: () => void;
}

/** 管理书签面板的块拖出、外部块拖入、目标高亮与属性写入。 */
export class BookmarkDropController {
    private readonly element: HTMLElement;
    private readonly onChanged: () => void;
    private dragoverElement: HTMLElement | undefined;
    private dragenterCounter = 0;

    constructor(options: IBookmarkDropOptions) {
        this.element = options.element;
        this.onChanged = options.onChanged;
    }

    public bind() {
        this.element.addEventListener("dragenter", (event) => {
            if (this.isSupportedDrop(event.dataTransfer)) {
                this.dragenterCounter++;
                event.preventDefault();
            }
        });
        this.element.addEventListener("dragover", (event: DragEvent & {target: HTMLElement}) => this.handleDragOver(event));
        this.element.addEventListener("dragleave", () => {
            this.dragenterCounter--;
            if (this.dragenterCounter <= 0) {
                this.dragenterCounter = 0;
                this.clearDropTarget();
            }
        });
        this.element.addEventListener("drop", (event: DragEvent & {target: HTMLElement}) => this.handleDrop(event));
    }

    public handleDragStart(element: HTMLElement, event: DragEvent) {
        const id = element.dataset.nodeId;
        if (!id) {
            return false;
        }
        event.dataTransfer?.setData(Constants.SIYUAN_DROP_BLOCK_REF, JSON.stringify({
            ids: [id],
            workspaceDir: window.siyuan.config.system.workspaceDir,
        }));
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "copyMove";
        }
        element.style.opacity = "0.38";
        window.siyuan.dragElement = undefined;
        window.siyuan.dragTitle = element.querySelector(".b3-list-item__text")?.textContent?.trim() || "";
        return true;
    }

    public handleDragEnd(element: HTMLElement) {
        element.style.opacity = "1";
        window.siyuan.dragElement = undefined;
        window.siyuan.dragTitle = "";
        this.dragenterCounter = 0;
        this.clearDropTarget();
        return true;
    }

    private handleDragOver(event: DragEvent & {target: HTMLElement}) {
        if (!this.isSupportedDrop(event.dataTransfer)) {
            return;
        }
        const target = this.getDropTarget(event.target);
        if (!target) {
            this.clearDropTarget();
            return;
        }
        if (target !== this.dragoverElement) {
            this.clearDropTarget();
            target.classList.add("dragover");
            this.dragoverElement = target;
        }
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = event.dataTransfer.types.includes(Constants.SIYUAN_DROP_BLOCK_REF) ? "move" : "copy";
        }
        event.preventDefault();
    }

    private handleDrop(event: DragEvent & {target: HTMLElement}) {
        this.dragenterCounter = 0;
        const target = this.getDropTarget(event.target);
        this.clearDropTarget();
        if (!target || !this.isSupportedDrop(event.dataTransfer)) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const ids = this.getDropBlockIds(event.dataTransfer);
        const bookmark = target.classList.contains("b3-list--empty") ? window.siyuan.languages.default : target.dataset.bookmark;
        if (ids.length === 0 || !bookmark) {
            return;
        }
        fetchPost("/api/attr/batchSetBlockAttrs", {
            blockAttrs: ids.map(id => ({id, attrs: {bookmark}})),
        }, this.onChanged);
    }

    private isSupportedDrop(dataTransfer: DataTransfer | null) {
        if (!dataTransfer || window.siyuan.config.readonly) {
            return false;
        }
        if (dataTransfer.types.includes(Constants.SIYUAN_DROP_BLOCK_REF)) {
            return true;
        }
        const gutterType = Array.from(dataTransfer.types).find(type => type.startsWith(Constants.SIYUAN_DROP_GUTTER));
        if (gutterType) {
            return this.isSupportedGutterType(gutterType);
        }
        return dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE) || dataTransfer.types.includes(Constants.SIYUAN_DROP_TAB);
    }

    private isSupportedGutterType(gutterType: string) {
        const types = gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP);
        const isAttributeViewItem = types[0] === "nodeattributeviewrowmenu" || types[0] === "nodeattributeviewrow" ||
            (types[0] === "nodeattributeview" && ["viewtab", "col", "galleryitem"].includes(types[1] || ""));
        if (isAttributeViewItem || types[0] === "nodethematicbreak") {
            return false;
        }
        return !types[3] || types[3] === window.siyuan.config.system.workspaceDir.toLowerCase();
    }

    private getDropBlockIds(dataTransfer: DataTransfer | null) {
        if (!dataTransfer) {
            return [];
        }
        if (dataTransfer.types.includes(Constants.SIYUAN_DROP_BLOCK_REF)) {
            return this.getBlockReferenceIds(dataTransfer);
        }
        const gutterType = Array.from(dataTransfer.types).find(type => type.startsWith(Constants.SIYUAN_DROP_GUTTER));
        if (gutterType) {
            const ids = (gutterType.replace(Constants.SIYUAN_DROP_GUTTER, "").split(Constants.ZWSP)[2] || "").split(",");
            return this.normalizeBlockIds(ids);
        }
        return this.normalizeBlockIds(this.getFileOrTabIds(dataTransfer));
    }

    private normalizeBlockIds(ids: string[]) {
        return Array.from(new Set(ids.filter(id => /^\d{14}-[0-9a-z]{7}$/.test(id))));
    }

    private getBlockReferenceIds(dataTransfer: DataTransfer) {
        try {
            return parseBlockReferenceDropData(
                dataTransfer.getData(Constants.SIYUAN_DROP_BLOCK_REF),
                window.siyuan.config.system.workspaceDir,
            );
        } catch (error) {
            console.warn("parse bookmark drop block reference data failed", error);
        }
        return [];
    }

    private getFileOrTabIds(dataTransfer: DataTransfer) {
        if (dataTransfer.types.includes(Constants.SIYUAN_DROP_FILE)) {
            return dataTransfer.getData(Constants.SIYUAN_DROP_FILE).split(",");
        }
        if (!dataTransfer.types.includes(Constants.SIYUAN_DROP_TAB)) {
            return [];
        }
        try {
            const data: unknown = JSON.parse(dataTransfer.getData(Constants.SIYUAN_DROP_TAB));
            return isBookmarkTabDropData(data) && data.children.instance === "Editor" ? [data.children.rootId] : [];
        } catch (error) {
            console.warn("parse bookmark drop tab data failed", error);
            return [];
        }
    }

    private getDropTarget(target: HTMLElement) {
        const emptyElement = this.element.querySelector<HTMLElement>(".b3-list--empty");
        if (emptyElement) {
            return emptyElement;
        }
        let item = target.closest<HTMLElement>('li[data-treetype="bookmark"]');
        if (!item || !this.element.contains(item)) {
            return undefined;
        }
        while (item.dataset.nodeId) {
            const parent = item.parentElement?.previousElementSibling;
            if (!(parent instanceof HTMLElement) || parent.dataset.treetype !== "bookmark") {
                return undefined;
            }
            item = parent;
        }
        return item;
    }

    private clearDropTarget() {
        this.dragoverElement?.classList.remove("dragover");
        this.dragoverElement = undefined;
    }
}
