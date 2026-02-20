import {fetchPost} from "../util/fetch";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { isMobile } from "../platform";

export const flashcard = {
    element: undefined as Element,
    genHTML: () => {
        let responsiveHTML = `<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardMark}
        <div class="b3-label__text">${siyuanI18n.flashcardMarkTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="mark" type="checkbox"${window.siyuan.config.flashcard.mark ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardList}
        <div class="b3-label__text">${siyuanI18n.flashcardListTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="list" type="checkbox"${window.siyuan.config.flashcard.list ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardHeading}
        <div class="b3-label__text">${siyuanI18n.flashcardHeadingTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="heading" type="checkbox"${window.siyuan.config.flashcard.heading ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardSuperBlock}
        <div class="b3-label__text">${siyuanI18n.flashcardSuperBlockTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="superBlock" type="checkbox"${window.siyuan.config.flashcard.superBlock ? " checked" : ""}/>
</label>
<label class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardDeck}
        <div class="b3-label__text">${siyuanI18n.flashcardDeckTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-switch fn__flex-center" id="deck" type="checkbox"${window.siyuan.config.flashcard.deck ? " checked" : ""}/>
</label>
<div class="fn__flex b3-label config__item">
    <div class="fn__flex-1">
        ${siyuanI18n.reviewMode}
        <div class="b3-label__text">${siyuanI18n.reviewModeTip}</div>
    </div>
    <span class="fn__space"></span>
    <select class="b3-select fn__flex-center fn__size200" id="reviewMode">
      <option value="0" ${window.siyuan.config.flashcard.reviewMode === 0 ? "selected" : ""}>${siyuanI18n.reviewMode0}</option>
      <option value="1" ${window.siyuan.config.flashcard.reviewMode === 1 ? "selected" : ""}>${siyuanI18n.reviewMode1}</option>
      <option value="2" ${window.siyuan.config.flashcard.reviewMode === 2 ? "selected" : ""}>${siyuanI18n.reviewMode2}</option>
    </select>    
</div>`;
        if (isMobile) {
        responsiveHTML = `${responsiveHTML}<div class="b3-label">
    ${siyuanI18n.flashcardNewCardLimit}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="newCardLimit" step="1" min="0" type="number"${window.siyuan.config.flashcard.newCardLimit ? " checked" : ""} value="${window.siyuan.config.flashcard.newCardLimit}"/>
    <div class="b3-label__text">${siyuanI18n.flashcardNewCardLimitTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.flashcardReviewCardLimit}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="reviewCardLimit" step="1" min="0" type="number"${window.siyuan.config.flashcard.reviewCardLimit ? " checked" : ""} value="${window.siyuan.config.flashcard.reviewCardLimit}"/>
    <div class="b3-label__text">${siyuanI18n.flashcardReviewCardLimitTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.flashcardFSRSParamRequestRetention}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="requestRetention" step="0.01" min="0" max="1" type="number" value="${window.siyuan.config.flashcard.requestRetention}"/>
    <div class="b3-label__text">${siyuanI18n.flashcardFSRSParamRequestRetentionTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.flashcardFSRSParamMaximumInterval}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="maximumInterval" step="1" min="365" max="36500" type="number" value="${window.siyuan.config.flashcard.maximumInterval}"/>
    <div class="b3-label__text">${siyuanI18n.flashcardFSRSParamMaximumIntervalTip}</div>
</div>
<div class="b3-label">
    ${siyuanI18n.flashcardFSRSParamWeights}
    <div class="fn__hr"></div>
    <input class="b3-text-field fn__block" id="weights" value="${window.siyuan.config.flashcard.weights}"/>
    <div class="b3-label__text">${siyuanI18n.flashcardFSRSParamWeightsTip}</div>
</div>`;
        } else {
        responsiveHTML = `${responsiveHTML}<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardNewCardLimit}
        <div class="b3-label__text">${siyuanI18n.flashcardNewCardLimitTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="newCardLimit" step="1" min="0" type="number"${window.siyuan.config.flashcard.newCardLimit ? " checked" : ""} value="${window.siyuan.config.flashcard.newCardLimit}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardReviewCardLimit}
        <div class="b3-label__text">${siyuanI18n.flashcardReviewCardLimitTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="reviewCardLimit" step="1" min="0" type="number"${window.siyuan.config.flashcard.reviewCardLimit ? " checked" : ""} value="${window.siyuan.config.flashcard.reviewCardLimit}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardFSRSParamRequestRetention}
        <div class="b3-label__text">${siyuanI18n.flashcardFSRSParamRequestRetentionTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="requestRetention" step="0.01" min="0" max="1" type="number" value="${window.siyuan.config.flashcard.requestRetention}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__flex-1">
        ${siyuanI18n.flashcardFSRSParamMaximumInterval}
        <div class="b3-label__text">${siyuanI18n.flashcardFSRSParamMaximumIntervalTip}</div>
    </div>
    <span class="fn__space"></span>
    <input class="b3-text-field fn__flex-center fn__size200" id="maximumInterval" step="1" min="365" max="36500" type="number" value="${window.siyuan.config.flashcard.maximumInterval}"/>
</div>
<div class="fn__flex b3-label">
    <div class="fn__block">
        ${siyuanI18n.flashcardFSRSParamWeights}
        <div class="b3-label__text">${siyuanI18n.flashcardFSRSParamWeightsTip}</div>
        <span class="fn__hr"></span>
        <input class="b3-text-field fn__block" id="weights" value="${window.siyuan.config.flashcard.weights}"/>
    </div>
</div>`;
        }
        return responsiveHTML;
    },
    bindEvent: () => {
        flashcard.element.querySelectorAll("input, select.b3-select").forEach((item) => {
            item.addEventListener("change", () => {
                fetchPost("/api/setting/setFlashcard", {
                    reviewMode: parseInt((flashcard.element.querySelector("#reviewMode") as HTMLSelectElement).value),
                    newCardLimit: parseInt((flashcard.element.querySelector("#newCardLimit") as HTMLInputElement).value),
                    reviewCardLimit: parseInt((flashcard.element.querySelector("#reviewCardLimit") as HTMLInputElement).value),
                    mark: (flashcard.element.querySelector("#mark") as HTMLInputElement).checked,
                    list: (flashcard.element.querySelector("#list") as HTMLInputElement).checked,
                    superBlock: (flashcard.element.querySelector("#superBlock") as HTMLInputElement).checked,
                    heading: (flashcard.element.querySelector("#heading") as HTMLInputElement).checked,
                    deck: (flashcard.element.querySelector("#deck") as HTMLInputElement).checked,
                    requestRetention: parseFloat((flashcard.element.querySelector("#requestRetention") as HTMLInputElement).value),
                    maximumInterval: parseInt((flashcard.element.querySelector("#maximumInterval") as HTMLInputElement).value),
                    weights: (flashcard.element.querySelector("#weights") as HTMLInputElement).value,
                }, response => {
                    window.siyuan.config.flashcard = response.data;
                });
            });
        });
    },
};
