import { Constants } from "../../constants";
import { addScript } from "../util/addScript";
import { fetchPost } from "../../util/network/fetch";
import { setSiyuanViewer, destroySiyuanViewer, getSiyuanViewer } from "../../util/siyuanEnvironments/viewer.environment";
import { isBrowserRenderableImagePath } from "../../util/imageURL";

/**
 * 作用：获取图片查看器的标题
 * 意图：根据 Image 对象或文件名生成标题，并处理文件名格式
 * 调用时机：Viewer 组件 dynamic loading 配置中调用
 *
 * @param image 图片 DOM 元素
 * @param imageData 图片数据
 */
const getViewerTitle = (image: HTMLImageElement, imageData: IObject) => {
    let name = image.alt;
    if (!name) {
        name = image.src.substring(image.src.lastIndexOf("/") + 1);
    }
    name = name.substring(0, name.lastIndexOf(".")).replace(/-\d{14}-\w{7}$/, "");
    return `${name} [${imageData.naturalWidth} × ${imageData.naturalHeight}]`;
};

/**
 * 作用：构建并显示图片查看器
 * 意图：生成图片列表 HTML，初始化 Viewer 实例并显示
 * 调用时机：previewImages 中加载完 viewer.js 后
 *
 * @param srcList 需要预览的图片地址列表
 * @param currentSrc 当前点击/显示的图片地址
 * @param onHidden 查看器隐藏后的回调
 */
const showViewer = (srcList: string[], currentSrc?: string, onHidden?: () => void) => {
    const imagesElement = document.createElement("ul");
    let initialViewIndex = -1;
    for (const [index, item] of srcList.entries()) {
        if (!item) {
            continue;
        }
        const li = document.createElement("li");
        const img = document.createElement("img");
        img.src = encodeURI(item);
        li.appendChild(img);
        imagesElement.appendChild(li);
        if (currentSrc && initialViewIndex === -1 && (currentSrc.endsWith(encodeURI(item)) || currentSrc.endsWith(item))) {
            initialViewIndex = index;
        }
    }
    setSiyuanViewer(new Viewer(imagesElement, {
        initialViewIndex: currentSrc ? initialViewIndex : 0,
        title: [1, getViewerTitle],
        button: false,
        transition: false,
        /** 销毁 viewer 实例 */
        hidden: () => {
            destroySiyuanViewer();
            if (onHidden) {
                onHidden();
            }
        },
        toolbar: {
            zoomIn: true,
            zoomOut: true,
            oneToOne: true,
            reset: true,
            prev: true,
            play: true,
            next: true,
            rotateLeft: true,
            rotateRight: true,
            flipHorizontal: true,
            flipVertical: true,
            /** 销毁 viewer 实例 */
            close: () => {
                destroySiyuanViewer();
            },
        },
    }));
    getSiyuanViewer()?.show();
};

/**
 * 作用：初始化并显示图片查看器
 * 意图：封装 viewerjs 库的使用细节，提供统一的图片预览 UI
 * 调用时机：在 previewDocImage 或 previewAttrViewImages 获取到图片列表后调用
 * @param srcList 图片地址列表
 * @param currentSrc 当前选中的图片地址
 * @param onHidden 查看器隐藏后的回调
 */
export const previewImages = (srcList: string[], currentSrc?: string, onHidden?: () => void) => {
    addScript(`${Constants.PROTYLE_CDN}/js/viewerjs/viewer.js?v=1.11.8`, "protyleViewerScript").then(() =>
        showViewer(srcList, currentSrc, onHidden)
    );
};

/**
 * 作用：获取文档及其关联的各个视图片中的所有图片并调用 Viewer 进行预览
 * 意图：为用户提供浏览当前文档内所有图片的快捷方式
 * 调用时机：点击文档题图或文档菜单中的"预览图片"时
 *
 * @param currentSrc 当前正在浏览的图片地址，用于定位初始显示图片
 * @param id 文档 ID
 */
export const previewDocImage = (currentSrc: string, id: string) => {
    fetchPost("/api/asset/getDocImageAssets", { id }, (response) =>
        previewImages(response.data, currentSrc)
    );
};

/**
 * 作用：获取属性视图（表格/看板等）中的图片并调用预览
 * 意图：支持数据库视图下的多图浏览功能
 * 调用时机：在属性视图中点击单元格内的图片预览按钮时
 *
 * @param currentSrc 当前点击的图片地址
 * @param avID 属性视图 ID
 * @param viewID 视图 ID
 * @param query 查询条件，用于筛选具体的图片范围
 */
export const previewAttrViewImages = (currentSrc: string, avID: string, viewID: string, query: string) => {
    fetchPost("/api/av/getCurrentAttrViewImages", {
        id: avID,
        viewID,
        query,
    }, (response) => {
        previewImages(response.data.filter((item: string) => isBrowserRenderableImagePath(item)), currentSrc);
    });
};
