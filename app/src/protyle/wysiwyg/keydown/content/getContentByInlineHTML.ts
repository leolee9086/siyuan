/** 用途：调用内核 DOM 文本转换接口；使用范围：内联选区内容提取；解耦评估：子域网关直达唯一网络实现，保持请求协议显式。 */
import {fetchPost} from "./imports";
/** 用途：同步快照 Range 的内联 DOM；使用范围：发起内核文本转换前；解耦评估：纯叶子实现独立于网络和应用构建环境。 */
import {serializeInlineRangeHTML} from "./serializeInlineRangeHTML";

/**
 * 将当前内联选区交给内核转换为规范纯文本，并沿用原 callback 时序返回。
 * @同步豁免: 遗留代码 - 公开协议同步发起 fetchPost 并由既有回调接收结果，调用方依赖该签名。
 */
export const getContentByInlineHTML = (range: Range, callback: (content: string) => void) => {
    const dom = serializeInlineRangeHTML(range);
    fetchPost("/api/block/getDOMText", {dom}, (response) => {
        callback(response.data);
    });
};
