import type {VamanaState} from '../types';
/**
 * 高效删除节点 - 利用反向图结构
 * 时间复杂度：O(1) 查找指向该节点的所有节点
 */
export function deleteNodeFromState(state: VamanaState, nodeId: number): boolean {
    // 检查节点是否存在
    const {nodes,inGraph} = state;
    const num_nodes = nodes.length;
    if (nodeId < 0 || nodeId >= num_nodes) {
      return false;
    }
    // 使用反向图结构快速找到所有指向该节点的节点
    const incomingNodes = inGraph[nodeId];
    // 从所有指向该节点的邻居中移除连接
    
    for (const neighborId of incomingNodes) {
      if (neighborId < num_nodes) {
        const neighbor = nodes[neighborId];
        // 从邻居的出边列表中移除该节点
        neighbor.neighbors = neighbor.neighbors.filter(id => id !== nodeId);
      }
    }
    
    // 同时从所有节点的邻居列表中移除该节点（确保完整性）
    for (let i = 0; i < state.nodes.length; i++) {
      if (i !== nodeId && !state.nodes[i].data.deleted) {
        state.nodes[i].neighbors = state.nodes[i].neighbors.filter(id => id !== nodeId);
      }
    }
    
    // 清空该节点的反向图记录
    state.inGraph[nodeId] = [];
    
    // 标记节点为已删除（软删除，保持索引一致性）
    state.nodes[nodeId] = {
      ...state.nodes[nodeId],
      vector: new Float32Array(0), // 清空向量
      neighbors: [], // 清空邻居
      data: { deleted: true } // 标记为已删除
    };
    
    // 如果删除的是medoid，需要重新计算
    if (state.medoidId === nodeId) {
      // 找到第一个未删除的节点作为临时medoid
      let newMedoidId = -1;
      for (let i = 0; i < state.nodes.length; i++) {
        if (!state.nodes[i].data.deleted) {
          newMedoidId = i;
          break;
        }
      }
      state.medoidId = newMedoidId;
    }
    
    return true;
  }
  