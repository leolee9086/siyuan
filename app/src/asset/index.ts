import { Model } from "../layout/Model";
import { Tab } from "../layout/Tab";
import { Constants } from "../constants";
import { setPanelFocus } from "../layout/utils/setPanelFocus";
// @ts-ignore
import { onPageNumberChanged } from "./pdf/app";
/// #endif
import { fetchPost } from "../util/fetch";
import { App } from "../index";
import { clearOBG } from "../layout/dock/util";
import { render } from "./image";
import { createVueComponentLoader } from "../util/vue/mount";
import PDFviewer from "../components/PDFviewer.vue";
export class Asset extends Model {
    public path: string;
    public element: HTMLElement;
    private pdfId: number | string | undefined;
    private pdfPage: number | undefined;
    public pdfObject: any;

    constructor(options: { app: App, tab: Tab, path: string, page?: number | string }) {
        super({ app: options.app, id: options.tab.id });
        if (window.siyuan.config?.fileTree?.openFilesUseCurrentTab) {
            options.tab.headElement.classList.add("item--unupdate");
        }
        this.element = options.tab.panelElement;
        this.path = options.path;
        this.pdfId = options.page;
        this.element.addEventListener("click", (event) => {
            clearOBG();
            if (this.element.parentElement?.parentElement) {
                setPanelFocus(this.element.parentElement.parentElement);
            }
            this.app.plugins.forEach(item => {
                item.eventBus.emit("click-pdf", { event });
            });
        });
        if (typeof this.pdfId === "string") {
            this.getPdfId(() => {
                this.render();
            });
            return;
        }
        if (typeof this.pdfId === "number") {
            this.pdfPage = this.pdfId;
        }
        this.render();
    }

    private getPdfId(cb: () => void) {
        fetchPost("/api/asset/getFileAnnotation", {
            path: this.path + ".sya",
        }, (response) => {
            if (response.code === 1) {
                cb();
                return;
            }
            const config = JSON.parse(response.data.data);
            const pdfId = this.pdfId;
            if (typeof pdfId === "undefined" || !config[pdfId]) {
                this.pdfPage = undefined;
                cb();
                return;
            }
            this.pdfPage = config[pdfId].page ? config[pdfId].page + 1 : config[pdfId].pages[0].index + 1;
            cb();
        });
    }

    public goToPage(pdfId: string | number) {
        if (typeof pdfId === "undefined" || pdfId === null) {
            return;
        }
        this.pdfId = pdfId;
        /// #if !MOBILE
        if (typeof pdfId === "string") {
            this.getPdfId(() => {
                if (this.pdfPage) {
                    onPageNumberChanged({ value: this.pdfPage, pdfInstance: this.pdfObject, id: this.pdfId });
                }
            });
            return;
        }
        if (typeof pdfId === "number" && !isNaN(pdfId)) {
            onPageNumberChanged({ value: this.pdfId, pdfInstance: this.pdfObject });
        }
        /// #endif
    }

    private render() {
        const type = this.path.substr(this.path.lastIndexOf(".")).toLowerCase().split("?")[0] || "";
        if (Constants.SIYUAN_ASSETS_IMAGE.includes(type)) {
            render(this.element, this.path);
            return;
        }
        if (Constants.SIYUAN_ASSETS_AUDIO.includes(type)) {
            this.element.innerHTML = `<div class="asset"><audio controls="controls" src="${this.path.startsWith("file") ? this.path : document.getElementById("baseURL")?.getAttribute("href") + "/" + this.path}"></audio></div>`;
            return;
        }
        if (Constants.SIYUAN_ASSETS_VIDEO.includes(type)) {
            this.element.innerHTML = `<div class="asset"><video controls="controls" src="${this.path.startsWith("file") ? this.path : document.getElementById("baseURL")?.getAttribute("href") + "/" + this.path}"></video></div>`;
            return;
        }
        if (type === ".pdf") {
            /// #if !MOBILE
            createVueComponentLoader(
                this.element,
                {
                    components: { PDFviewer },
                    data: { controller: this },
                    template: "<PDFviewer :controller=\"controller\" />"
                }
            );
            /// #endif
        }
    }
}
