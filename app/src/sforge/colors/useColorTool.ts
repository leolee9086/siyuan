/** 用途：颜色工具响应式状态和业务动作；使用范围：应用、图片分析、导出三个子面板；解耦评估：将状态从 Vue 模板拆出，子面板只消费控制器契约。 */
import {computed, nextTick, onMounted, onUnmounted, reactive, ref, watch} from "vue";
/** 用途：中国传统色数据；使用范围：内置色库搜索；解耦评估：静态数据与交互状态分离。 */
import {dict} from "./chineseColors";
/** 用途：传统色排序兼容函数；使用范围：传统色计算属性；解耦评估：纯数据变换不依赖面板或宿主。 */
import {groupTraditionalColors} from "./traditionalColors";
/** 用途：编辑器颜色应用和清除动作；使用范围：应用面板和清除按钮；解耦评估：复用纯编辑器适配模块。 */
import {applyColorToSelection, clearBlockColors, clearInlineTextColor} from "./apply";
/** 用途：ACO 读写；使用范围：色板导入导出；解耦评估：文件格式处理独立于面板状态。 */
import {readAco, writeAco} from "./aco";
/** 用途：颜色转换、取色算法和主题解析；使用范围：全部颜色工具流程；解耦评估：算法保持无 UI 状态。 */
import {bestTextColor, extractImageColors, extractionMethodLabel, getThemeColorTokens, parseCssColor, rgbToCss, rgbToHex} from "./colorEngine";
/** 用途：色卡渲染和工作区导出；使用范围：图片结果和导出面板；解耦评估：输出格式与业务状态分离。 */
import {exportDataUrlToWorkspace, renderColorCard} from "./exporter";
/** 用途：请求和用户提示；使用范围：笔记颜色扫描及错误反馈；解耦评估：通过颜色网关隔离宿主 API。 */
import {fetchPost, showMessage} from "./imports";
/** 用途：颜色工具本地状态；使用范围：最近使用、自定义颜色和色板恢复；解耦评估：持久化策略集中在 store。 */
import {loadColorToolState, saveColorToolState} from "./store";
/** 用途：颜色工具数据类型；使用范围：响应式状态和控制器动作；解耦评估：纯类型依赖。 */
import type {CardLayout, ColorMode, ColorTabId, ExtractionResult, NoteColor, PaletteColor, StoredPalette} from "./types";

/** 把状态中的样式字符串追加到最近使用列表并去重。 */
const rememberStyle = (state: ReturnType<typeof loadColorToolState>, style: string) => {
    state.recentColors.unshift(style);
    state.recentColors = [...new Set(state.recentColors)].slice(0, 32);
};

/** 从块属性字符串中解析一个可复用的笔记颜色。 */
const parseNoteColor = (item: {block_id?: string; value?: string}) => {
    const value = item.value || "";
    const foreground = value.match(/(?:^|;)color:\s*([^;]+)/)?.[1];
    const background = value.match(/background-color:\s*([^;]+)/)?.[1];
    if (!foreground && !background) {
        return null;
    }
    const foregroundColor = foreground || "var(--b3-theme-on-background)";
    const backgroundColor = background || "transparent";
    const rgb = parseCssColor(foregroundColor) || parseCssColor(backgroundColor);
    return rgb ? {
        rgb,
        name: item.block_id || "",
        foreground: foregroundColor,
        background: backgroundColor,
    } satisfies NoteColor : null;
};

/** 将内核查询结果转换为只包含有效颜色的列表，保持响应式状态类型稳定。 */
const parseNoteColors = (items: Array<{block_id?: string; value?: string}>) => {
    const colors: NoteColor[] = [];
    for (const item of items) {
        const color = parseNoteColor(item);
        if (color) {
            colors.push(color);
        }
    }
    return colors;
};

/** 在浏览器中生成稳定的色板 ID。 */
const newPaletteId = () => typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `palette-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** 创建颜色工具控制器，统一提供三类子面板需要的状态和动作。 */
export const useColorTool = (initialImageSrc = "") => {
    const tabs: Array<{id: ColorTabId; label: string}> = [
        {id: "apply", label: "颜色应用"},
        {id: "image", label: "图片取色"},
        {id: "export", label: "色卡导出"},
    ];
    const activeTab = ref<ColorTabId>(initialImageSrc ? "image" : "apply");
    const mode = ref<ColorMode>("style1");
    const foregroundHex = ref("#111111");
    const backgroundHex = ref("#FFFFFF");
    const alpha = ref(1);
    const dynamicThemeColors = ref<PaletteColor[]>(getThemeColorTokens());
    const state = reactive(loadColorToolState());
    const selectedPaletteIndex = ref(-1);
    const noteColors = ref<NoteColor[]>([]);
    const imageSrc = ref(initialImageSrc);
    const imageElement = ref<HTMLImageElement | null>(null);
    const imageObjectUrl = ref("");
    const imageCount = ref(state.maxImageColors);
    const imageResults = ref<ExtractionResult[]>([]);
    const imageError = ref("");
    const selectedExportColors = ref<PaletteColor[]>([]);
    const cardLayout = ref<CardLayout>("default");
    const cardTitle = ref("S-Forge Colors");
    const previewUrl = ref("");

    const traditionalColors = computed<PaletteColor[]>(() => groupTraditionalColors(
        dict.map(item => ({rgb: item.RGB, name: item.name}))
    ));
    const selectedPaletteColors = computed(() => selectedPaletteIndex.value >= 0 ? state.palettes[selectedPaletteIndex.value]?.colors || [] : []);
    const themeColors = computed(() => Array.from({length: 13}, (_, index) => ({
        name: `主题组合 ${index + 1}`,
        foreground: `var(--b3-font-color${index + 1})`,
        background: `var(--b3-font-background${index + 1})`,
    })));

    /** 返回当前前景/背景输入框对应的 CSS 样式串。 */
    const currentPairStyle = () => `color:${foregroundHex.value};background-color:${backgroundHex.value}`;

    /** 把颜色应用到编辑器并同步最近使用记录。 */
    const 应用颜色 = (color: string, targetMode: ColorMode) => {
        if (!applyColorToSelection(targetMode, color)) {
            showMessage("没有找到可应用颜色的编辑器选区", 2500, "info");
            return;
        }
        const style = targetMode === "style1" ? `color:${color};background-color:${color}` : `${targetMode}:${color}`;
        rememberStyle(state, style);
    };

    /** 同时应用当前前景和背景，保持两次编辑器操作使用同一透明度。 */
    const applyCurrentPair = () => {
        const backgroundApplied = applyColorToSelection("backgroundColor", rgbToCss(parseCssColor(backgroundHex.value) || [255, 255, 255], alpha.value));
        const foregroundApplied = applyColorToSelection("color", rgbToCss(parseCssColor(foregroundHex.value) || [17, 17, 17], alpha.value));
        return backgroundApplied || foregroundApplied;
    };

    /** 应用颜色应用页当前输入框中的颜色。 */
    const 应用当前颜色 = () => {
        const applied = mode.value === "style1"
            ? applyCurrentPair()
            : applyColorToSelection(mode.value, mode.value === "color" ? foregroundHex.value : backgroundHex.value);
        if (!applied) {
            showMessage("没有找到可应用颜色的编辑器选区", 2500, "info");
            return;
        }
        rememberStyle(state, currentPairStyle());
    };

    /** 载入一个主题前景/背景组合并立即应用。 */
    const 应用主题组合 = (item: {foreground: string; background: string}) => {
        foregroundHex.value = rgbToHex(parseCssColor(item.foreground) || [17, 17, 17]);
        backgroundHex.value = rgbToHex(parseCssColor(item.background) || [255, 255, 255]);
        应用当前颜色();
    };

    /** 从最近使用或自定义颜色样式中恢复输入框值并应用。 */
    const 应用已保存样式 = (style: string) => {
        const color = style.match(/(?:^|;)color:\s*([^;]+)/)?.[1];
        const background = style.match(/background-color:\s*([^;]+)/)?.[1];
        if (color) {
            foregroundHex.value = rgbToHex(parseCssColor(color) || [17, 17, 17]);
        }
        if (background) {
            backgroundHex.value = rgbToHex(parseCssColor(background) || [255, 255, 255]);
        }
        应用当前颜色();
    };

    /** 交换前景和背景输入框的颜色值。 */
    const 交换颜色 = () => {
        const value = foregroundHex.value;
        foregroundHex.value = backgroundHex.value;
        backgroundHex.value = value;
    };

    /** 保存当前前景/背景组合为自定义颜色。 */
    const 添加当前颜色 = () => {
        state.customColors.unshift(currentPairStyle());
        state.customColors = [...new Set(state.customColors)].slice(0, 128);
    };

    /** 删除最近使用颜色。 */
    const 删除最近颜色 = (index: number) => state.recentColors.splice(index, 1);

    /** 删除自定义颜色。 */
    const 删除自定义颜色 = (index: number) => state.customColors.splice(index, 1);

    /** 新建并选中一个空色板。 */
    const 新建色板 = () => {
        const palette: StoredPalette = {id: newPaletteId(), name: "未命名色板", colors: []};
        state.palettes.push(palette);
        selectedPaletteIndex.value = state.palettes.length - 1;
    };

    /** 交互式重命名当前色板。 */
    const 重命名色板 = () => {
        const palette = state.palettes[selectedPaletteIndex.value];
        if (!palette) {
            return;
        }
        const name = window.prompt("色板名称", palette.name)?.trim();
        if (name) {
            palette.name = name;
        }
    };

    /** 删除当前色板并把选择位置夹回有效范围。 */
    const 删除色板 = () => {
        if (selectedPaletteIndex.value < 0) {
            return;
        }
        state.palettes.splice(selectedPaletteIndex.value, 1);
        selectedPaletteIndex.value = Math.min(selectedPaletteIndex.value, state.palettes.length - 1);
    };

    /** 将图片分析结果去重后加入当前色板，没有色板时自动新建。 */
    const 添加结果到色板 = (colors: PaletteColor[]) => {
        if (selectedPaletteIndex.value < 0) {
            新建色板();
        }
        const palette = state.palettes[selectedPaletteIndex.value];
        if (!palette) {
            return;
        }
        const keys = new Set(palette.colors.map(item => rgbToHex(item.rgb)));
        for (const item of colors) {
            if (keys.has(rgbToHex(item.rgb))) {
                continue;
            }
            keys.add(rgbToHex(item.rgb));
            palette.colors.push({...item});
        }
    };

    /** 从当前色板删除一个颜色。 */
    const 删除色板颜色 = (index: number) => state.palettes[selectedPaletteIndex.value]?.colors.splice(index, 1);

    /** 将当前色板编码为 ACO 并触发浏览器下载。 */
    const 导出Aco = () => {
        const palette = state.palettes[selectedPaletteIndex.value];
        if (!palette) {
            return;
        }
        const blob = new Blob([writeAco(palette.colors)], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${palette.name || "MySwatches"}.aco`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    /** 从文件输入读取 ACO，并创建一个同名用户色板。 */
    const 导入Aco = async (event: Event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
            return;
        }
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        try {
            const colors = readAco(await file.arrayBuffer());
            state.palettes.push({id: newPaletteId(), name: file.name.replace(/\.aco$/i, ""), colors});
            selectedPaletteIndex.value = state.palettes.length - 1;
        } catch (error) {
            showMessage(`读取 ACO 失败：${String(error)}`, 4000, "error");
        }
        input.value = "";
    };

    /** 重新扫描主题样式表中的 CSS 变量。 */
    const 刷新主题颜色 = () => {
        dynamicThemeColors.value = getThemeColorTokens();
    };

    /** 扫描内核块属性中的颜色，生成可复用的笔记颜色列表。 */
    const 加载笔记颜色 = () => {
        fetchPost("/api/query/sql", {stmt: 'select block_id, value from attributes where name = "style"'}, response => {
            noteColors.value = parseNoteColors(response.data || []);
        });
    };

    /** 替换当前图片地址并维护由文件/剪贴板创建的对象 URL。 */
    const setImageFile = (file: File) => {
        if (imageObjectUrl.value) {
            URL.revokeObjectURL(imageObjectUrl.value);
        }
        imageObjectUrl.value = URL.createObjectURL(file);
        imageSrc.value = imageObjectUrl.value;
        activeTab.value = "image";
    };

    /** 处理图片文件选择。 */
    const 选择图片 = async (event: Event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) {
            return;
        }
        const file = input.files?.[0];
        if (!file) {
            return;
        }
        setImageFile(file);
        await nextTick();
        await imageElement.value?.decode().catch(() => undefined);
        input.value = "";
    };

    /** 从剪贴板中提取第一张图片。 */
    const 处理粘贴图片 = (event: ClipboardEvent) => {
        const file = Array.from(event.clipboardData?.items || [])
            .find(item => item.type.startsWith("image/"))?.getAsFile();
        if (file) {
            setImageFile(file);
        }
    };

    /** 处理拖拽到图片分析区的图片文件。 */
    const 拖拽图片 = (event: DragEvent) => {
        const file = event.dataTransfer?.files?.[0];
        if (file?.type.startsWith("image/")) {
            setImageFile(file);
        }
    };

    /** 在图片元素加载完成后执行五种本地算法分析。 */
    const 重新分析 = () => {
        if (!imageElement.value || !imageElement.value.complete) {
            return;
        }
        try {
            imageError.value = "";
            imageResults.value = extractImageColors(imageElement.value, imageCount.value);
        } catch (error) {
            imageResults.value = [];
            imageError.value = `图片无法读取：${String(error)}`;
        }
    };

    /** 把分析结果颜色应用为背景，Ctrl/Cmd 点击时同时应用对比前景。 */
    const 应用图片颜色 = (item: PaletteColor, event: MouseEvent) => {
        if (event.ctrlKey || event.metaKey) {
            应用颜色(rgbToCss(item.rgb), "backgroundColor");
            应用颜色(rgbToCss(bestTextColor(item.rgb)), "color");
            return;
        }
        应用颜色(rgbToCss(item.rgb), event.button === 2 ? "color" : "backgroundColor");
    };

    /** 预览一组图片颜色，并切换到色卡导出页。 */
    const 预览色卡 = (colors: PaletteColor[]) => {
        selectedExportColors.value = colors;
        cardLayout.value = "default";
        previewUrl.value = renderColorCard(colors, cardLayout.value, cardTitle.value);
        activeTab.value = "export";
    };

    /** 依据当前布局重绘色卡预览。 */
    const 更新预览 = () => {
        previewUrl.value = renderColorCard(selectedExportColors.value, cardLayout.value, cardTitle.value);
    };

    /** 导出一组颜色的 PNG 色卡到工作区。 */
    const 导出结果 = (colors: PaletteColor[]) => {
        if (colors.length === 0) {
            return;
        }
        const dataUrl = renderColorCard(colors, cardLayout.value, cardTitle.value);
        previewUrl.value = dataUrl;
        exportDataUrlToWorkspace(dataUrl);
    };

    /** 清除块范围内的颜色，并把结果反馈给用户。 */
    const 清除颜色 = (targetMode: "color" | "backgroundColor", scope: "selected" | "visible" | "loaded") => {
        const count = clearBlockColors(targetMode, scope);
        showMessage(`已清除 ${count} 个块的${targetMode === "color" ? "文字" : "背景"}颜色`, 2500, "info");
    };

    /** 清除文字选区的行内颜色。 */
    const 清除文字颜色 = (targetMode: "color" | "backgroundColor") => {
        const applied = clearInlineTextColor(targetMode);
        showMessage(applied ? "已清除文字选区颜色" : "没有找到文字选区", 2500, "info");
    };

    watch(state, () => saveColorToolState(state), {deep: true});
    watch(imageCount, value => {
        state.maxImageColors = Math.min(13, Math.max(1, Number(value) || 5));
        imageCount.value = state.maxImageColors;
    });
    onMounted(() => {
        if (initialImageSrc) {
            imageSrc.value = initialImageSrc;
        }
    });
    onUnmounted(() => {
        if (imageObjectUrl.value) {
            URL.revokeObjectURL(imageObjectUrl.value);
        }
    });

    return {
        tabs,
        activeTab,
        mode,
        foregroundHex,
        backgroundHex,
        alpha,
        dynamicThemeColors,
        state,
        selectedPaletteIndex,
        noteColors,
        imageSrc,
        imageElement,
        imageCount,
        imageResults,
        imageError,
        selectedExportColors,
        cardLayout,
        cardTitle,
        previewUrl,
        traditionalColors,
        selectedPaletteColors,
        themeColors,
        rgbToCss,
        rgbToHex,
        bestTextColor,
        extractionMethodLabel,
        应用颜色,
        应用当前颜色,
        应用主题组合,
        应用已保存样式,
        交换颜色,
        添加当前颜色,
        删除最近颜色,
        删除自定义颜色,
        新建色板,
        重命名色板,
        删除色板,
        添加结果到色板,
        删除色板颜色,
        导出Aco,
        导入Aco,
        刷新主题颜色,
        加载笔记颜色,
        选择图片,
        处理粘贴图片,
        拖拽图片,
        重新分析,
        应用图片颜色,
        预览色卡,
        更新预览,
        导出结果,
        清除颜色,
        清除文字颜色,
    };
};
