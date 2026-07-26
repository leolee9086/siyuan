/** 用途：配置 Schema 构造。使用范围：配置字段校验；解耦评估：第三方 Schema 后端。 */
import z from "zod";
/** 导出 Zod Schema 构造器。 */
export {z};

/** 用途：异步内核请求。使用范围：文件树配置持久化；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出异步内核请求。 */
export {fetchPost};

/** 用途：读取已初始化配置。使用范围：文件树计算属性；解耦评估：稳定环境边界。 */
import {getSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出配置读取。 */
export {getSiyuanConfig};

/** 用途：国际化文案。使用范围：配置 Schema 标题与说明；解耦评估：稳定环境边界。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化文案。 */
export {siyuanI18n};

/** 用途：Vue 计算属性。使用范围：配置字段双向绑定；解耦评估：框架基础能力。 */
import {computed} from "vue";
/** 导出 Vue 计算属性。 */
export {computed};
