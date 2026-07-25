/** 用途：提供应用 ID。使用范围：本地配置持久化请求。解耦评估：通过 storage 子域 imports.ts 显式转发协议常量。 */
import {Constants} from "./imports";
/** 用途：发送存储请求。使用范围：本地配置唯一持久化实现。解耦评估：通过 storage 子域 imports.ts 显式转发网络基础设施。 */
import {fetchPost} from "./imports";

/** 持久化应用本地配置；只读和发布模式保持原有无写入语义。 */
/** @同步豁免: 生命周期 - 既有 212 个调用点依赖同步发起请求并通过可选回调观察异步完成，改成 Promise 会改变公共调用语义。 */
export const setStorageVal = <T>(key: string, val: T, cb?: () => void) => {
    const config = window.siyuan.config;
    if (!config) {
        throw new Error("setStorageVal requires initialized application config");
    }
    if (config.readonly || window.siyuan.isPublish) {
        return;
    }
    fetchPost("/api/storage/setLocalStorageVal", {
        app: Constants.SIYUAN_APPID,
        key,
        val,
    }, () => {
        if (cb) {
            cb();
        }
    });
};
