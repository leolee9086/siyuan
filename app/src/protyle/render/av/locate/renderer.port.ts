import type {TAVLocateRenderer} from "./renderer.types";

/** AV 根渲染器的跨入口注册键。 */
const avLocateRendererKey = Symbol.for("sforge.av.locateRenderer");

/** 未装配完整 AV 渲染器时的明确回退。 */
const ignoreAVLocateRender: TAVLocateRenderer = async () => undefined;

/** 校验未知注册值是否为 AV 根渲染器。 */
const isAVLocateRenderer = (value: unknown): value is TAVLocateRenderer => {
    return typeof value === "function";
};

/** 读取当前宿主的 AV 根渲染器。 */
export const getAVLocateRenderer = () => {
    const value = Reflect.get(globalThis, avLocateRendererKey);
    if (isAVLocateRenderer(value)) {
        return value;
    }
    return ignoreAVLocateRender;
};

/** 注册完整 AV 模块提供的根渲染器。 */
export const setAVLocateRenderer = (renderer: TAVLocateRenderer) => {
    if (!Reflect.set(globalThis, avLocateRendererKey, renderer)) {
        throw new Error("Unable to register AV locate renderer");
    }
};
