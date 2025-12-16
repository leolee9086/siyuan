import { Constants } from "../constants";
/// #if !MOBILE
import { getAllModels } from "../layout/getAll";
/// #endif
import { pathPosix } from "../util/pathName";
import * as dayjs from "dayjs";

export const renderAssetsPreview = (pathString: string) => {
    if (!pathString) {
        return "";
    }
    const type = pathPosix().extname(pathString).toLowerCase();
    if (Constants.SIYUAN_ASSETS_IMAGE.includes(type)) {
        return `<img style="max-height: 100%" src="${pathString}">`;
    }
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(type)) {
        return `<audio style="max-width: 100%" controls="controls" src="${pathString}"></audio>`;
    }
    if (Constants.SIYUAN_ASSETS_VIDEO.includes(type)) {
        return `<video style="max-width: 100%" controls="controls" src="${pathString}"></video>`;
    }
    return pathString;
};

export const pdfResize = () => {
    /// #if !MOBILE
    getAllModels().asset.forEach(item => {
        const pdfInstance = item.pdfObject;
        if (!pdfInstance) {
            return;
        }
        const { pdfDocument, pdfViewer } = pdfInstance;
        if (!pdfDocument) {
            return;
        }
        // https://github.com/siyuan-note/siyuan/issues/8097
        const pdfViewerElement = item.element.querySelector("#viewerContainer");
        if (!pdfViewerElement || pdfViewerElement.clientHeight === 0) {
            return;
        }
        const scrollTop = pdfViewerElement?.getAttribute("data-scrolltop");
        if (pdfViewerElement && scrollTop) {
            // https://github.com/siyuan-note/siyuan/issues/6890
            pdfViewerElement.scrollTo(0, parseInt(scrollTop));
            pdfViewerElement.removeAttribute("data-scrolltop");
        }
        const currentScaleValue = pdfViewer.currentScaleValue;
        if (
            currentScaleValue === "auto" ||
            currentScaleValue === "page-fit" ||
            currentScaleValue === "page-width"
        ) {
            // Note: the scale is constant for 'page-actual'.
            pdfViewer.currentScaleValue = currentScaleValue;
        }
        pdfViewer.update();
    });
    /// #endif
};

export const genAssetHTML = (type: string, pathString: string, imgName: string, linkName: string) => {
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(type)) {
        return /*html*/`
        <div data-node-id="${Lute.NewNodeID()}" data-type="NodeAudio" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}">
        <div class="iframe-content">
        <audio controls="controls" src="${pathString}"></audio>
        ${Constants.ZWSP}
        </div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    if (Constants.SIYUAN_ASSETS_IMAGE.includes(type)) {
        const netHTML = pathString.startsWith("assets/") ? "" : /*html*/`
            <span class="img__net">
                <svg>
                    <use xlink:href="#iconLanguage"></use>
                </svg>
            </span>`;
        return /*html*/`<span contenteditable="false" data-type="img" class="img"><span></span><span><span class="protyle-action protyle-icons"><span class="protyle-icon protyle-icon--only"><svg><use xlink:href="#iconMore"></use></svg></span></span><img src="${pathString}" data-src="${pathString}" alt="${imgName}" /><span class="protyle-action__drag"></span>${netHTML}<span class="protyle-action__title"></span></span><span> </span></span>`;
    }

    if (Constants.SIYUAN_ASSETS_VIDEO.includes(type)) {
        return `<div data-node-id="${Lute.NewNodeID()}" data-type="NodeVideo" class="iframe" updated="${dayjs().format("YYYYMMDDHHmmss")}"><div class="iframe-content">${Constants.ZWSP}<video controls="controls" src="${pathString}"></video><span class="protyle-action__drag" contenteditable="false"></span></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }

    return `<span data-type="a" data-href="${pathString}">${linkName}</span>`;
};
