/** 用途：创建当前 Protyle 实例；使用范围：独立 ESM 挂载工厂；解耦评估：通过同层网关保留标准模块边界。 */
import {Protyle} from "./imports";
/** 用途：注册当前 Model 所需处理器；使用范围：迁移期 WebSocket 初始化；解耦评估：SyncPort 落地后删除。 */
import {setSForgeState} from "./imports";
/** 用途：定位 Model 处理器注册槽；使用范围：迁移期 WebSocket 初始化；解耦评估：与注册表依赖一起由 SyncPort 替代。 */
import {SForgeSymbols} from "./imports";
/** 用途：在构造编辑器前准备内核配置和资源；使用范围：独立挂载流程；解耦评估：未来仍保留但内部改由各 Runtime Port 实现。 */
import {bootstrapStandaloneProtyle} from "./bootstrap";
/** 用途：解析未提供的块标为当天日记块；使用范围：独立挂载流程；解耦评估：日记选择属于内核能力，可由后续 KernelPort 替换。 */
import {getStandaloneDailyNoteId} from "./bootstrap";
/** 用途：创建统一菜单宿主；使用范围：独立挂载流程；解耦评估：与完整 App 共用 Menu 实现，不复制菜单行为。 */
import {createProtyleMenu} from "./imports";
/** 用途：桥接遗留 App 类型；使用范围：迁移期挂载；解耦评估：ExtensionPort 完成实例注入后删除。 */
import {asStandaloneApp} from "./standalone.guard";
/** 用途：桥接遗留菜单全局；使用范围：迁移期挂载；解耦评估：菜单 Port 完成实例注入后删除。 */
import {asStandaloneMenus} from "./standalone.guard";
/** 用途：安装独立入口注入的 Dialog 宿主；使用范围：创建 Protyle 前注册弹窗、消息和 Tooltip 能力；解耦评估：仅依赖稳定 Port，宿主可通过参数替换。 */
import {setProtyleDialogPort} from "./imports";
/** 用途：固定公开挂载参数；使用范围：ESM 工厂签名；解耦评估：属于稳定公共契约。 */
import type {IStandaloneProtyleInstance} from "./standalone.types";
/** 用途：描述独立挂载调用参数；使用范围：ESM 工厂签名；解耦评估：属于稳定公开契约。 */
import type {IStandaloneProtyleOptions} from "./standalone.types";

/** 解析挂载元素，并在选择器无匹配时提供确定的启动错误。 */
const resolveTarget = (target: HTMLElement | string) => {
    if (target instanceof HTMLElement) {
        return target;
    }
    const element = document.querySelector(target);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Protyle mount target not found: ${target}`);
    }
    return element;
};

/** 当前独立入口不转发主应用事件，保留空函数只为满足迁移期 App 结构。 */
const ignoreEvent = () => undefined;

/** 保留成功消息并阻止错误消息进入编辑器推送处理，后续由 SyncPort 接管。 */
const processMessage = (response: IWebSocketData) => response.code < 0 ? false : response;

/** 独立入口没有布局树，无需处理主应用布局同步。 */
const reloadSync = () => undefined;

/** 为每个编辑器实例创建独立工具栏定义，避免共享数组被 Options 合并流程修改。 */
const createStandaloneToolbar = () => "strong,em,u,s,code,a".split(",");

/** 为指定挂载点生成内核错误处理器。 */
// @柯里化 处理器必须捕获当前编辑器的挂载点，将连接错误投递给正确实例。
const createKernelErrorHandler = (target: HTMLElement) => () => target.dispatchEvent(new CustomEvent("protyle-kernel-error"));

/**
 * 独立初始化并挂载 Protyle。
 * 该函数是浏览器 ESM 的稳定入口，先完成内核环境 bootstrap，再创建现有 Protyle 实例。
 */
export const mountStandaloneProtyle = async (options: IStandaloneProtyleOptions) => {
    const target = resolveTarget(options.target);
    const runtime = await bootstrapStandaloneProtyle();
    const blockId = options.blockId || await getStandaloneDailyNoteId(runtime);
    const menu = options.menu || createProtyleMenu({closeOnOutsideClick: true});
    if (options.dialog) {
        setProtyleDialogPort(options.dialog);
    }
    runtime.menus = asStandaloneMenus(menu);
    setSForgeState(SForgeSymbols.MODEL_HANDLERS, {
        processMessage,
        kernelError: createKernelErrorHandler(target),
        reloadSync: () => reloadSync(),
    });

    const app = asStandaloneApp({appId: "protyle-standalone", plugins: [], eventBus: {emit: ignoreEvent, on: ignoreEvent, off: ignoreEvent}});
    let readyTimer = 0;
    const readyPromise = new Promise<IStandaloneProtyleInstance>((resolve, reject) => {
        // 当前 fetchPost 不向调用方暴露网络失败，固定超时是入口能够退出等待并显示错误的唯一机制。
        readyTimer = window.setTimeout(() => reject(new Error("Protyle initialization timed out")), 30000);
        /** getDoc 和首次 DOM 渲染结束后完成异步挂载。 */
        // @柯里化 ready 处理器必须捕获当前 Promise 和编辑器实例。
        const handleReady = (readyEditor: Protyle) => {
            window.clearTimeout(readyTimer);
            resolve(Object.assign(readyEditor, {
                menu,
                /** 以视口坐标显示当前编辑器菜单。 */
                showMenu: (position: IPosition) => menu.popup(position),
                /** 隐藏并清理当前编辑器菜单。 */
                hideMenu: () => menu.remove(),
            }));
        };
        const editor = new Protyle(app, target, {
            blockId,
            mode: "wysiwyg",
            action: [],
            render: {
                background: false,
                title: false,
                gutter: true,
                scroll: false,
                breadcrumb: false,
            },
            toolbar: createStandaloneToolbar(),
            status: options.status,
            upload: {
                url: "",
            },
            after: handleReady,
        });
        runtime.ws = editor.protyle.ws;
    });
    return readyPromise;
};
