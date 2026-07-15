/** 内核 getConf 对独立入口有用的数据，后续由 KernelPort 统一校验。 */
export interface IKernelConfigResponse {
    conf: Config.IConf;
    isPublish?: boolean;
}

/** 独立入口迁移期运行时，字段随各 Port 落地而逐步删除。 */
export interface IStandaloneSiyuanRuntime {
    config: Config.IConf;
    languages: IObject;
    emojis: IEmoji[];
    storage: IObject;
    transactions: unknown[];
    reqIds: Record<string, number>;
    menus?: ISiyuan["menus"];
    ws?: ISiyuan["ws"];
    [key: string]: unknown;
}

/**
 * 用途：描述独立 Protyle 的最小挂载参数。
 * 使用场景：独立页面或外部应用通过 ESM 入口创建编辑器。
 * 关联类型：返回现有 Protyle 实例；未提供 blockId 时由核心日记接口解析当天文档。
 */
export interface IStandaloneProtyleOptions {
    target: HTMLElement | string;
    blockId?: string;
    status?: HTMLElement | string;
    menu?: IProtyleMenuPort;
    /** 可选弹窗宿主；未提供时使用独立 DOM 回退实现。 */
    dialog?: IProtyleDialogPort;
}
/** 用途：引用可选菜单宿主协议；使用范围：公开挂载参数；解耦评估：类型依赖不引入具体实现。 */
import type {IProtyleMenuPort} from "./imports";
/** 用途：引用可选弹窗宿主协议；使用范围：公开挂载参数；解耦评估：类型依赖不引入具体实现。 */
import type {IProtyleDialogPort} from "../protyle/runtime/dialog.types";
/** 用途：引用挂载完成后的 Protyle 实例类型；使用范围：公开返回值菜单控制 API；解耦评估：仅类型依赖，不增加运行时耦合。 */
import type {Protyle} from "./imports";

/** 独立挂载完成后暴露给宿主的编辑器实例和菜单能力。 */
export type IStandaloneProtyleInstance = Protyle & {
    menu: IProtyleMenuPort;
    showMenu: (position: IPosition) => void;
    hideMenu: () => void;
};
