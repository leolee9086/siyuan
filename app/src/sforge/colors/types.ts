/**
 * 用途：表示一个 8 位 RGB 颜色。
 * 使用场景：颜色解析、取色算法、编辑器样式应用和导出共用的基础值对象。
 * 关联类型：被 PaletteColor 和 ExtractionResult 使用；当前不携带透明度。
 */
export type RGB = [number, number, number];

/**
 * 用途：描述颜色工具把颜色应用到编辑器的目标。
 * 使用场景：块样式和文字行内样式操作的模式选择。
 * 关联类型：由 applyColorToSelection 等应用函数消费。
 */
export type ColorMode = "color" | "backgroundColor" | "style1";

/**
 * 用途：标识图片取色算法。
 * 使用场景：分析结果展示、算法选择和测试断言。
 * 关联类型：ExtractionResult.method 使用该联合类型。
 */
export type ExtractionMethod =
    | "color-thief"
    | "kmeans-euclidean"
    | "kmeans-hsv"
    | "kmeans-cosine-lightness"
    | "mmcq";

/**
 * 用途：表示一个带可选名称和占比的调色板颜色。
 * 使用场景：内置色库、主题颜色、图片分析结果和用户色板。
 * 关联类型：StoredPalette.colors 和 ExtractionResult.colors 都由此类型组成。
 */
export interface PaletteColor {
    rgb: RGB;
    ratio?: number;
    name?: string;
}

/**
 * 用途：表示一次图片颜色分析及其算法来源。
 * 使用场景：图片取色面板按算法展示结果，并支持加入色板或导出。
 * 关联类型：colors 使用 PaletteColor[]，method 使用 ExtractionMethod。
 */
export interface ExtractionResult {
    method: ExtractionMethod;
    colors: PaletteColor[];
}

/**
 * 用途：表示持久化的用户色板。
 * 使用场景：自定义色板的新建、导入、导出、删除和重启恢复。
 * 关联类型：ColorToolState.palettes 保存多个 StoredPalette。
 */
export interface StoredPalette {
    id: string;
    name: string;
    colors: PaletteColor[];
}

/**
 * 用途：表示颜色工具在本地存储中的完整状态。
 * 使用场景：最近使用、自定义颜色、色板和图片分析数量的持久化。
 * 关联类型：由 store.ts 读写，并被 UI composable 转换成响应式状态。
 */
export interface ColorToolState {
    recentColors: string[];
    customColors: string[];
    palettes: StoredPalette[];
    maxImageColors: number;
}

/**
 * 用途：标识颜色工具的三个界面页签。
 * 使用场景：主面板和子面板之间的当前视图切换。
 * 关联类型：useColorTool.activeTab 使用该类型。
 */
export type ColorTabId = "apply" | "image" | "export";

/**
 * 用途：表示清除块颜色时的作用域。
 * 使用场景：清除选中块、可见块或当前已加载块的颜色样式。
 * 关联类型：clearBlockColors 使用该类型控制扫描范围。
 */
export type ClearScope = "selected" | "visible" | "loaded";

/**
 * 用途：表示同时携带前景和背景 CSS 值的笔记颜色。
 * 使用场景：从笔记块属性扫描出的可复用颜色入口。
 * 关联类型：useColorTool.noteColors 使用 PaletteColor 作为基础颜色值。
 */
export interface NoteColor extends PaletteColor {
    foreground: string;
    background: string;
}

/**
 * 用途：标识色卡 PNG 的渲染布局。
 * 使用场景：色卡预览和导出时选择排列方式。
 * 关联类型：exporter.ts 的 renderColorCard 使用该类型。
 */
export type CardLayout = "default" | "left" | "right" | "round" | "gradient";
