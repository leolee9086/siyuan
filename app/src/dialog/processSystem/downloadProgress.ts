
/**
 * 作用：解析 Bazaar 侧边区域 `data-obj` 属性中的当前条目信息。
 * 意图：DOM 属性来源于模板字符串，运行时既可能为空，也可能因上游结构变更而不是预期 JSON；单独封装解析与结构校验可避免调用点重复处理异常和空值分支。
 * 调用时机：在下载进度处理流程中，确认事件是否属于当前显示条目前调用。
 * 问题/改进：如果后续上游可以直接把 `repoURL` 以独立 `data-repo-url` 形式写入 DOM，则可以移除此 JSON 解析分支以降低运行时成本。
 */
function parseBazaarReadmeDataObject(attributeValue: string | null) {
    if (!attributeValue) {
        return null;
    }
    try {
        const parsedData: unknown = JSON.parse(attributeValue);
        if (typeof parsedData !== "object" || parsedData === null) {
            return null;
        }
        const repoURL = Reflect.get(parsedData, "repoURL");
        if (typeof repoURL !== "string") {
            return null;
        }
        return {repoURL};
    } catch {
        return null;
    }
}

/** 导出异步下载进度处理函数，供系统消息分发流程调用。 */
export const downloadProgress = async (data: { id: string; percent: number; }) => {
    const bazaarSideElement = document.querySelector("#configBazaarReadme .item__side");
    if (!(bazaarSideElement instanceof HTMLElement)) {
        return;
    }
    const bazaarReadmeDataObject = parseBazaarReadmeDataObject(bazaarSideElement.getAttribute("data-obj"));
    if (!bazaarReadmeDataObject || data.id !== bazaarReadmeDataObject.repoURL) {
        return;
    }
    const btnElement = bazaarSideElement.querySelector('[data-type="install"]');
    if (!(btnElement instanceof HTMLElement)) {
        return;
    }
    const buttonContainerElement = btnElement.parentElement;
    if (!(buttonContainerElement instanceof HTMLElement)) {
        return;
    }
    const secondaryButtonContainerElement = buttonContainerElement.nextElementSibling;
    if (!(secondaryButtonContainerElement instanceof HTMLElement)) {
        return;
    }
    const secondaryButtonElement = secondaryButtonContainerElement.firstElementChild;
    if (!(secondaryButtonElement instanceof HTMLElement)) {
        return;
    }

    /**
     * 意图：当进度达到 100% 时，当前安装动作已结束，界面需要立刻隐藏主按钮区与右侧联动按钮区，防止用户在完成态继续看到进行中的交互控件。
     * 生效场景：仅当后端上报的 `percent` 达到或超过 1，也就是下载流程完成的收尾阶段才会触发。
     */
    if (data.percent >= 1) {
        buttonContainerElement.classList.add("fn__none");
        secondaryButtonContainerElement.classList.add("fn__none");
        return;
    }

    btnElement.classList.add("b3-button--progress");
    secondaryButtonElement.classList.add("b3-button--progress");
    btnElement.innerHTML = `<span style="width: ${data.percent * 100}%"></span>`;
    secondaryButtonElement.innerHTML = `<span style="width: ${data.percent * 100}%"></span>`;
};
