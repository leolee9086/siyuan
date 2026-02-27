import {fetchPost} from "../util/network/fetch";
import {Dialog} from "../dialog";
import {highlightRender} from "../protyle/render/highlightRender";
import {isMobile} from "../util/platform/functions";
import {Constants} from "../constants";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
export const openChangelog = () => {
    fetchPost("/api/system/getChangelog", {}, (response) => {
        if (!response.data.show) {
            return;
        }
        const dialog = new Dialog({
            title: `✨ ${siyuanI18n.whatsNewInSiYuan} v${window.siyuan.config.system.kernelVersion}`,
            width: isMobile() ? "92vw" : "768px",
            height: isMobile() ? "80vh" : "70vh",
            content: `<div style="overflow:auto;" class="b3-dialog__content b3-typography b3-typography--default">${response.data.html}</div>`
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_CHANGELOG);
        highlightRender(dialog.element);
    });
};
