/** 用途：将反链键盘事实集合收集为可判定状态空间并完成互斥分派；使用范围：编辑器与面板树键盘入口；解耦评估：路由仅依赖状态和值函数，宿主 DOM 事实通过参数注入。 */
/** 用途：取得反链目录的原始 Zod/CaliburRouter 构建器。使用范围：本文件静态声明键盘状态空间。解耦评估：第三方包路径由同层 imports.ts 收口，不包装路由能力。 */
import {zodCalibur} from "./imports";
/** 用途：取得反链目录的原始 Zod 状态构建器。使用范围：本文件静态声明键盘状态空间。解耦评估：第三方包路径由同层 imports.ts 收口，不包装路由能力。 */
import {zodState} from "./imports";

/** @允许模块级变量: 具体业务场景是编辑器与反链面板在每个键盘事件中共享同一布尔事实 Schema；该对象只描述输入形状，不保存用户、DOM、请求或会话状态。工厂会在同步事件路径反复创建 Schema 并破坏 Calibur 的同一状态空间身份，Symbol 注册表又会引入不需要的生命周期。已评估将 Schema 作为参数传入、在宿主构造时登记和每次调用即时创建，前两者扩大装配依赖，后者增加事件延迟；未来若路由出现可释放资源，再迁入正式生命周期注册表。 */
const editorKeyState = zodState.object({
    insideBottomBacklink: zodState.boolean(),
    insideNestedProtyle: zodState.boolean(),
});

/** 编辑器键盘路由根据已收集的 DOM 状态分派所有权，不改变焦点。@允许模块级变量: 具体业务场景是编辑器键盘事件必须在当前 DOM 事件栈内立即决定是否让底部反链接管；该路由器只由只读 Schema 构建，执行时只读取调用参数，不含计时器、DOM、请求或跨调用数据。已评估工厂重建、Port 注入和 Symbol 注册表：工厂重复解析 Schema，Port 改变同步入口，注册表增加可变状态；静态函数引用是当前最小耦合实现。未来出现资源生命周期时再转为显式注册表。 */
export const resolveBacklinkEditorKeyCommand = zodCalibur
    .universe(editorKeyState)
    .split(zodState.object({
        insideBottomBacklink: zodState.literal(true),
        insideNestedProtyle: zodState.literal(false),
    }), () => "ignore-bottom-chrome" as const)
    .remain(() => "continue" as const)
    .build();

/** @允许模块级变量: 具体业务场景是面板树、文本控件和嵌套 Protyle 需要在同一状态空间中互斥分派；Schema 字段全是当前事件的布尔事实，模块加载后不写入也不持有焦点、布局或用户数据。已评估依赖注入、工厂和 Symbol 注册表，注入会把状态建模扩散到多个宿主，工厂每次键盘事件重复创建对象，注册表会制造没有生命周期的全局状态；保留静态只读定义最准确。若未来需要动态能力，再单独抽取可管理 Port。 */
const panelKeyState = zodState.object({
    insideBottomBacklink: zodState.boolean(),
    insideTextControl: zodState.boolean(),
    insideContentEditable: zodState.boolean(),
    insideNestedProtyle: zodState.boolean(),
});

/** 面板键盘路由分离文本控件、嵌套编辑器、底部反链和普通布局。@允许模块级变量: 具体业务场景是面板键盘事实需要按文本控件、嵌套编辑器、底部反链和普通布局的顺序互斥分派；路由结果完全由调用参数决定，不产生副作用且不持有资源。已评估每次调用构建、宿主传入工厂和 Symbol 注册表，分别会增加同步延迟、扩大装配面或引入无必要的可变生命周期；静态复用保持运行时与编译期状态空间一致。未来若分支需要动态配置，将迁移到有明确销毁边界的控制器，并增加资源释放测试与重载验证，同时记录新的生命周期契约。 */
export const resolveBacklinkPanelKeyCommand = zodCalibur
    .universe(panelKeyState)
    .split(zodState.object({insideTextControl: zodState.literal(true)}), () => "ignore" as const)
    .split(zodState.object({
        insideTextControl: zodState.literal(false),
        insideContentEditable: zodState.literal(true),
    }), () => "ignore" as const)
    .split(zodState.object({
        insideTextControl: zodState.literal(false),
        insideContentEditable: zodState.literal(false),
        insideNestedProtyle: zodState.literal(true),
    }), () => "ignore" as const)
    .split(zodState.object({
        insideTextControl: zodState.literal(false),
        insideContentEditable: zodState.literal(false),
        insideNestedProtyle: zodState.literal(false),
        insideBottomBacklink: zodState.literal(true),
    }), () => "bottom-backlink" as const)
    .remain(() => "active-layout" as const)
    .build();
