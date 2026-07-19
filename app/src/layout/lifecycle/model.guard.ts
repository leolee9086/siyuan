/** 用途：布局模型能力接口；使用范围：运行时结构守卫的返回类型；解耦评估：同目录纯类型依赖。 */
import type {ILayoutDisposableModel} from "./model.types";
/** 用途：布局模型能力接口；使用范围：运行时结构守卫的返回类型；解耦评估：同目录纯类型依赖。 */
import type {ILayoutDestroyableModel} from "./model.types";
/** 用途：布局模型最小接口；使用范围：运行时结构守卫的返回类型；解耦评估：同目录纯类型依赖。 */
import type {ILayoutModel} from "./model.types";
/** 用途：布局模型序列化接口；使用范围：运行时结构守卫的返回类型；解耦评估：同目录纯类型依赖。 */
import type {ILayoutSerializableModel} from "./model.types";

/** 检查对象是否实现最小布局模型接口。 @同步豁免: 类型守卫 */
export function isLayoutModel(value: unknown): value is ILayoutModel {
    return typeof value === "object" && value !== null && Reflect.get(value, "layoutModel") === true;
}

/** 检查布局模型是否提供自描述序列化数据。 @同步豁免: 类型守卫 */
export function isLayoutSerializableModel(value: unknown): value is ILayoutSerializableModel {
    if (!isLayoutModel(value)) {
        return false;
    }
    const serialization = Reflect.get(value, "layoutSerialization");
    return typeof serialization === "object" && serialization !== null && !Array.isArray(serialization);
}

/** 检查布局模型是否提供资源释放能力。 @同步豁免: 类型守卫 */
export function isLayoutDisposableModel(value: unknown): value is ILayoutDisposableModel {
    return isLayoutModel(value) && typeof Reflect.get(value, "dispose") === "function";
}

/** 检查布局模型是否提供业务销毁钩子。 @同步豁免: 类型守卫 */
export function isLayoutDestroyableModel(value: unknown): value is ILayoutDestroyableModel {
    return isLayoutModel(value) && typeof Reflect.get(value, "destroy") === "function";
}
