/** 用途：语言资源地址与异步读取能力。使用范围：本环境适配器；解耦评估：同层网关直达真实声明，入口无需依赖网络实现。 */
import {Constants} from "./imports";
/** 用途：等待静态语言资源响应。使用范围：本环境适配器；解耦评估：同层网关直达唯一网络请求实现。 */
import {fetchGetAsync} from "./imports";
/** 用途：验证外部语言资源。使用范围：写入 window.siyuan.languages 前；解耦评估：同子域守卫是外部输入边界，不适合由调用方重复注入。 */
import {isSiyuanLanguages} from "./languages.guard";

/** 加载、验证并安装指定语言资源；Promise 在全局语言字典可用后兑现。 */
export const loadSiyuanLanguages = async (language: string) => {
    const response = await fetchGetAsync(`/appearance/langs/${language}.json?v=${Constants.SIYUAN_VERSION}`);
    if (!isSiyuanLanguages(response)) {
        throw new TypeError(`Language resource ${language} is not an object`);
    }
    window.siyuan.languages = response;
    return response;
};
