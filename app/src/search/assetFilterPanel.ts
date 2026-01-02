/**
 * 素材高级过滤面板
 * 
 * @description 生成 S-Forge 素材过滤对话框的 HTML 内容
 * @usage 在 assetFilterMenu 中调用，提供格式、尺寸、文件大小、星级过滤功能
 */

import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

/** S-Forge 过滤选项类型 */
type SForgeFilters = NonNullable<ISearchAssetOption['sForgeFilters']>;

/**
 * 常用图片格式
 * @description 快捷选择常见图片格式
 */
const 常用图片格式 = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"];

/**
 * 常用文档格式
 * @description 快捷选择常见文档格式
 */
const 常用文档格式 = [".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md"];

/**
 * 文件大小预设选项
 * @description 提供常用文件大小范围快捷选择
 */
const 文件大小预设 = [
    { label: "< 100KB", maxSize: 100 * 1024 },
    { label: "100KB - 1MB", minSize: 100 * 1024, maxSize: 1024 * 1024 },
    { label: "1MB - 10MB", minSize: 1024 * 1024, maxSize: 10 * 1024 * 1024 },
    { label: "> 10MB", minSize: 10 * 1024 * 1024 },
];

/**
 * 尺寸预设选项
 * @description 提供常用图片尺寸范围快捷选择
 */
const 尺寸预设 = [
    { label: "小图 (<500px)", maxWidth: 500, maxHeight: 500 },
    { label: "中图 (500-1920px)", minWidth: 500, maxWidth: 1920 },
    { label: "大图 (>1920px)", minWidth: 1920 },
    { label: "高清 (>=4K)", minWidth: 3840 },
];

/**
 * 生成格式过滤区域 HTML
 * @param currentExts - 当前已选择的扩展名列表
 */
function 生成格式过滤区域(currentExts?: string[]): string {
    const selectedSet = new Set(currentExts || []);

    const 生成格式选项 = (ext: string) => {
        const checked = selectedSet.has(ext) ? " checked" : "";
        return `<label class="b3-label b3-label--noborder" style="display: inline-flex; margin-right: 8px; margin-bottom: 4px;">
            <input class="b3-switch" type="checkbox" data-ext="${ext}"${checked}>
            <span class="fn__space"></span>
            <span>${ext}</span>
        </label>`;
    };

    return `
    <div class="b3-label">
        <div class="fn__flex">
            <span class="ft__on-surface fn__flex-center" style="min-width: 80px;">图片格式</span>
            <div class="fn__flex-1" style="display: flex; flex-wrap: wrap;">
                ${常用图片格式.map(生成格式选项).join("")}
            </div>
        </div>
    </div>
    <div class="b3-label">
        <div class="fn__flex">
            <span class="ft__on-surface fn__flex-center" style="min-width: 80px;">文档格式</span>
            <div class="fn__flex-1" style="display: flex; flex-wrap: wrap;">
                ${常用文档格式.map(生成格式选项).join("")}
            </div>
        </div>
    </div>`;
}

/**
 * 生成尺寸过滤区域 HTML
 * @param filters - 当前过滤配置
 */
function 生成尺寸过滤区域(filters?: SForgeFilters): string {
    const minW = filters?.minWidth ?? "";
    const maxW = filters?.maxWidth ?? "";
    const minH = filters?.minHeight ?? "";
    const maxH = filters?.maxHeight ?? "";

    return `
    <div class="b3-label">
        <div class="fn__flex">
            <span class="ft__on-surface fn__flex-center" style="min-width: 80px;">图片尺寸</span>
            <div class="fn__flex-1">
                <div class="fn__flex" style="margin-bottom: 8px;">
                    ${尺寸预设.map((preset, i) => `
                        <button class="b3-button b3-button--outline" data-preset-size="${i}" style="margin-right: 8px;">
                            ${preset.label}
                        </button>
                    `).join("")}
                </div>
                <div class="fn__flex">
                    <input id="sforgeMinWidth" class="b3-text-field" type="number" placeholder="最小宽度" value="${minW}" style="width: 100px;">
                    <span class="fn__space"></span>
                    <span class="fn__flex-center">~</span>
                    <span class="fn__space"></span>
                    <input id="sforgeMaxWidth" class="b3-text-field" type="number" placeholder="最大宽度" value="${maxW}" style="width: 100px;">
                    <span class="fn__space"></span>
                    <span class="fn__flex-center">px</span>
                    <span class="fn__space fn__space--big"></span>
                    <input id="sforgeMinHeight" class="b3-text-field" type="number" placeholder="最小高度" value="${minH}" style="width: 100px;">
                    <span class="fn__space"></span>
                    <span class="fn__flex-center">~</span>
                    <span class="fn__space"></span>
                    <input id="sforgeMaxHeight" class="b3-text-field" type="number" placeholder="最大高度" value="${maxH}" style="width: 100px;">
                    <span class="fn__space"></span>
                    <span class="fn__flex-center">px</span>
                </div>
            </div>
        </div>
    </div>`;
}

/**
 * 生成文件大小过滤区域 HTML
 * @param filters - 当前过滤配置
 */
function 生成文件大小过滤区域(filters?: SForgeFilters): string {
    // 将字节转为 KB 显示
    const minSizeKB = filters?.minFileSize ? Math.round(filters.minFileSize / 1024) : "";
    const maxSizeKB = filters?.maxFileSize ? Math.round(filters.maxFileSize / 1024) : "";

    return `
    <div class="b3-label">
        <div class="fn__flex">
            <span class="ft__on-surface fn__flex-center" style="min-width: 80px;">文件大小</span>
            <div class="fn__flex-1">
                <div class="fn__flex" style="margin-bottom: 8px;">
                    ${文件大小预设.map((preset, i) => `
                        <button class="b3-button b3-button--outline" data-preset-filesize="${i}" style="margin-right: 8px;">
                            ${preset.label}
                        </button>
                    `).join("")}
                </div>
                <div class="fn__flex">
                    <input id="sforgeMinFileSize" class="b3-text-field" type="number" placeholder="最小" value="${minSizeKB}" style="width: 120px;">
                    <span class="fn__space"></span>
                    <span class="fn__flex-center">~</span>
                    <span class="fn__space"></span>
                    <input id="sforgeMaxFileSize" class="b3-text-field" type="number" placeholder="最大" value="${maxSizeKB}" style="width: 120px;">
                    <span class="fn__space"></span>
                    <span class="fn__flex-center">KB</span>
                </div>
            </div>
        </div>
    </div>`;
}

/**
 * 生成星级过滤区域 HTML
 * @param filters - 当前过滤配置
 */
function 生成星级过滤区域(filters?: SForgeFilters): string {
    const minStar = filters?.minStar ?? 0;
    const maxStar = filters?.maxStar ?? 5;

    const 星级选项 = (selected: number, isMin: boolean) => {
        const id = isMin ? "sforgeMinStar" : "sforgeMaxStar";
        return `
            <select id="${id}" class="b3-select" style="width: 80px;">
                ${[0, 1, 2, 3, 4, 5].map(star => `
                    <option value="${star}"${star === selected ? " selected" : ""}>
                        ${"★".repeat(star)}${star === 0 ? "无星级" : ""}
                    </option>
                `).join("")}
            </select>
        `;
    };

    return `
    <div class="b3-label">
        <div class="fn__flex">
            <span class="ft__on-surface fn__flex-center" style="min-width: 80px;">星级评分</span>
            <div class="fn__flex-1 fn__flex">
                ${星级选项(minStar, true)}
                <span class="fn__space"></span>
                <span class="fn__flex-center">~</span>
                <span class="fn__space"></span>
                ${星级选项(maxStar, false)}
            </div>
        </div>
    </div>`;
}

/**
 * 生成完整的素材过滤面板 HTML
 * 
 * @description 组合所有过滤区域生成完整的面板内容
 * @param filters - 当前过滤配置
 * @returns 过滤面板 HTML 字符串
 */
export function 生成素材过滤面板HTML(filters?: SForgeFilters): string {
    return `
        <div class="sforge-asset-filter-panel">
            <div class="b3-label b3-label--noborder" style="padding-bottom: 0;">
                <div class="fn__flex">
                    <span class="ft__primary fn__flex-center"><svg class="svg" style="height: 16px; width: 16px;"><use xlink:href="#iconFilter"></use></svg></span>
                    <span class="fn__space"></span>
                    <span class="fn__flex-center b3-label__text">S-Forge 素材高级过滤</span>
                </div>
            </div>
            ${生成格式过滤区域(filters?.exts)}
            ${生成尺寸过滤区域(filters)}
            ${生成文件大小过滤区域(filters)}
            ${生成星级过滤区域(filters)}
        </div>
    `;
}

/**
 * 从过滤面板对话框中解析用户选择的过滤值
 * 
 * @description 读取对话框中的输入控件值并转换为 SForgeFilters 对象
 * @param dialogElement - 对话框根元素
 * @returns 解析后的过滤配置，如果没有任何过滤条件则返回 undefined
 */
export function 解析过滤面板值(dialogElement: Element): SForgeFilters | undefined {
    const result: SForgeFilters = {};
    let hasAnyFilter = false;

    // 1. 解析格式过滤
    const extCheckboxes = dialogElement.querySelectorAll<HTMLInputElement>('input[data-ext]');
    const selectedExts: string[] = [];
    extCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const ext = checkbox.getAttribute('data-ext');
            if (ext) {
                selectedExts.push(ext);
            }
        }
    });
    if (selectedExts.length > 0) {
        result.exts = selectedExts;
        hasAnyFilter = true;
    }

    // 2. 解析尺寸过滤
    const minWidth = parseInt((dialogElement.querySelector('#sforgeMinWidth') as HTMLInputElement)?.value || "");
    const maxWidth = parseInt((dialogElement.querySelector('#sforgeMaxWidth') as HTMLInputElement)?.value || "");
    const minHeight = parseInt((dialogElement.querySelector('#sforgeMinHeight') as HTMLInputElement)?.value || "");
    const maxHeight = parseInt((dialogElement.querySelector('#sforgeMaxHeight') as HTMLInputElement)?.value || "");

    if (!isNaN(minWidth) && minWidth > 0) { result.minWidth = minWidth; hasAnyFilter = true; }
    if (!isNaN(maxWidth) && maxWidth > 0) { result.maxWidth = maxWidth; hasAnyFilter = true; }
    if (!isNaN(minHeight) && minHeight > 0) { result.minHeight = minHeight; hasAnyFilter = true; }
    if (!isNaN(maxHeight) && maxHeight > 0) { result.maxHeight = maxHeight; hasAnyFilter = true; }

    // 3. 解析文件大小过滤 (KB -> 字节)
    const minSizeKB = parseInt((dialogElement.querySelector('#sforgeMinFileSize') as HTMLInputElement)?.value || "");
    const maxSizeKB = parseInt((dialogElement.querySelector('#sforgeMaxFileSize') as HTMLInputElement)?.value || "");

    if (!isNaN(minSizeKB) && minSizeKB > 0) { result.minFileSize = minSizeKB * 1024; hasAnyFilter = true; }
    if (!isNaN(maxSizeKB) && maxSizeKB > 0) { result.maxFileSize = maxSizeKB * 1024; hasAnyFilter = true; }

    // 4. 解析星级过滤
    const minStar = parseInt((dialogElement.querySelector('#sforgeMinStar') as HTMLSelectElement)?.value || "0");
    const maxStar = parseInt((dialogElement.querySelector('#sforgeMaxStar') as HTMLSelectElement)?.value || "5");

    // 只有非默认值才记录
    if (minStar > 0) { result.minStar = minStar; hasAnyFilter = true; }
    if (maxStar < 5) { result.maxStar = maxStar; hasAnyFilter = true; }

    return hasAnyFilter ? result : undefined;
}

/**
 * 初始化过滤面板的交互事件
 * 
 * @description 绑定预设按钮点击事件
 * @param dialogElement - 对话框根元素
 */
export function 初始化过滤面板事件(dialogElement: Element): void {
    // 尺寸预设按钮
    dialogElement.querySelectorAll<HTMLButtonElement>('[data-preset-size]').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetIndex = parseInt(btn.getAttribute('data-preset-size') || "0");
            const preset = 尺寸预设[presetIndex];
            if (!preset) return;

            const minWidthInput = dialogElement.querySelector('#sforgeMinWidth') as HTMLInputElement;
            const maxWidthInput = dialogElement.querySelector('#sforgeMaxWidth') as HTMLInputElement;
            const minHeightInput = dialogElement.querySelector('#sforgeMinHeight') as HTMLInputElement;
            const maxHeightInput = dialogElement.querySelector('#sforgeMaxHeight') as HTMLInputElement;

            if (minWidthInput) minWidthInput.value = preset.minWidth?.toString() || "";
            if (maxWidthInput) maxWidthInput.value = preset.maxWidth?.toString() || "";
            if (minHeightInput) minHeightInput.value = "";
            if (maxHeightInput) maxHeightInput.value = "";
        });
    });

    // 文件大小预设按钮
    dialogElement.querySelectorAll<HTMLButtonElement>('[data-preset-filesize]').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetIndex = parseInt(btn.getAttribute('data-preset-filesize') || "0");
            const preset = 文件大小预设[presetIndex];
            if (!preset) return;

            const minSizeInput = dialogElement.querySelector('#sforgeMinFileSize') as HTMLInputElement;
            const maxSizeInput = dialogElement.querySelector('#sforgeMaxFileSize') as HTMLInputElement;

            if (minSizeInput) minSizeInput.value = preset.minSize ? Math.round(preset.minSize / 1024).toString() : "";
            if (maxSizeInput) maxSizeInput.value = preset.maxSize ? Math.round(preset.maxSize / 1024).toString() : "";
        });
    });
}

/** 英文别名导出 */
export const generateAssetFilterPanelHTML = 生成素材过滤面板HTML;
export const parseFilterPanelValues = 解析过滤面板值;
export const initFilterPanelEvents = 初始化过滤面板事件;
