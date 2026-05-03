# AI Profiles Schema Design

## Core Tables

### ai_profiles — AI service endpoint

```sql
CREATE TABLE ai_profiles (
    -- Identity
    id       TEXT PRIMARY KEY,              -- UUIDv7 (time-ordered)
    name     TEXT NOT NULL UNIQUE,           -- CLI/API 引用名: "gpt4-team", "claude-pro"
    label    TEXT NOT NULL DEFAULT '',        -- 显示名: "GPT-4 主力"
    version  INTEGER NOT NULL DEFAULT 1,      -- 乐观锁，用于并发更新检测

    -- Service type & connection
    provider TEXT NOT NULL DEFAULT 'OpenAI',  -- "OpenAI" | "Azure" | "Claude" | "Ollama" | ...
    api_key  TEXT NOT NULL DEFAULT '',
    base_url TEXT NOT NULL DEFAULT '',
    api_proxy TEXT NOT NULL DEFAULT '',
    api_version TEXT NOT NULL DEFAULT '',
    custom_headers TEXT NOT NULL DEFAULT '{}', -- JSON object: {"X-Api-Key": "..."}

    -- Operational parameters
    timeout_ms      INTEGER NOT NULL DEFAULT 30000,
    max_retries     INTEGER NOT NULL DEFAULT 3,
    retry_on_status TEXT NOT NULL DEFAULT '[429,500,502,503]', -- JSON array

    -- Client-side rate limiting (RPM = requests per minute, TPM = tokens per minute)
    rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
    rate_limit_tpm INTEGER NOT NULL DEFAULT 0,

    -- conf.OpenAI all fields (for 1:1 sync, see SyncToConf)
    -- Connection (conf.OpenAI direct mapping)
    max_contexts   INTEGER NOT NULL DEFAULT 7,    -- conf.OpenAI.APIMaxContexts
    user_agent     TEXT NOT NULL DEFAULT '',       -- conf.OpenAI.APIUserAgent

    -- Default model parameters (per-model override in ai_profile_models)
    model       TEXT NOT NULL DEFAULT '',
    max_tokens  INTEGER NOT NULL DEFAULT 0,
    temperature REAL NOT NULL DEFAULT 1.0,
    top_p       REAL NOT NULL DEFAULT 1.0,
    top_k       INTEGER NOT NULL DEFAULT 0,
    presence_penalty  REAL NOT NULL DEFAULT 0.0,
    frequency_penalty REAL NOT NULL DEFAULT 0.0,
    stop_sequences    TEXT NOT NULL DEFAULT '[]',      -- JSON array
    response_format   TEXT NOT NULL DEFAULT '',          -- "json_object" | "text" | "json_schema"

    -- Scheduling: which profile to use at different times (for cost optimization)
    schedule_cron   TEXT NOT NULL DEFAULT '',  -- cron expression for auto-switch
    schedule_target TEXT NOT NULL DEFAULT '',  -- target profile name when cron fires

    -- Health & auto-recovery
    enabled           INTEGER NOT NULL DEFAULT 1,
    priority          INTEGER NOT NULL DEFAULT 0,
    error_count       INTEGER NOT NULL DEFAULT 0,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    auto_disable_at   INTEGER NOT NULL DEFAULT 5,
    last_ok_at        INTEGER NOT NULL DEFAULT 0,
    last_error_at     INTEGER NOT NULL DEFAULT 0,
    last_error_msg    TEXT NOT NULL DEFAULT '',

    -- Provider-specific extensions (Azure region, Anthropic version, Ollama model path...)
    extra_json TEXT NOT NULL DEFAULT '{}',

    -- Request tracking
    total_requests  INTEGER NOT NULL DEFAULT 0,
    total_prompt_tokens  INTEGER NOT NULL DEFAULT 0,
    total_completion_tokens INTEGER NOT NULL DEFAULT 0,

    -- Versioning
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### ai_profile_models — Model catalog with capabilities

```sql
CREATE TABLE ai_profile_models (
    id         TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,

    model      TEXT NOT NULL,                -- "gpt-4o", "claude-3-opus-20240229"

    -- Capabilities: extensible JSON, NOT frozen schema
    -- {
    --   "modalities": ["text","image","audio"],
    --   "max_context": 128000,
    --   "max_output": 16384,
    --   "supports_tools": true,
    --   "supports_stream": true,
    --   "supports_vision": true,
    --   "supports_structured_output": true,
    --   "pricing": {"input_per_token": 2.5e-6, "output_per_token": 1e-5},
    --   "supports_parallel_tool_calls": true
    -- }
    capabilities TEXT NOT NULL DEFAULT '{}',

    -- Routing: rename on the wire (one-api model_mapping)
    send_as    TEXT NOT NULL DEFAULT '',

    -- Within-profile priority (higher = preferred)
    priority INTEGER NOT NULL DEFAULT 0,

    -- Per-model parameter overrides
    max_tokens   INTEGER DEFAULT NULL,
    temperature  REAL    DEFAULT NULL,
    top_p        REAL    DEFAULT NULL,
    top_k        INTEGER DEFAULT NULL,
    presence_penalty  REAL DEFAULT NULL,
    frequency_penalty REAL DEFAULT NULL,

    -- Per-model rate limits (0 = inherit from profile)
    rate_limit_rpm INTEGER NOT NULL DEFAULT 0,
    rate_limit_tpm INTEGER NOT NULL DEFAULT 0,

    -- Per-model health
    enabled      INTEGER NOT NULL DEFAULT 1,
    total_calls  INTEGER NOT NULL DEFAULT 0,
    total_errors INTEGER NOT NULL DEFAULT 0,
    last_used_at INTEGER NOT NULL DEFAULT 0,

    UNIQUE(profile_id, model)
);
```

### ai_active_profile — Active preference pointer

```sql
CREATE TABLE ai_active_profile (
    row_id      INTEGER PRIMARY KEY CHECK(row_id = 1),
    profile_id  TEXT NOT NULL,
    switched_at INTEGER NOT NULL
);
```

---

## Future Extension Tables (schema open, no migration needed to add)

These exist as SQL comments, unblocked by the base schema.

```sql
-- -- ai_agent_profile: Per-agent profile routing
-- CREATE TABLE ai_agent_profile (
--     agent_name  TEXT PRIMARY KEY,           -- "melchior" | "balthazar" | "casper"
--     profile_id  TEXT NOT NULL,
--     model       TEXT NOT NULL DEFAULT '',
--     priority    INTEGER NOT NULL DEFAULT 0
-- );

-- -- ai_request_log: Debugging & analytics
-- CREATE TABLE ai_request_log (
--     id          TEXT PRIMARY KEY,
--     profile_id  TEXT NOT NULL,
--     model       TEXT NOT NULL,
--     agent_name  TEXT NOT NULL DEFAULT '',
--     prompt_tokens   INTEGER NOT NULL DEFAULT 0,
--     completion_tokens INTEGER NOT NULL DEFAULT 0,
--     duration_ms INTEGER NOT NULL DEFAULT 0,
--     success     INTEGER NOT NULL DEFAULT 1,
--     error_msg   TEXT NOT NULL DEFAULT '',
--     created_at  INTEGER NOT NULL
-- );
```

---

## SyncToConf — conf.json compatibility

```go
// SyncToConf copies this profile into model.Conf.AI.OpenAI (1:1 field mapping).
// Vanilla SiYuan sees a valid conf.json and works normally.
// All fields map directly — nothing is lost or stitched from defaults.
func (p *Profile) SyncToConf() {
    model.Conf.AI.OpenAI = &conf.OpenAI{
        APIKey:            p.APIKey,
        APIProvider:       p.Provider,
        APIBaseURL:        p.BaseURL,
        APIProxy:          p.APIProxy,
        APIModel:          p.Model,
        APIMaxTokens:      p.MaxTokens,
        APITemperature:    p.Temperature,
        APITimeout:        p.TimeoutMs / 1000,   // ms → sec
        APIVersion:        p.APIVersion,
        APIMaxContexts:    p.MaxContexts,
        APIUserAgent:      p.UserAgent,
        MAGISleepStartHour: model.Conf.AI.OpenAI.MAGISleepStartHour, // system-wide, not per-profile
        MAGISleepEndHour:   model.Conf.AI.OpenAI.MAGISleepEndHour,
    }
    model.Conf.Save()
}
```

`sleep_start_hour` / `sleep_end_hour` 是 MAGI 系统级行为参数（影响所有 agent 的休眠时段），不跟随 profile 切换。它们只存在于 `conf.json`，由 `model.Conf.AI.OpenAI` 持有。需要修改时走现有 `POST /api/setting/setAI` 接口。

## Design Rationale

### Capabilities as JSON, not columns

```json
// gpt-4o
{"modalities":["text","image","audio"], "max_context":128000, "supports_tools":true}
// whisper-1
{"modalities":["audio"], "supports_tools":false, "pricing":{"input_per_token":6e-6}}
// text-embedding-3-small
{"modalities":["embedding"], "dimensions":1536, "pricing":{"input_per_token":2e-8}}
```

不同模型的能力集天然异构。embedding 模型有 `dimensions`，语音模型有 `languages`，代码模型有 `supports_execution`。用列来建模会让 schema 膨胀成一个稀疏矩阵。JSON 允许每行只描述相关能力，不相关的字段不存在即可。

### Why `total_requests` / `total_prompt_tokens` on profiles

这些计数器不需要单独的日志表来支撑核心功能。profile 行本身就能回答"这个月用了多少 token"——这在切换配置、评估成本时是即时需求。详细的请求日志是未来 `ai_request_log` 表的职责。

### Schedule fields on profiles

`schedule_cron` + `schedule_target` 允许 profile 自带定时切换规则。例如：
- 工作日 9-18 点用 gpt-4o（高性能）
- 夜间用 gpt-4o-mini（低成本）
- 这一规则跟随 profile 定义，不依赖外部调度器

### Version field for optimistic locking

当 CLI 和管理 UI 并发操作时，`version` 允许 CAS（compare-and-swap）更新而不会互相覆盖。

### UUIDv7 for id

UUIDv7 按时间排序，SQLite 的 B-tree 索引效率与自增 int 接近。比自增 int 的好处：合并多个数据源时不会冲突。
