/*
 * Copyright (c) 2024, SiYuan Community
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * This file is part of SiYuan.
 */

/** 唯一符号厂牌，用于区分几何数组类型 */
declare const PointBrand: unique symbol;
/** 唯一符号厂牌，用于区分几何数组类型 */
declare const RectBrand: unique symbol;
/** 唯一符号厂牌，用于区分几何数组类型 */
declare const BoundingRectBrand: unique symbol;

/** 二维空间中的点坐标，使用数组形式以支持未来 SIMD/WebAssembly 优化 */
export type Point = [x: number, y: number] & { [PointBrand]: true };

/**
 * 矩形区域 [left, top, width, height]，用于 UI 定位
 * 数组形式支持连续内存布局和未来 SIMD 优化
 */
export type Rect = [left: number, top: number, width: number, height: number] & { [RectBrand]: true };

/**
 * 矩形边界形式 [left, top, right, bottom]，用于钳制/碰撞计算
 * 数组形式支持连续内存布局和未来 SIMD 优化
 */
export type BoundingRect = [left: number, top: number, right: number, bottom: number] & { [BoundingRectBrand]: true };
