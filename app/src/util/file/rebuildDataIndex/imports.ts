/**
 * 用途：定位文件位置缓存的稳定存储键。
 * 使用范围：仅用于完整重建索引前清空本地文件位置缓存。
 * 解耦评估：键值是跨前后端约定，不应由各调用方重复传入或复制字面量。
 */
import {Constants} from "../../../constants";
/** 导出协议常量供重建索引领域使用。 */
export {Constants};

/**
 * 用途：将已清空的文件位置缓存同步持久化到宿主存储。
 * 使用范围：仅用于重建索引命令的缓存失效步骤。
 * 解耦评估：持久化实现属于现有兼容层的唯一所有者，网关必须直达该实现，禁止多跳转发。
 */
import {setStorageVal} from "../../../protyle/util/compatibility";
/** 导出存储持久化能力供重建索引领域使用。 */
export {setStorageVal};

/**
 * 用途：向内核发送完整重建数据索引请求。
 * 使用范围：仅用于本领域的重建索引应用命令。
 * 解耦评估：网络请求由现有基础设施唯一实现，网关必须直达该实现，调用方不装配传输细节。
 */
import {fetchPost} from "../../network/fetch";
/** 导出网络请求能力供重建索引领域使用。 */
export {fetchPost};

/**
 * 用途：读取已完成初始化的应用存储，并在前置条件缺失时显式失败。
 * 使用范围：仅用于索引重建前替换文件位置缓存。
 * 解耦评估：环境入口是全局存储的唯一受控访问点，网关直达该声明，不向菜单调用方泄漏全局结构。
 */
import {getSiyuanStorage} from "../../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格存储访问器供重建索引领域使用。 */
export {getSiyuanStorage};
