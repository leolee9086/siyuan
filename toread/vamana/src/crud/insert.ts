import type { VamanaState } from '../types';
import type { Vector, NodeData } from '../types';
import { VamanaNode } from '../types';
import { calculateSqNorm } from '../utils/norms';
import { validateVector } from '../utils/validate';
/**
 * 插入新节点到Vamana图中
 * 基于C++实现修复：只负责添加节点，建图逻辑在buildIndex阶段完成
 */
export function insertNodeToState(state: VamanaState, vector: Vector, data: NodeData = {}): number {
    const vectorArray = validateVector(vector);
    const nodeId = state.nextNodeId++;
    const newNode: VamanaNode = {
        vector: vectorArray,
        id: nodeId,
        data,
        neighbors: [], // 初始为空，在buildIndex阶段构建
        sqNorm: calculateSqNorm(vectorArray)
    };
    state.nodes.push(newNode);
    // 初始化反向图结构
    state.inGraph[nodeId] = [];
    return nodeId;
}