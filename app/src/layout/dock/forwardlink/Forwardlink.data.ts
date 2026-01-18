import { fetchPost } from "../../../util/fetch";
import { getIconByType } from "../../../editor/getIcon";
import { IForwardlinkTreeNode, ISqlResultItem, IBlockResult } from "./Forwardlink.types";

const IAL_REGEX = /\s([\w-]+)="([^"]*)"/g;

const SORT_ORDER_MAP: Record<string, string> = {
    "1": "b.hPath DESC",
    "2": "b.updated ASC",
    "3": "b.updated DESC",
    "4": "b.hPath ASC", // 自然排序前端处理
    "5": "b.hPath DESC",
    "9": "b.created ASC",
    "10": "b.created DESC",
    "0": "b.hPath ASC",
};

/**
 * 构建 SQL 排序子句
 *
 * - 作用：根据传入的排序属性构建 SQL 查询的 ORDER BY 子句
 * - 意图：将前端的排序选项映射到数据库字段
 * - 调用时机：在构建反向链接查询 SQL 时调用
 * - 改进：自然排序目前依赖前端处理，未来可能考虑数据库层支持
 */
const buildOrderBy = (sortAttr: string) => {
    return SORT_ORDER_MAP[sortAttr] || "b.hPath ASC";
};

/**
 * 构建 SQL 关键字过滤条件
 *
 * - 作用：根据关键字构建 SQL 的 WHERE 子句部分
 * - 意图：支持对内容和路径的模糊搜索
 * - 调用时机：在构建反向链接查询 SQL 时调用
 */
const buildKeywordCondition = (keyword: string) => {
    if (!keyword) {
        return "";
    }
    const k = keyword.replace(/'/g, "''");
    return `AND (b.content LIKE '%${k}%' OR b.hPath LIKE '%${k}%')`;
};

/**
 * 解析 IAL 字符串
 *
 * - 作用：将 IAL 字符串解析为键值对对象
 * - 意图：方便获取和操作 IAL 属性
 * - 调用时机：在处理 SQL 查询结果时，将原始 IAL 字符串转为对象
 */
const parseIal = (ialString: string) => {
    const ial: { [key: string]: string } = {};
    if (ialString) {
        ialString.replace(/\\"/g, '"').replace(/\\\\/g, "\\").replace(IAL_REGEX, (_m, k, v) => {
            ial[k] = v;
            return _m;
        });
    }
    return ial;
};

/**
 * 将 SQL 查询结果项转换为树节点
 * 
 * - 作用：将数据库原始数据转换为 UI 层需要的树节点格式
 * - 意图：解析 IAL 并添加图标信息
 */
const 转换为树节点 = (item: ISqlResultItem): IForwardlinkTreeNode => {
    const ial = parseIal(item.ial);
    const nodeType = "NodeDocument";
    return {
        id: item.id,
        name: item.name || item.hPath || "无标题",
        type: nodeType,
        box: item.box,
        hPath: item.hPath,
        count: item.refCount || 1,
        ial,
        icon: getIconByType(nodeType)
    };
};

/**
 * 构建反向链接查询 SQL
 *
 * - 作用：组装完整的 SQL 查询语句以获取反向链接
 * - 意图：集中管理 SQL 逻辑，提高可维护性
 * - 调用时机：在 searchForwardLinks 函数中调用
 */
const buildForwardLinksSql = (rootId: string, keywordCondition: string, orderBy: string) => {
    return `
        SELECT DISTINCT 
            r.def_block_root_id as id,
            b.content as name,
            b.type,
            b.box,
            b.hPath,
            b.ial,
            COUNT(*) as refCount
        FROM refs AS r
        INNER JOIN blocks AS b ON b.id = r.def_block_root_id
        WHERE r.root_id = '${rootId}'
        ${keywordCondition}
        GROUP BY r.def_block_root_id
        ORDER BY ${orderBy}
        LIMIT 512
    `;
};

/**
 * 搜索反向链接
 *
 * - 作用：执行 SQL 查询以获取指定文档的反向链接
 * - 意图：作为反向链接面板的主要数据获取接口
 * - 调用时机：反向链接面板加载或刷新时调用
 * @returns Promise，解析为包含 forwardlinks 和 count 的对象
 */
export const searchForwardLinks = (
    rootId: string,
    keyword: string,
    sortAttr: string
): Promise<{ forwardlinks: IForwardlinkTreeNode[], count: number }> => {
    // 无 rootId 时直接返回空结果
    if (!rootId) {
        return Promise.resolve({ forwardlinks: [], count: 0 });
    }

    const orderBy = buildOrderBy(sortAttr);
    const keywordCondition = buildKeywordCondition(keyword);
    // SQL 查询：获取当前文档引用的所有目标文档
    const sql = buildForwardLinksSql(rootId, keywordCondition, orderBy);

    return new Promise((resolve) => {
        // @内联回调
        fetchPost("/api/query/sql", { stmt: sql }, response => {
            const data = response.data || [];
            const items = Array.isArray(data) ? data : [];
            resolve({
                forwardlinks: items.map(转换为树节点),
                count: items.length
            });
        });
    });
};

/**
 * 获取引用块详情
 *
 * - 作用：查询特定文档中引用了当前文档的具体块
 * - 意图：用于展示正向链接的上下文详情
 * - 调用时机：当用户在 UI 中展开某个正向链接文档节点时调用
 * @returns Promise，解析为块数组
 */
export const fetchBlocks = (
    rootId: string,
    docId: string
): Promise<IBlockResult[]> => {
    const sql = `
        SELECT 
            b.id,
            b.content,
            b.type,
            b.subType,
            b.box
        FROM refs AS r
        INNER JOIN blocks AS b ON b.id = r.def_block_id
        WHERE r.root_id = '${rootId}' 
        AND r.def_block_root_id = '${docId}'
        ORDER BY b.updated DESC
        LIMIT 64
    `;

    return new Promise((resolve) => {
        // @内联回调
        fetchPost("/api/query/sql", { stmt: sql }, (response) => {
            // 无数据或数据为空数组时返回空列表
            if (!response.data || response.data.length === 0) {
                resolve([]);
                return;
            }
            // response.data 已经是 fetchPost 解析后的数据，类型可推断
            resolve(response.data);
        });
    });
};
