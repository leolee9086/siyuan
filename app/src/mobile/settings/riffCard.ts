import {openModel} from "../menu/model";
import {flashcard} from "../../config/flashcard";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const initRiffCard = () => {
    openModel({
        title: siyuanI18n.riffCard,
        icon: "iconRiffCard",
        html: flashcard.genHTML(),
        bindEvent(modelMainElement: HTMLElement) {
            flashcard.element = modelMainElement;
            flashcard.bindEvent();
        }
    });
};
