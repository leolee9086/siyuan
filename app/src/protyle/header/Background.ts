import { bindClickEvent } from "./background/events";
import { bindDropEvent, bindUploadEvent } from "./background/upload";
import { bindImgMoveEvent } from "./background/image";
import { initBackgroundElement } from "./background/init";
import { renderBackground } from "./background/render";
import {bindDocTagContextMenu, bindTagSortEvent} from "./background/tags";
import {backgroundBrand} from "./background/background.types";

export class Background {
    public get [backgroundBrand]() {
        return "Background" as const;
    }

    public element!: HTMLElement;
    public ial!: IObject;
    public imgElement!: HTMLImageElement;
    public iconElement!: HTMLElement;
    public actionElements!: NodeListOf<Element>;
    public tagsElement!: HTMLElement;
    public transparentData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    public dragOccurred = false;

    constructor(protyle: IProtyle) {
        initBackgroundElement(this);
        bindDropEvent(this, protyle);
        bindImgMoveEvent(this);
        bindUploadEvent(this, protyle);
        bindClickEvent(this, protyle);
        bindTagSortEvent(this, protyle);
        bindDocTagContextMenu(this, protyle);
    }
    /**
     * 作用：渲染题头图。
     * 意图：根据传入的 IAL 和 rootId，更新题头图的显示。
     * @param ial 
     * @param rootId 
     */
    public render(ial: IObject, rootId: string) {
        renderBackground(this, ial, rootId);
    }
}
