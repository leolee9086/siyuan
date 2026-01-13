import { bindClickEvent, bindDropEvent, bindImgMoveEvent, bindUploadEvent, initBackgroundElement, renderBackground } from "./Background.util";

export class Background {
    public element!: HTMLElement;
    public ial!: IObject;
    public imgElement!: HTMLImageElement;
    public iconElement!: HTMLElement;
    public actionElements!: NodeListOf<Element>;
    public tagsElement!: HTMLElement;
    public transparentData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    constructor(protyle: IProtyle) {
        initBackgroundElement(this);
        bindDropEvent(this, protyle);
        bindImgMoveEvent(this);
        bindUploadEvent(this, protyle);
        bindClickEvent(this, protyle);
    }

    public render(ial: IObject, rootId: string) {
        renderBackground(this, ial, rootId);
    }
}
