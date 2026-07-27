/** 用途：读取缓存键；使用范围：索引重建缓存失效；解耦评估：经本域网关直达协议声明。 */
import {Constants} from "./imports";
/** 用途：发送重建请求；使用范围：索引重建命令；解耦评估：经本域网关直达网络实现。 */
import {fetchPost} from "./imports";
/** 用途：读取应用存储；使用范围：索引重建缓存失效；解耦评估：经本域网关直达严格环境入口。 */
import {getSiyuanStorage} from "./imports";
/** 用途：持久化缓存失效；使用范围：索引重建命令；解耦评估：经本域网关直达存储实现。 */
import {setStorageVal} from "./imports";

/** 清空文件位置缓存并请求内核完整重建数据索引。 */
/** 原调用协议同步清空缓存并立即发起回调式请求，完成通知保持原回调时序。 */
/** @同步豁免: 遗留代码 */
export const rebuildDataIndex = (onComplete?: () => void) => {
    const storage = getSiyuanStorage();
    storage[Constants.LOCAL_FILEPOSITION] = {};
    setStorageVal(Constants.LOCAL_FILEPOSITION, storage[Constants.LOCAL_FILEPOSITION]);
    fetchPost("/api/system/rebuildDataIndex", {}, () => {
        onComplete?.();
    });
};
