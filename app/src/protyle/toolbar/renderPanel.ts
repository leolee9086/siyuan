import { hasClosestBlock } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import {
    确定渲染标题,
    获取文本框初始值,
    检查固定状态,
    生成渲染面板HTML,
    处理头部按钮点击,
    处理文本输入,
    处理键盘事件,
    发射插件打开事件,
    导出为图片,
    创建关闭回调,
    创建自动高度函数,
    type 渲染面板上下文
} from "./showRender";

export function showRender(
    protyle: IProtyle,
    renderElement: Element,
    updateElements: Element[] | undefined,
    oldHTML: string | undefined,
    subElement: HTMLElement,
    element: HTMLElement,
    range: Range | undefined,
    setSubElementCloseCB: (cb: (() => void) | undefined) => void
) {
    const nodeElement = hasClosestBlock(renderElement);
    if (!nodeElement) {
        return;
    }
    nodeElement.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
    hideElements(["hint"], protyle);
    window.siyuan.menus.menu.remove();

    const id = nodeElement.getAttribute("data-node-id") ?? "";
    const types = (renderElement.getAttribute("data-type") ?? "").split(" ");
    const html = oldHTML ?? nodeElement.outerHTML;
    const subtype = renderElement.getAttribute("data-subtype");
    const 是否行内备注 = types.includes("inline-memo");

    // 确定标题和占位符
    const { 标题, 占位符 } = 确定渲染标题(subtype, types, 是否行内备注);

    // 检查固定状态
    const { 是否固定, 固定样式, 是否拖拽中, 刷新按钮激活 } = 检查固定状态(subElement);

    if (!是否固定) {
        subElement.style.width = "";
        subElement.style.padding = "0";
    }

    // 生成面板 HTML
    subElement.innerHTML = 生成渲染面板HTML({
        标题,
        占位符,
        是否固定,
        是否禁用: protyle.disabled,
        是否行内备注,
        类型列表: types,
        渲染元素宽度: renderElement.clientWidth,
        是否拖拽中,
        刷新按钮激活
    });

    // 获取元素引用
    const textElement = subElement.querySelector(".b3-text-field") as HTMLTextAreaElement;
    const headerElement = subElement.querySelector(".block__icons");
    if (!headerElement) {
        return;
    }

    // 设置初始值
    textElement.value = 获取文本框初始值(renderElement, types, 是否行内备注);
    const oldTextValue = textElement.value;

    // 显示面板并计算位置
    subElement.style.zIndex = (++window.siyuan.zIndex).toString();
    subElement.classList.remove("fn__none");
    const nodeRect = renderElement.getBoundingClientRect();
    element.classList.add("fn__none");

    // 创建上下文
    const 上下文: 渲染面板上下文 = {
        protyle,
        renderElement,
        nodeElement,
        updateElements,
        subElement: subElement,
        textElement,
        types,
        是否行内备注,
        id,
        html,
        range: range
    };

    // 创建自动高度函数
    const autoHeight = 创建自动高度函数(
        { textElement, nodeRect, types, 是否行内备注 },
        subElement
    );

    // 创建导出图片回调
    const exportImg = () => 导出为图片(renderElement);

    // 绑定事件
    headerElement.addEventListener("click", (event: MouseEvent) => {
        处理头部按钮点击(event, headerElement, 上下文, exportImg);
    });

    textElement.addEventListener("input", (event) => {
        处理文本输入(event, 上下文, autoHeight);
    });

    textElement.addEventListener("keydown", (event: KeyboardEvent) => {
        处理键盘事件(event, 上下文);
    });

    // 设置关闭回调
    setSubElementCloseCB(创建关闭回调(上下文, oldTextValue, range));

    // 应用固定样式或自动高度
    if (是否固定 && 固定样式) {
        textElement.style.width = 固定样式.宽度;
        textElement.style.height = 固定样式.高度;
    } else {
        autoHeight();
    }

    // 选中文本
    if (!protyle.disabled) {
        textElement.select();
    }

    // 发射插件事件
    发射插件打开事件(protyle, {
        subElement,
        element,
        range
    } as any, nodeElement, renderElement); // Hack: Casting to any because Toolbar interface is not fully implemented here
}
