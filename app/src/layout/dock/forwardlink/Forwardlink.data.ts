import { fetchPost } from "../../../util/fetch";
import { getIconByType } from "../../../editor/getIcon";
import { IForwardlinkTreeNode } from "./Forwardlink.types";

const IAL_REGEX = /\s([\w-]+)="([^"]*)"/g;

const buildOrderBy = (sortAttr: string) => {
    switch (sortAttr) {
        case "1": return "b.hPath DESC";
        case "2": return "b.updated ASC";
        case "3": return "b.updated DESC";
        case "4": return "b.hPath ASC"; // 自然排序前端处理
        case "5": return "b.hPath DESC";
        case "9": return "b.created ASC";
        case "10": return "b.created DESC";
        case "0":
        default: return "b.hPath ASC";
    }
};

const buildKeywordCondition = (keyword: string) => {
    if (!keyword) {
        return "";
    }
    const k = keyword.replace(/'/g, "''");
    return `AND (b.content LIKE '%${k}%' OR b.hPath LIKE '%${k}%')`;
};

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

interface ISqlResultItem {
    id: string;
    // eslint-disable-next-line camelcase
    name: string;
    type: string;
    box: string;
    hPath: string;
    ial: string;
    refCount: number;
}

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

export const searchForwardLinks = (
    rootId: string,
    keyword: string,
    sortAttr: string,
    callback: (data: { forwardlinks: IForwardlinkTreeNode[], count: number }) => void
) => {
    if (!rootId) {
        callback({ forwardlinks: [], count: 0 });
        return;
    }

    const orderBy = buildOrderBy(sortAttr);
    const keywordCondition = buildKeywordCondition(keyword);
    // SQL 查询：获取当前文档引用的所有目标文档
    const sql = buildForwardLinksSql(rootId, keywordCondition, orderBy);

    fetchPost("/api/query/sql", { stmt: sql }, response => {
        const data = (response.data || []) as ISqlResultItem[];
        callback({
            forwardlinks: data.map((item) => {
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
            }),
            count: data.length
        });
    });
};

interface IBlockResult {
    id: string;
    content: string;
    type: string;
    subType: string;
    box: string;
}

export const fetchBlocks = (
    rootId: string,
    docId: string,
    callback: (blocks: IBlockResult[]) => void
) => {
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

    fetchPost("/api/query/sql", { stmt: sql }, (response) => {
        if (!response.data || response.data.length === 0) {
            callback([]);
            return;
        }
        callback(response.data as IBlockResult[]);
    });
};
