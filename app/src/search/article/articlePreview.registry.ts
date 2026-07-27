/** 用途：统一状态读写与文章预览键；使用范围：文章预览异步隔离；解耦评估：经本域网关直达全局注册表基础设施。 */
import {ARTICLE_PREVIEW_CURRENT_ID} from "./imports";
/** 用途：读取当前文章标识；使用范围：异步回调过期判断；解耦评估：本域网关直达全局状态读取。 */
import {getSForgeState} from "./imports";
/** 用途：登记当前文章标识；使用范围：新预览请求开始前；解耦评估：本域网关直达全局状态写入。 */
import {setSForgeState} from "./imports";

/** 登记最后选择的搜索预览文章，使旧异步回调能够被识别。 */
/** @同步豁免: 生命周期 - 选择事件必须在启动任何异步请求前立即更新当前文章标识。 */
export const selectArticlePreview = (id: string) => {
    const currentId = getSForgeState(ARTICLE_PREVIEW_CURRENT_ID);
    if (currentId === id) {
        return;
    }
    setSForgeState(ARTICLE_PREVIEW_CURRENT_ID, id);
};

/** 判断异步回调是否仍属于最后选择的文章。 */
/** @同步豁免: 类型守卫 - 每个请求回调必须立即读取同一注册表状态后决定是否继续。 */
export const isCurrentArticlePreview = (id: string) => getSForgeState(ARTICLE_PREVIEW_CURRENT_ID) === id;
