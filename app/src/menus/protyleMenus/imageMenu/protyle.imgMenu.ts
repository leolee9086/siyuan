/** 用途：更新时间字符串；使用范围：菜单关闭提交事务时写入 updated；解耦评估：第三方依赖由 imports.ts 转发。 */
import { dayjs } from "./imports";
/** 用途：发送后端请求；使用范围：OCR 文本更新接口调用；解耦评估：请求入口统一。 */
import { fetchPost } from "./imports";
/** 用途：把 base64 图像转为资源 URL；使用范围：菜单关闭时处理内联图片源；解耦评估：资源转换能力由工具层封装。 */
import { base64ToURL } from "./imports";
/** 用途：流程常量；使用范围：菜单 data-name 标识；解耦评估：常量来源统一。 */
import { Constants } from "./imports";
/** 用途：平台判断；使用范围：复制资源文件动作仅 Electron 显示；解耦评估：平台判断由基础层统一维护。 */
import { isElectron } from "./imports";
/** 用途：平台判断；使用范围：菜单显示方式（fullscreen/popup）；解耦评估：平台判断由基础层统一维护。 */
import { isMobile } from "./imports";
/** 用途：触发插件扩展菜单；使用范围：图片菜单构建结束后扩展入口；解耦评估：事件协议统一。 */
import { emitOpenMenu } from "./imports";
/** 用途：隐藏干扰 UI；使用范围：菜单弹出前隐藏 util/toolbar/hint；解耦评估：UI 协作逻辑封装。 */
import { hideElements } from "./imports";
/** 用途：查找当前元素所属块；使用范围：读取 node-id 与 outerHTML；解耦评估：DOM 工具复用。 */
import { hasClosestBlock } from "./imports";
/** 用途：查找顶部 popover；使用范围：设置菜单来源 data-from；解耦评估：DOM 工具复用。 */
import { hasTopClosestByClassName } from "./imports";
/** 用途：提交事务；使用范围：菜单关闭时持久化图片属性变更；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：读取全局配置；使用范围：系统平台判断（windows/darwin）；解耦评估：配置读取统一。 */
import { getSiyuanConfig } from "./imports";
/** 用途：读取全局菜单实例；使用范围：append/remove/popup/fullscreen/removeCB；解耦评估：菜单单例由环境层管理。 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/** 用途：打开资源菜单；使用范围：src 存在时追加 openMenu 子项；解耦评估：资源动作入口独立封装。 */
import { openMenu } from "./imports";
/** 用途：菜单项构造器；使用范围：分隔符等基础菜单项创建；解耦评估：组件能力统一来源。 */
import { MenuItem } from "./imports";

/** 用途：构建复制/剪切/删除/重命名等动作；使用范围：imgMenu 菜单项追加；解耦评估：动作模块按关注点拆分。 */
import { genCopyItem } from "./protyle.imgMenu.actions";
/** 用途：构建只读场景复制 URL 动作；使用范围：imgMenu 只读分支；解耦评估：动作模块按关注点拆分。 */
import { genCopyImageURLItem } from "./protyle.imgMenu.actions";
/** 用途：构建复制为 PNG 动作；使用范围：imgMenu 基础菜单项；解耦评估：动作模块按关注点拆分。 */
import { genCopyAsPNGItem } from "./protyle.imgMenu.actions";
/** 用途：构建剪切动作；使用范围：imgMenu 编辑态分支；解耦评估：动作模块按关注点拆分。 */
import { genCutItem } from "./protyle.imgMenu.actions";
/** 用途：构建删除动作；使用范围：imgMenu 编辑态分支；解耦评估：动作模块按关注点拆分。 */
import { genDeleteItem } from "./protyle.imgMenu.actions";
/** 用途：构建重命名动作；使用范围：assets 图片编辑态分支；解耦评估：动作模块按关注点拆分。 */
import { genRenameItem } from "./protyle.imgMenu.actions";

/** 用途：构建对齐与资源导出类动作；使用范围：imgMenu 编辑态与资源分支；解耦评估：动作模块按关注点拆分。 */
import { genAlignCenterItem } from "./protyle.imgMenu.assetActions";
/** 用途：构建对齐与资源导出类动作；使用范围：imgMenu 编辑态与资源分支；解耦评估：动作模块按关注点拆分。 */
import { genAlignLeftItem } from "./protyle.imgMenu.assetActions";
/** 用途：构建资源导出动作；使用范围：assets 路径分支；解耦评估：动作模块按关注点拆分。 */
import { genExportItem } from "./protyle.imgMenu.assetActions";
/** 用途：构建复制资源文件动作；使用范围：Electron windows/darwin 分支；解耦评估：动作模块按关注点拆分。 */
import { genCopyAssetItem } from "./protyle.imgMenu.assetActions";

/** 用途：构建图片设置项；使用范围：编辑态菜单顶部；解耦评估：设置面板逻辑独立模块。 */
import { genImageSettingsItem } from "./protyle.imgMenu.items";
/** 用途：构建 OCR 子菜单；使用范围：编辑态菜单动作区；解耦评估：OCR 逻辑独立模块。 */
import { genOCRItem } from "./protyle.imgMenu.items";
/** 用途：构建宽度菜单；使用范围：编辑态菜单动作区；解耦评估：尺寸逻辑独立模块。 */
import { genWidthItem } from "./protyle.imgMenu.size";
/** 用途：构建高度菜单；使用范围：编辑态菜单动作区；解耦评估：尺寸逻辑独立模块。 */
import { genHeightItem } from "./protyle.imgMenu.size";

/**
 * 作用：追加图片菜单基础动作（copy/copyURL/copyAsPNG）。
 * 意图：集中处理只读与编辑通用动作，保持主流程简洁。
 * 调用时机：imgMenu 构建阶段中段。
 * 问题/改进：后续可将基础动作顺序抽象成配置。
 */
const 追加基础动作菜单项 = (
    protyle: IProtyle,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement
) => {
    const menu = getSiyuanGlobalMenusMenu();
    menu.append(genCopyItem(protyle, assetElement).element);
    // 只读模式额外展示“复制图片地址”。
    if (protyle.disabled) {
        menu.append(genCopyImageURLItem(imgElement).element);
    }
    menu.append(genCopyAsPNGItem(imgElement).element);
};

/**
 * 作用：追加编辑态动作菜单项。
 * 意图：将编辑能力聚合到单独函数，避免主流程分支过长。
 * 调用时机：imgMenu 编辑态分支中。
 * 问题/改进：后续可把“内容编辑动作”和“布局动作”进一步拆分。
 */
const 追加编辑态动作菜单项 = (
    protyle: IProtyle,
    range: Range,
    assetElement: HTMLElement,
    nodeElement: HTMLElement,
    imgElement: HTMLImageElement,
    id: string,
    html: string
) => {
    const menu = getSiyuanGlobalMenusMenu();
    menu.append(genCutItem(protyle, assetElement, nodeElement, id, html, range).element);
    menu.append(genDeleteItem(protyle, assetElement, nodeElement, id, html, range).element);
    menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);

    const imagePath = imgElement.getAttribute("data-src") || "";
    // 本地 assets 资源才提供重命名能力。
    if (imagePath.startsWith("assets/")) {
        menu.append(genRenameItem(imagePath).element);
    }
    menu.append(genOCRItem(imgElement).element);
    menu.append(genAlignCenterItem(protyle, nodeElement, assetElement, id, html).element);
    menu.append(genAlignLeftItem(protyle, nodeElement, assetElement, id, html).element);
    menu.append(genWidthItem(protyle, nodeElement, imgElement, assetElement).element);
    menu.append(genHeightItem(protyle, nodeElement, imgElement, assetElement).element);
};

/**
 * 作用：追加资源打开菜单项。
 * 意图：将 src 相关动作从主流程中独立，避免分支细节分散。
 * 调用时机：imgMenu 构建后段。
 * 问题/改进：后续可按协议类型（assets/http/data）细分策略。
 */
const 追加资源打开菜单项 = (protyle: IProtyle, src: string) => {
    const menu = getSiyuanGlobalMenusMenu();
    // src 存在时才展示 openMenu。
    if (!src) {
        return;
    }
    menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);
    openMenu(protyle.app, src, false, false);
};

/**
 * 作用：追加资源导出与复制文件菜单项。
 * 意图：集中处理 assets 路径与平台能力判断。
 * 调用时机：imgMenu 构建后段。
 * 问题/改进：后续可抽象为资源能力矩阵配置。
 */
const 追加资源导出菜单项 = (imgElement: HTMLImageElement) => {
    const menu = getSiyuanGlobalMenusMenu();
    const dataSrc = imgElement.getAttribute("data-src");
    const isAssetResource = Boolean(dataSrc && dataSrc.startsWith("assets/"));
    // 仅 assets 路径显示导出与复制资源文件能力。
    if (!isAssetResource || !dataSrc) {
        return;
    }
    menu.append(genExportItem(dataSrc).element);
    const isDesktopCopySupported = isElectron && ["windows", "darwin"].includes(getSiyuanConfig().system.os);
    // 仅 Electron 的 windows/darwin 平台展示复制资源文件动作。
    if (isDesktopCopySupported) {
        menu.append(genCopyAssetItem(dataSrc).element);
    }
};

/**
 * 作用：触发图片菜单插件扩展。
 * 意图：保留插件体系扩展能力，兼容历史行为。
 * 调用时机：菜单主体项构建完成后。
 * 问题/改进：后续可补充扩展耗时与异常监控。
 */
const 触发图片插件菜单扩展 = (protyle: IProtyle, assetElement: HTMLElement) => {
    const hasPlugins = Boolean(protyle?.app?.plugins);
    // 仅存在插件系统时触发扩展事件。
    if (!hasPlugins) {
        return;
    }
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-image",
        detail: {
            protyle,
            element: assetElement,
        },
        separatorPosition: "top",
    });
};

/**
 * 作用：按端类型展示菜单。
 * 意图：保持移动端与桌面端交互行为一致。
 * 调用时机：菜单项构建完成后。
 * 问题/改进：后续可将 popup 定位策略提取为独立策略函数。
 */
const 展示图片菜单 = (position: { clientX: number; clientY: number }) => {
    const menu = getSiyuanGlobalMenusMenu();
    // 移动端使用全屏菜单。
    if (isMobile) {
        menu.fullscreen();
        return;
    }
    menu.popup({ x: position.clientX, y: position.clientY });
};

/**
 * 作用：设置菜单来源属性。
 * 意图：标记菜单来自 app 还是 popover，便于后续行为分支复用。
 * 调用时机：菜单弹出前。
 * 问题/改进：dataset.level 依赖外层结构，后续可考虑标准化来源字段。
 */
const 设置菜单来源属性 = (protyle: IProtyle) => {
    const menu = getSiyuanGlobalMenusMenu();
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
};

/**
 * 作用：菜单关闭时同步保存图片编辑变更。
 * 意图：集中处理 base64 转换、OCR 提交、alt 更新与事务提交。
 * 调用时机：imgMenu 设置 removeCB 后，菜单关闭时触发。
 * 问题/改进：后续可在失败场景补充回滚与提示。
 */
const 绑定菜单关闭回调 = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    assetElement: HTMLElement,
    imgElement: HTMLImageElement,
    id: string,
    src: string,
    html: string
) => {
    const menu = getSiyuanGlobalMenusMenu();
    const textareas = menu.element.querySelectorAll("textarea");
    const urlInput = textareas[0];
    const titleInput = textareas[1];
    const focusTarget = urlInput?.value ? titleInput : urlInput;
    focusTarget?.select();

    menu.removeCB = async () => {
        const srcInput = textareas[0];
        const newSrc = srcInput?.value;
        const shouldConvertBase64 = Boolean(newSrc && src !== newSrc && newSrc.startsWith("data:image/"));
        // 用户把图片源改成 data:image 时，关闭菜单前转存为资源 URL。
        if (shouldConvertBase64 && newSrc) {
            const convertedSources = await base64ToURL([newSrc]);
            const convertedSrc = convertedSources[0] ?? "";
            imgElement.setAttribute("src", convertedSrc);
            imgElement.setAttribute("data-src", convertedSrc);
            const netIndicator = assetElement.querySelector(".img__net");
            netIndicator?.remove();
        }

        const ocrElement = menu.element.querySelector('[data-type="ocr"]');
        const shouldSyncOCR = ocrElement instanceof HTMLTextAreaElement && ocrElement.dataset.ocrText !== ocrElement.value;
        // OCR 文本发生变化时同步写回后端。
        if (shouldSyncOCR && ocrElement instanceof HTMLTextAreaElement) {
            fetchPost("/api/asset/setImageOCRText", {
                path: imgElement.getAttribute("src"),
                text: ocrElement.value
            });
        }

        const altInput = textareas[2];
        // alt 输入框存在时同步更新图片 alt 属性。
        if (altInput) {
            imgElement.setAttribute("alt", altInput.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, ""));
        }
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, nodeElement, html);
    };
};

/**
 * 作用：显示图片上下文菜单。
 * 意图：统一组织图片设置、编辑动作、资源动作、插件扩展与关闭回调。
 * 调用时机：用户在图片资源节点触发菜单时。
 * 问题/改进：主流程已拆分子函数，后续可继续把数据准备逻辑抽象为上下文对象。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const imgMenu = (
    protyle: IProtyle,
    range: Range,
    assetElement: HTMLElement,
    position: { clientX: number; clientY: number; }
) => {
    const menu = getSiyuanGlobalMenusMenu();
    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_INLINE_IMG);

    const nodeElement = hasClosestBlock(assetElement);
    if (!nodeElement) {
        return;
    }
    const imgElement = assetElement.querySelector("img");
    if (!(imgElement instanceof HTMLImageElement)) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);

    const id = nodeElement.getAttribute("data-node-id") || "";
    const html = nodeElement.outerHTML;
    const src = imgElement.getAttribute("src") || "";

    // 编辑态先追加图片设置项。
    if (!protyle.disabled) {
        menu.append(genImageSettingsItem(assetElement, nodeElement, imgElement).element);
        menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }
    追加基础动作菜单项(protyle, assetElement, imgElement);
    // 编辑态追加切图/删除/重命名/OCR/对齐/尺寸等能力。
    if (!protyle.disabled) {
        追加编辑态动作菜单项(protyle, range, assetElement, nodeElement, imgElement, id, html);
    }

    追加资源打开菜单项(protyle, src);
    追加资源导出菜单项(imgElement);
    触发图片插件菜单扩展(protyle, assetElement);
    展示图片菜单(position);

    menu.data = assetElement;
    设置菜单来源属性(protyle);
    // 编辑态在菜单关闭前执行保存和回填逻辑。
    if (!protyle.disabled) {
        绑定菜单关闭回调(protyle, nodeElement, assetElement, imgElement, id, src, html);
    }
};
