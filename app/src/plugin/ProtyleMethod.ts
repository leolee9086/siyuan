/**
 * 评估依据（基于当前仓库实现）：
 * 1) ContentRendererRegistry + registerBuiltinRenderers 已对 data-subtype 渲染分发做了解耦
 * 2) ProtyleMethod 的职责是向插件暴露稳定静态方法名，不是渲染分发入口
 * 3) highlight/av 不在 contentRendererRegistry 统一分发链中
 * 4) 启动顺序上 loadPlugins 早于 initSForge，插件 onload 阶段不应假设内置渲染器已全部完成注册
 *
 * 备注：plugin/API.ts 当前实际暴露的是 ../protyle/method，本文件目前未接入该导出链
 */
/** @导入用途: graphviz 图形渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { graphvizRender } from "./imports";
/** @导入用途: 代码高亮渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 不在 ContentRendererRegistry 分发链中，属于独立后处理阶段；若改为注册表需新增高亮阶段的扩展点 */
import { highlightRender } from "./imports";
/** @导入用途: 数学公式渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { mathRender } from "./imports";
/** @导入用途: mermaid 图表渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { mermaidRender } from "./imports";
/** @导入用途: flowchart.js 渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { flowchartRender } from "./imports";
/** @导入用途: 图表渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { chartRender } from "./imports";
/** @导入用途: 五线谱渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { abcRender } from "./imports";
/** @导入用途: HTML 内容渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { htmlRender } from "./imports";
/** @导入用途: 脑图渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { mindmapRender } from "./imports";
/** @导入用途: UML 渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 渲染分发层已由 ContentRendererRegistry 解耦；此处保留静态绑定以维持插件 API 能力命名稳定 */
import { plantumlRender } from "./imports";
/** @导入用途: 属性视图渲染函数 @使用范围: 通过 ProtyleMethod 暴露给插件 @解耦评估: 依赖 protyle 上下文，当前签名与 ContentRendererRegistry 不兼容；如需解耦应新增 AV 专用注册表或扩展统一签名 */
import { avRender } from "./imports";

/** Protyle 渲染方法集合 */
export class ProtyleMethod {
    /** 对 graphviz 进行渲染 */
    public static graphvizRender = graphvizRender;
    /** 为 element 中的代码块进行高亮渲染 */
    public static highlightRender = highlightRender;
    /** 对数学公式进行渲染 */
    public static mathRender = mathRender;
    /** 流程图/时序图/甘特图渲染 */
    public static mermaidRender = mermaidRender;
    /** flowchart.js 渲染 */
    public static flowchartRender = flowchartRender;
    /** 图表渲染 */
    public static chartRender = chartRender;
    /** 五线谱渲染 */
    public static abcRender = abcRender;
    /** 脑图渲染 */
    public static mindmapRender = mindmapRender;
    /** UML 渲染 */
    public static plantumlRender = plantumlRender;
    /** 属性视图渲染 */
    public static avRender = avRender;
    /** HTML 内容渲染 */
    public static htmlRender = htmlRender;
}
