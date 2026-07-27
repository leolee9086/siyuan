/** 用途：折叠查询所需网络与动作常量；使用范围：Block Fold 领域唯一查询实现；解耦评估：经专属网关直达真实依赖。 */
import {Constants} from "./imports";
/** 用途：发送折叠状态查询；使用范围：Block Fold 领域唯一查询实现；解耦评估：经专属网关直达真实依赖。 */
import {fetchPost} from "./imports";

/** 将内核折叠结果映射为现有导航参数。 */
function getFoldNavigation(foldResponse: IWebSocketData) {
    const action: TProtyleAction[] = foldResponse.data.isFolded
        ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL]
        : [Constants.CB_GET_FOCUS, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL];
    return [foldResponse.data.isFolded, action, foldResponse.data.isRoot] as const;
}

/**
 * 查询块折叠状态并映射为既有打开动作。
 * @同步豁免: 遗留代码 - 该公开命令由既有 26 个事件调用点以回调协议消费，函数同步完成请求登记，
 * 网络结果再通过 callback 交付；改成 async 只会新增从未消费的 Promise 并改变公开错误与返回语义。
 */
export const checkFold = (
    id: string,
    callback: (zoomIn: boolean, action: TProtyleAction[], isRoot: boolean) => void,
) => {
    if (!id) {
        return;
    }
    fetchPost("/api/block/checkBlockFold", {id}, (foldResponse) => {
        const navigation = getFoldNavigation(foldResponse);
        callback(...navigation);
    });
};
