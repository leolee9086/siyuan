/**
 * 面包屑模块类型定义
 */
/** 用途：RecordMedia 录音器类型。使用范围：面包屑录音器上下文类型依赖。解耦评估：通过同目录网关导入可降低路径耦合。 */
import type { RecordMedia } from "../util/RecordMedia";

/**
 * 录音器上下文，用于在菜单中处理录音逻辑
 */
export interface 录音器上下文 {
    mediaRecorder: RecordMedia | undefined;
    messageId: string;
    startRecord: (protyle: IProtyle) => void;
    setMediaRecorder: (recorder: RecordMedia) => void;
    setMessageId: (id: string) => void;
}

/**
 * 面包屑点击事件上下文
 * 包含处理点击事件所需的所有依赖
 */
export interface 面包屑点击上下文 {
    /** 事件对象 */
    event: MouseEvent;
    /** 当前点击的目标元素（支持 HTML 和 SVG 元素） */
    target: HTMLElement | SVGElement;
    /** Protyle 实例 */
    protyle: IProtyle;
    /** Breadcrumb 实例引用（用于调用实例方法） */
    breadcrumb: {
        genMobileMenu: (protyle: IProtyle) => void;
        showMenu: (protyle: IProtyle, position: IPosition) => void;
    };
}

/**
 * 面包屑点击处理器函数类型
 * 返回 true 表示已处理事件，应停止冒泡
 */
export type 面包屑点击处理器 = (ctx: 面包屑点击上下文) => boolean;
