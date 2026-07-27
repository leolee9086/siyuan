/** 在列表反链整体收起时折叠根列表；渲染结果缺失时显式暴露调用顺序错误。 */
const foldPassiveRootList = (element: HTMLElement | DocumentFragment) => {
    const rootList = element.firstElementChild;
    if (!rootList) {
        throw new Error("Passive list folding requires a rendered list");
    }
    rootList.setAttribute("fold", "1");
};

/** 按展开配置投影列表反链；收起时折叠根列表，展开时只折叠过长的嵌套列表。 */
const foldPassiveList = (expand: boolean, element: HTMLElement | DocumentFragment) => {
    if (!expand) {
        foldPassiveRootList(element);
        return;
    }
    for (const item of element.querySelectorAll(".li .li")) {
        if (item.childElementCount <= 3) {
            continue;
        }
        item.setAttribute("fold", "1");
    }
};

/** 折叠标题反链的尾部内容，并在第一个隐藏块前插入唯一 More 标记。 */
const foldPassiveHeading = (expand: boolean, element: HTMLElement | DocumentFragment) => {
    const children = Array.from(element.children);
    for (const [index, item] of children.entries()) {
        const shouldHide = (expand && index > 2) || (!expand && index > 1);
        if (!shouldHide) {
            continue;
        }
        const shouldInsertMore = (expand && index === 3) || (!expand && index === 2);
        if (shouldInsertMore) {
            item.insertAdjacentHTML("beforebegin", '<div style="max-width: 100%;justify-content: center;" contenteditable="false" class="protyle-breadcrumb__item"><svg style="transform: rotate(90deg);"><use xlink:href="#iconMore"></use></svg></div>');
        }
        item.classList.add("fn__none");
    }
};

/** 按反链展开状态投影列表或标题内容的传递折叠 DOM。 @同步豁免: 需要绝对同步的DOM访问 - 调用方读取生成 HTML 前必须完成折叠投影。 */
export const foldPassiveType = (expand: boolean, element: HTMLElement | DocumentFragment) => {
    const firstElement = element.firstElementChild;
    if (!firstElement) {
        throw new Error("Passive backlink folding requires rendered content");
    }
    // 列表反链使用 fold 属性保留层级语义，不插入标题 More 标记。
    if (firstElement.classList.contains("li")) {
        foldPassiveList(expand, element);
        return;
    }
    // 标题反链通过隐藏尾部兄弟节点并插入 More 标记表达传递折叠。
    if (firstElement.getAttribute("data-type") === "NodeHeading") {
        foldPassiveHeading(expand, element);
    }
};
