/**
 * 用途：闪卡编辑器内容加载与答案揭示状态管理
 * 使用范围：openCard.ts 的 bindCardEvent / nextCard 流程
 * 说明：本模块自 openCard.ts 拆分而来，并完整移植上游 v3.8.0 的揭示逻辑：
 *  1. 以代数（generation）守卫防止过期加载回调覆盖新卡片；
 *  2. 答案检测改用 flashcardMode 的选择器方案（支持 blockquote/callout 与 custom-riff-decks）；
 *  3. 揭示前若卡片处于折叠态，先通过 setFold 事务展开再显示答案。
 */
import {fetchPost} from "./imports";

/**
 * 用途：提供应用常量定义（SIZE_GET_MAX、CB_GET_ALL）
 * 解耦评估：通过imports.ts转发，已经是最佳实践
 */
import {Constants} from "./imports";

/**
 * 用途：提供文档渲染功能（onGet）
 * 解耦评估：通过imports.ts转发，已经是最佳实践
 */
import {onGet} from "./imports";

/**
 * 用途：闪卡揭示状态与答案检测的纯函数工具集（上游 v3.8.0 新增模块）
 */
import {
    beginFlashcardLoad,
    createFlashcardRevealState,
    hasFlashcardAnswer,
    hideFlashcardAnswer,
    isCurrentFlashcardLoad,
    revealFlashcardAfterUnfold,
    showFlashcardAnswer
} from "./flashcardMode";
import {setFold} from "../protyle/util/blockFold";
import {transaction} from "../protyle/wysiwyg/transaction/submit";

/**
 * 每个 protyle 实例对应一份揭示状态，用于识别过期的加载与揭示流程
 */
const flashcardRevealStates = new WeakMap<IProtyle, ReturnType<typeof createFlashcardRevealState>>();

/**
 * 获取（或初始化）指定编辑器的闪卡揭示状态
 *
 * @param protyle - protyle 编辑器实例
 */
export const getFlashcardRevealState = (protyle: IProtyle) => {
    let state = flashcardRevealStates.get(protyle);
    if (!state) {
        state = createFlashcardRevealState();
        flashcardRevealStates.set(protyle, state);
    }
    return state;
};

/**
 * 隐藏"显示答案"按钮组，展示带到期时间的评分按钮组
 *
 * @param actionElements - 卡片操作按钮容器列表
 * @param currentCard - 当前卡片数据（提供各评级按钮的到期时间文本）
 */
export const showRatingActions = (actionElements: NodeListOf<Element>, currentCard: ICard) => {
    actionElements[0].classList.add("fn__none");
    actionElements[1].querySelectorAll("button.b3-button").forEach((element, btnIndex) => {
        if (btnIndex < 2) {
            return;
        }
        element.previousElementSibling.textContent = currentCard.nextDues[btnIndex - 1];
    });
    actionElements[1].classList.remove("fn__none");
};

/**
 * 揭示闪卡答案：若当前块处于折叠态则先通过事务展开，完成后再显示答案并回调
 *
 * @param protyle - protyle 编辑器实例
 * @param callback - 答案显示完成后的回调
 */
export const revealFlashcardAnswer = (protyle: IProtyle, callback: () => void) => {
    const revealState = getFlashcardRevealState(protyle);
    const generation = revealState.generation;
    const cardElement = protyle.wysiwyg.element.querySelector(
        `[data-node-id="${protyle.block.id}"][fold="1"]`
    );
    revealFlashcardAfterUnfold({
        state: revealState,
        generation,
        unfold: cardElement ? (done) => {
            const foldData = setFold(protyle, cardElement, true, false, true, true);
            if (!foldData.doOperations?.length) {
                done();
                return;
            }
            transaction(protyle, foldData.doOperations, foldData.undoOperations, {callback: done});
        } : undefined,
        reveal: () => {
            showFlashcardAnswer(protyle.element);
            callback();
        }
    });
};

/**
 * 获取并显示闪卡编辑器内容
 *
 * 作用：加载指定文档的内容到闪卡编辑器中，并在渲染完成后按配置决定
 *       直接显示评分按钮，还是先隐藏答案等待用户点击"显示答案"
 * 调用时机：打开闪卡进行复习时（bindCardEvent 与 nextCard）
 *
 * @param id - 文档块ID
 * @param protyle - protyle 编辑器实例
 * @param element - 卡片容器DOM元素
 * @param currentCard - 当前卡片的数据（包含复习间隔等信息）
 */
export const getEditor = (id: string, protyle: IProtyle, element: Element, currentCard: ICard) => {
    // 开始一次新的加载：递增代数使先前的异步回调全部失效
    const revealState = getFlashcardRevealState(protyle);
    const generation = beginFlashcardLoad(revealState);
    const actionElements = element.querySelectorAll(".card__action");
    actionElements.forEach(item => item.classList.add("fn__none"));
    actionElements[0].querySelectorAll('button[data-type="-1"], button[data-type="-3"]').forEach(item => {
        item.removeAttribute("disabled");
    });
    fetchPost("/api/block/getDocInfo", {
        id,
    }, (docResponse) => {
        // 过期的加载结果直接丢弃
        if (!isCurrentFlashcardLoad(revealState, generation)) {
            return;
        }
        protyle.wysiwyg.renderCustom(docResponse.data.ial);
        fetchPost("/api/filetree/getDoc", {
            id,
            mode: 0,
            size: Constants.SIZE_GET_MAX
        }, (response) => {
            // 过期的加载结果直接丢弃
            if (!isCurrentFlashcardLoad(revealState, generation)) {
                return;
            }
            onGet({
                updateReadonly: true,
                data: response,
                protyle,
                action: response.data.rootID === response.data.id ? [] : [Constants.CB_GET_ALL],
                afterCB: () => {
                    if (!isCurrentFlashcardLoad(revealState, generation) ||
                        protyle.element.classList.contains("fn__none")) {
                        return;
                    }
                    // 按配置与 custom-riff-decks 标记判断是否存在需要隐藏的答案内容
                    const hasHide = hasFlashcardAnswer(protyle.wysiwyg.element, window.siyuan.config.flashcard);
                    if (!hasHide) {
                        revealFlashcardAnswer(protyle, () => {
                            showRatingActions(actionElements, currentCard);
                        });
                    } else {
                        hideFlashcardAnswer(protyle.element, window.siyuan.config.flashcard);
                        actionElements[0].classList.remove("fn__none");
                        actionElements[1].classList.add("fn__none");
                    }
                }
            });
        });
    });
};
