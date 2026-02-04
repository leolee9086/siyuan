/**
 * 找到数据集的入口点（medoid）- 复现C++ calculate_entry_point方法
 * 通过计算质心并找到距离质心最近的节点
 */
import {  computeDistance } from '../distance';
import { calculateSqNorm } from '../utils/norms';
import { findCentroid } from '../utils/centroid';
import type { VamanaNode } from '../types';

export function findMedoid(
    nodes: VamanaNode[],
  ): number {
    if (nodes.length === 0) {
      throw new Error('Cannot find medoid for an empty set of nodes.');
    }
    if (nodes.length === 1) {
      return 0;
    }
  
    const dim = nodes[0].vector.length;
    const nodeCount = nodes.length;
    const centroid = findCentroid(nodes,dim,nodeCount);
  
    // 2. 找到距离质心最近的节点
    let minDistance = Infinity;
    let medoidId = 0;
  
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];
      // 计算节点到质心的距离
      const distance = computeDistance(
        centroid,
        node.vector,
        { distanceFunction: 'euclidean' }, // 强制使用欧几里得距离
        calculateSqNorm(centroid), // 预计算质心的平方范数
        node.sqNorm // 节点本身的平方范数已预计算
      );
      if (distance < minDistance) {
        minDistance = distance;
        medoidId = i;
      }
    }
    return medoidId;
  }
  
  