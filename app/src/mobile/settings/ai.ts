import { openModel } from "../menu/model";
import { genProvidersBlockHtml, mountProvidersBlock } from "../../config/tabs/aiUi";

export const initAI = () => {
    openModel({
        title: "AI",
        icon: "iconSparkles",
        html: `<div style="overflow-y: auto;max-height: 80vh;">${genProvidersBlockHtml()}</div>`,
        bindEvent(modelMainElement: HTMLElement) {
            mountProvidersBlock(modelMainElement);
        },
    });
};
