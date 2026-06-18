/** 用途：同步 POST 请求函数。使用范围：assets 模块上传图片资源。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "./imports";
/** 用途：全局常量配置。使用范围：图片处理常量。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "./imports";

/**
 * 为图片 URL 添加压缩参数
 *
 * 作用：为符合条件的资源图片 URL 添加缩略图样式参数
 * 意图：优化图片加载性能，减少带宽占用
 * 调用时机：渲染图片列表或缩略图时，需要使用压缩版本的图片
 *
 * @param url - 原始图片 URL
 * @returns 添加压缩参数后的 URL，如果不符合条件则返回原 URL
 */
export const getCompressURL = async (url: string) => {
    if (url.startsWith("assets/") &&
        (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg"))) {
        return url + "?style=thumb";
    }
    return url;
};

/**
 * 移除图片 URL 的压缩参数
 *
 * 作用：从图片 URL 中移除缩略图样式参数，恢复原始 URL
 * 意图：需要显示原图时移除压缩参数
 * 调用时机：用户点击查看原图或需要高清图片时
 *
 * @同步豁免: 性能考虑 - 纯字符串操作，无需异步，频繁调用需要最小开销
 *
 * @param url - 可能包含压缩参数的图片 URL
 * @returns 移除压缩参数后的 URL，如果不符合条件则返回原 URL
 */
export const removeCompressURL = async (url: string) => {
    if (url.startsWith("assets/") &&
        (url.endsWith(".png?style=thumb") || url.endsWith(".jpg?style=thumb") || url.endsWith(".jpeg?style=thumb"))) {
        return url.replace("?style=thumb", "");
    }
    return url;
};

/**
 * 将 base64 图片数据转换为服务器 URL
 *
 * 作用：将 base64 编码的图片数据上传到服务器并返回可访问的 URL 列表
 * 意图：支持粘贴或拖拽图片时将内联 base64 数据转换为服务器存储的资源
 * 调用时机：编辑器处理包含 base64 图片的内容时（如粘贴、拖拽操作）
 *
 * @param base64SrcList - base64 图片数据列表，格式为 "data:image/xxx;base64,..."
 * @returns 上传成功后的图片 URL 列表
 */
export const base64ToURL = async (base64SrcList: string[]) => {
    const formData = new FormData();
    
    for (const item of base64SrcList) {
        const file = convertBase64ToFile(item);
        if (file) {
            formData.append("file[]", file);
        }
    }
    
    const response = await fetchSyncPost(Constants.UPLOAD_ADDRESS, formData);
    const URLs: string[] = [];
    
    for (const key of Object.keys(response.data.succMap)) {
        const url = response.data.succMap[key];
        URLs.push(url);
    }
    
    return URLs;
};

/**
 * 将单个 base64 字符串转换为 File 对象
 *
 * 作用：解析 base64 数据并创建可上传的 File 对象
 * 意图：封装 base64 到 File 的转换逻辑，处理 MIME 类型和二进制数据
 * 调用时机：base64ToURL 处理每个 base64 图片数据时
 *
 * @param base64Src - base64 图片数据，格式为 "data:image/xxx;base64,..."
 * @returns File 对象，如果格式无效则返回 null
 */
function convertBase64ToFile(base64Src: string) {
    const srcPart = base64Src.split(",");
    if (srcPart.length !== 2) {
        return null;
    }
    
    // data:image/svg+xml;base64,XXX
    const headerPart = srcPart[0];
    const dataPart = srcPart[1];
    if (!headerPart || !dataPart) {
        return null;
    }
    
    const mimeMatch = headerPart.match(/data:([^;]+);/);
    const mime = mimeMatch?.[1] ?? "application/octet-stream";
    
    const mimeToExtMap: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/svg+xml": "svg"
    };
    const ext = mimeToExtMap[mime] ?? "png";
    
    const binary = atob(dataPart);
    const u8arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        u8arr[i] = binary.charCodeAt(i);
    }
    
    return new File([u8arr], `base64image-${Lute.NewNodeID()}.${ext}`, { type: mime });
}
