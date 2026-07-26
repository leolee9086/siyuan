/** 用途：定位搜索历史本地存储槽；使用范围：搜索词与资源词持久化；解耦评估：经本职责直达网关引用唯一协议常量。 */
import {Constants} from "./imports";
/** 用途：读取搜索历史数量限制；使用范围：搜索历史截断；解耦评估：经本职责直达网关读取现有配置生命周期。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取并更新当前搜索历史对象；使用范围：搜索历史持久化；解耦评估：经本职责直达网关读取现有存储生命周期。 */
import {getSiyuanStorage} from "./imports";
/** 用途：把搜索历史同步提交给本地存储接口；使用范围：搜索历史持久化；解耦评估：经本职责直达网关复用唯一写入实现。 */
import {setStorageVal} from "./imports";
/** 用途：统一执行搜索历史前置、去重与截断；使用范围：两类搜索历史持久化；解耦评估：纯数据算法是本子域唯一实现，直接依赖不会加载 UI。 */
import {prependSearchHistory} from "./normalize";

/** 保存普通搜索或替换词历史；调用完成时内存状态必须已可供紧随其后的搜索流程读取。 */
/** @同步豁免: 生命周期 */
export const saveKeyList = (type: "keys" | "replaceKeys", value: string) => {
    const storage = getSiyuanStorage();
    const localSearchKeys = storage[Constants.LOCAL_SEARCHKEYS];
    localSearchKeys[type] = prependSearchHistory(localSearchKeys[type], value, getSiyuanConfig().search.limit);
    setStorageVal(Constants.LOCAL_SEARCHKEYS, localSearchKeys);
};

/** 保存资源搜索词历史；空输入保持原有无写入语义。 */
/** @同步豁免: 生命周期 */
export const saveAssetKeyList = (inputElement: HTMLInputElement) => {
    if (!inputElement.value) {
        return;
    }
    const storage = getSiyuanStorage();
    const localSearchAsset = storage[Constants.LOCAL_SEARCHASSET];
    localSearchAsset.keys = prependSearchHistory(localSearchAsset.keys, inputElement.value, getSiyuanConfig().search.limit);
    localSearchAsset.k = inputElement.value;
    setStorageVal(Constants.LOCAL_SEARCHASSET, localSearchAsset);
};
