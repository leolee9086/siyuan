/**
 * 用途：提供HTTP POST请求功能
 * 使用范围：调用后端API获取文档信息和内容
 * 解耦评估：通过imports.ts转发，已经是最佳实践
 */
import { fetchPost } from "./imports";

/**
 * 用途：提供应用常量定义
 * 使用范围：使用SIZE_GET_MAX和CB_GET_ALL常量
 * 解耦评估：通过imports.ts转发，已经是最佳实践
 */
import { Constants } from "./imports";

/**
 * 用途：提供文档渲染功能
 * 使用范围：将API返回的数据渲染到编辑器
 * 解耦评估：通过imports.ts转发，已经是最佳实践
 */
import { onGet } from "./imports";

/**
 * 用途：检查是否启用超级块隐藏
 * 使用范围：判断是否需要隐藏超级块元素
 * 解耦评估：通过flashcard.global.ts封装window访问，已解耦
 */
import { isSuperBlockHideEnabled } from "./flashcard.global";

/**
 * 用途：检查是否启用标题隐藏
 * 使用范围：判断是否需要隐藏标题元素
 * 解耦评估：通过flashcard.global.ts封装window访问，已解耦
 */
import { isHeadingHideEnabled } from "./flashcard.global";

/**
 * 用途：检查是否启用列表隐藏
 * 使用范围：判断是否需要隐藏列表元素
 * 解耦评估：通过flashcard.global.ts封装window访问，已解耦
 */
import { isListHideEnabled } from "./flashcard.global";

/**
 * 用途：检查是否启用标记隐藏
 * 使用范围：判断是否需要隐藏标记元素
 * 解耦评估：通过flashcard.global.ts封装window访问，已解耦
 */
import { isMarkHideEnabled } from "./flashcard.global";

/**
 * 检查是否需要隐藏闪卡元素
 * 
 * 作用：根据配置和DOM内容判断是否需要隐藏特定类型的闪卡元素
 * 意图：将复杂的隐藏逻辑提取为独立函数，提高可读性
 * 调用时机：在文档加载完成后，需要决定显示哪些操作按钮时
 * 
 * @param wysiwyg - 编辑器的wysiwyg对象
 * @returns 是否需要隐藏元素
 */
const shouldHideElements = (wysiwyg: IProtyle["wysiwyg"]) => {
    // 如果所有隐藏选项都未启用，则不需要隐藏
    if (!isSuperBlockHideEnabled() && 
        !isHeadingHideEnabled() && 
        !isListHideEnabled() && 
        !isMarkHideEnabled()) {
        return false;
    }

    const element = wysiwyg?.element;
    if (!element) {
        return false;
    }

    // 用户启用了超级块隐藏且文档中存在超级块时需要隐藏
    if (isSuperBlockHideEnabled() && element.querySelector(":scope > .sb")) {
        return true;
    }

    // 用户启用了标题隐藏且文档中存在标题时需要隐藏
    if (isHeadingHideEnabled() && element.querySelector(':scope > [data-type="NodeHeading"]')) {
        return true;
    }

    // 用户启用了列表隐藏且文档中存在列表时需要隐藏
    if (isListHideEnabled() && element.querySelector(".list, .li")) {
        return true;
    }

    // 用户启用了标记隐藏且文档中存在标记时需要隐藏
    if (isMarkHideEnabled() && element.querySelector('span[data-type~="mark"]')) {
        return true;
    }

    return false;
};

/**
 * 应用隐藏样式类
 * 
 * 作用：根据配置为protyle元素添加相应的隐藏样式类
 * 意图：将样式类应用逻辑独立出来，避免重复代码
 * 调用时机：当确定需要隐藏元素时
 * 
 * @param protyleElement - protyle的DOM元素
 */
const applyHideClasses = (protyleElement: HTMLElement) => {
    // 用户启用了超级块隐藏时添加对应样式类
    if (isSuperBlockHideEnabled()) {
        protyleElement.classList.add("card__block--hidesb");
    }
    // 用户启用了标题隐藏时添加对应样式类
    if (isHeadingHideEnabled()) {
        protyleElement.classList.add("card__block--hideh");
    }
    // 用户启用了列表隐藏时添加对应样式类
    if (isListHideEnabled()) {
        protyleElement.classList.add("card__block--hideli");
    }
    // 用户启用了标记隐藏时添加对应样式类
    if (isMarkHideEnabled()) {
        protyleElement.classList.add("card__block--hidemark");
    }
};

/**
 * 更新按钮的到期时间显示
 * 
 * 作用：为操作按钮更新下次复习的到期时间文本
 * 意图：将按钮更新逻辑提取为独立函数
 * 调用时机：当不需要隐藏元素，显示完整操作按钮时
 * 
 * @param actionElement - 操作按钮容器元素
 * @param currentCard - 当前卡片数据
 */
const updateButtonDueDates = (actionElement: Element, currentCard: ICard) => {
    const buttons = actionElement.querySelectorAll("button.b3-button");
    
    for (const [btnIndex, button] of Array.from(buttons).entries()) {
        // 跳过前两个按钮
        if (btnIndex < 2) {
            continue;
        }
        
        const prevSibling = button.previousElementSibling;
        if (prevSibling) {
            prevSibling.textContent = currentCard.nextDues[btnIndex - 1] ?? null;
        }
    }
};

/**
 * 显示完整操作按钮
 * 
 * 作用：当不需要隐藏元素时，显示完整的操作按钮组
 * 意图：将显示逻辑独立出来
 * 调用时机：shouldHideElements返回false时
 * 
 * @param protyle - protyle对象
 * @param actionElements - 操作按钮元素列表
 * @param currentCard - 当前卡片数据
 */
const showFullActions = (
    protyle: IProtyle,
    actionElements: NodeListOf<Element>,
    currentCard: ICard
) => {
    protyle.element.classList.remove(
        "card__block--hidemark",
        "card__block--hideli",
        "card__block--hidesb",
        "card__block--hideh"
    );
    
    const firstAction = actionElements[0];
    if (firstAction) {
        firstAction.classList.add("fn__none");
    }
    
    const secondAction = actionElements[1];
    if (secondAction) {
        updateButtonDueDates(secondAction, currentCard);
        secondAction.classList.remove("fn__none");
    }
};

/**
 * 显示隐藏操作按钮
 * 
 * 作用：当需要隐藏元素时，显示"显示"按钮并隐藏其他按钮
 * 意图：将隐藏模式的UI更新逻辑独立出来
 * 调用时机：shouldHideElements返回true时
 * 
 * @param protyle - protyle对象
 * @param actionElements - 操作按钮元素列表
 */
const showHideActions = (
    protyle: IProtyle,
    actionElements: NodeListOf<Element>
) => {
    applyHideClasses(protyle.element);
    
    const firstAction = actionElements[0];
    if (firstAction) {
        firstAction.classList.remove("fn__none");
    }
    
    const secondAction = actionElements[1];
    if (secondAction) {
        secondAction.classList.add("fn__none");
    }
};

/**
 * 处理文档加载完成后的回调
 * 
 * 作用：在文档内容加载完成后，根据配置更新UI显示
 * 意图：将afterCB回调逻辑提取为独立函数，减少嵌套
 * 调用时机：onGet的afterCB参数
 * 
 * @param protyle - protyle对象
 * @param element - 卡片容器元素
 * @param currentCard - 当前卡片数据
 */
const handleDocLoaded = (
    protyle: IProtyle,
    element: Element,
    currentCard: ICard
) => {
    // 如果protyle元素被隐藏，直接返回
    if (protyle.element.classList.contains("fn__none")) {
        return;
    }

    const hasHide = shouldHideElements(protyle.wysiwyg);
    const actionElements = element.querySelectorAll(".card__action");

    if (!hasHide) {
        showFullActions(protyle, actionElements, currentCard);
        return;
    }

    showHideActions(protyle, actionElements);
};

/**
 * 处理获取文档内容的响应
 *
 * 作用：处理/api/filetree/getDoc接口的响应，渲染文档内容
 * 意图：将文档获取回调提取为独立函数
 * 调用时机：fetchPost获取文档内容成功后
 *
 * @param response - API响应数据
 * @param protyle - protyle对象
 * @param element - 卡片容器元素
 * @param currentCard - 当前卡片数据
 */
const handleGetDocResponse = (
    response: IWebSocketData,
    protyle: IProtyle,
    element: Element,
    currentCard: ICard
) => {
    const isRootDoc = response.data.rootID === response.data.id;
    
    onGet({
        updateReadonly: true,
        data: response,
        protyle,
        action: isRootDoc ? [] : [Constants.CB_GET_ALL],
        /**
         * 文档渲染完成后的回调
         *
         * 作用：在文档渲染完成后更新UI状态
         * 意图：作为onGet的afterCB参数，在渲染完成时触发
         * 调用时机：protyle完成文档渲染后
         */
        afterCB: () => handleDocLoaded(protyle, element, currentCard)
    });
};

/**
 * 处理文档信息响应的回调
 *
 * 作用：在获取文档信息后，渲染自定义属性并继续获取文档内容
 * 意图：将回调逻辑提取为命名函数以符合lint规则
 * 调用时机：fetchPost获取文档信息成功后
 */
const handleDocInfoCallback = (
    docResponse: IWebSocketData,
    id: string,
    protyle: IProtyle,
    element: Element,
    currentCard: ICard
) => {
    // 渲染自定义属性
    protyle.wysiwyg?.renderCustom(docResponse.data.ial);
    
    // 然后获取完整的文档内容
    fetchPost("/api/filetree/getDoc", {
        id,
        mode: 0,
        size: Constants.SIZE_GET_MAX
    }, (response) => {
        handleGetDocResponse(response, protyle, element, currentCard);
    });
};

/**
 * 获取并显示闪卡编辑器内容
 *
 * 作用：加载指定文档的内容到闪卡编辑器中，并根据配置显示/隐藏特定元素
 * 意图：为闪卡复习提供文档内容展示功能
 * 调用时机：打开闪卡进行复习时，需要显示卡片内容
 *
 * @param id - 文档块ID
 * @param protyle - protyle编辑器实例
 * @param element - 卡片容器DOM元素
 * @param currentCard - 当前卡片的数据（包含复习间隔等信息）
 * @柯里化
 */
export const getEditor = async (
    id: string,
    protyle: IProtyle,
    element: Element,
    currentCard: ICard
) => {
    // 首先获取文档信息以获取IAL属性
    fetchPost("/api/block/getDocInfo", {
        id,
    }, (docResponse) => {
        handleDocInfoCallback(docResponse, id, protyle, element, currentCard);
    });
};
