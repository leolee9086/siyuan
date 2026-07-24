/** 用途：Node 测试注册器；使用范围：同目录契约测试；解耦评估：仅测试依赖，不进入业务实现。 */
import {describe, it} from "node:test";
/** 用途：Node 严格断言；使用范围：同目录契约测试；解耦评估：仅测试依赖，不进入业务实现。 */
import * as assert from "node:assert/strict";

/** 同目录窗口 hash 契约测试所需的严格断言。 */
export {assert};
/** 同目录窗口 hash 契约测试所需的套件注册器。 */
export {describe};
/** 同目录窗口 hash 契约测试所需的用例注册器。 */
export {it};
