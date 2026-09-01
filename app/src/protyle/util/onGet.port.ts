import type {IOnGetRequest, TOnGet} from "./onGet.types";

/** 内核响应处理能力的跨入口注册键。 */
const onGetKey = Symbol.for("sforge.protyle.onGet");

/** 未装配编辑器时忽略动态加载响应。 */
const ignoreOnGet: TOnGet = (_options: IOnGetRequest) => undefined;

/** 检查未知注册值是否符合内核响应处理契约。 */
const isOnGet = (value: unknown): value is TOnGet => {
    return typeof value === "function";
};

/** 读取当前宿主的内核响应处理能力。 */
export const getOnGet = () => {
    const value = Reflect.get(globalThis, onGetKey);
    if (isOnGet(value)) {
        return value;
    }
    return ignoreOnGet;
};

/** 注册完整编辑器提供的内核响应处理能力。 */
export const setOnGet = (handler: TOnGet) => {
    if (!Reflect.set(globalThis, onGetKey, handler)) {
        throw new Error("Unable to register onGet handler");
    }
};
