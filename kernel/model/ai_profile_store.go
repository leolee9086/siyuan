package model

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/siyuan-note/siyuan/kernel/conf"
	_ "github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type Profile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Label    string `json:"label"`
	Version  int    `json:"version"`
	Enabled  bool   `json:"enabled"`

	Provider  string `json:"provider"`
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl"`
	APIProxy  string `json:"apiProxy"`
	APIVersion string `json:"apiVersion"`

	CustomHeaders string `json:"customHeaders"`

	TimeoutMs     int `json:"timeoutMs"`
	MaxRetries    int `json:"maxRetries"`
	RetryOnStatus string `json:"retryOnStatus"`

	RateLimitRPM int `json:"rateLimitRpm"`
	RateLimitTPM int `json:"rateLimitTpm"`

	MaxContexts int    `json:"maxContexts"`
	UserAgent   string `json:"userAgent"`

	Model           string  `json:"model"`
	MaxTokens       int     `json:"maxTokens"`
	Temperature     float64 `json:"temperature"`
	TopP            float64 `json:"topP"`
	TopK            int     `json:"topK"`
	PresencePenalty float64 `json:"presencePenalty"`
	FrequencyPenalty float64 `json:"frequencyPenalty"`
	StopSequences   string  `json:"stopSequences"`
	ResponseFormat  string  `json:"responseFormat"`

	ScheduleCron    string `json:"scheduleCron"`
	ScheduleTarget  string `json:"scheduleTarget"`

	Priority          int   `json:"priority"`
	ErrorCount        int   `json:"errorCount"`
	ConsecutiveErrors int   `json:"consecutiveErrors"`
	AutoDisableAt     int   `json:"autoDisableAt"`
	LastOKAt          int64 `json:"lastOkAt"`
	LastErrorAt       int64 `json:"lastErrorAt"`
	LastErrorMsg      string `json:"lastErrorMsg"`

	ExtraJSON string `json:"extraJson"`

	TotalRequests        int64 `json:"totalRequests"`
	TotalPromptTokens    int64 `json:"totalPromptTokens"`
	TotalCompletionTokens int64 `json:"totalCompletionTokens"`

	Models []ProfileModel `json:"models,omitempty"`

	CreatedAt int64 `json:"createdAt"`
	UpdatedAt int64 `json:"updatedAt"`
}

type ProfileModel struct {
	ID        string `json:"id"`
	ProfileID string `json:"profileId"`
	Model     string `json:"model"`

	Capabilities string `json:"capabilities"`
	SendAs       string `json:"sendAs"`
	Priority     int    `json:"priority"`

	MaxTokens       *int     `json:"maxTokens,omitempty"`
	Temperature     *float64 `json:"temperature,omitempty"`
	TopP            *float64 `json:"topP,omitempty"`
	TopK            *int     `json:"topK,omitempty"`
	PresencePenalty *float64 `json:"presencePenalty,omitempty"`
	FrequencyPenalty *float64 `json:"frequencyPenalty,omitempty"`

	RateLimitRPM int   `json:"rateLimitRpm"`
	RateLimitTPM int   `json:"rateLimitTpm"`

	Enabled    bool  `json:"enabled"`
	TotalCalls int64 `json:"totalCalls"`
	TotalErrors int64 `json:"totalErrors"`
	LastUsedAt int64 `json:"lastUsedAt"`
}

type ProfileStore struct {
	mu sync.RWMutex
	db *sql.DB
}

var (
	globalProfileStore   *ProfileStore
	globalProfileStoreMu sync.Mutex
)

func InitProfileStore() error {
	globalProfileStoreMu.Lock()
	defer globalProfileStoreMu.Unlock()

	if globalProfileStore != nil {
		return nil
	}

	dbPath := filepath.Join(util.ConfDir, "s-forge-ai-profiles.db")
	util.LogDatabaseSize(dbPath)

	dsn := dbPath + "?_journal_mode=WAL" +
		"&_synchronous=OFF" +
		"&_mmap_size=2684354560" +
		"&_secure_delete=OFF" +
		"&_cache_size=-20480" +
		"&_page_size=32768" +
		"&_busy_timeout=7000" +
		"&_ignore_check_constraints=ON" +
		"&_temp_store=MEMORY" +
		"&_case_sensitive_like=OFF"

	db, err := sql.Open("sqlite3_extended", dsn)
	if err != nil {
		return fmt.Errorf("open ai profile database: %w", err)
	}

	db.SetMaxIdleConns(2)
	db.SetMaxOpenConns(2)
	db.SetConnMaxLifetime(365 * 24 * time.Hour)

	store := &ProfileStore{db: db}
	if err := store.createTables(); err != nil {
		db.Close()
		return fmt.Errorf("create ai profile tables: %w", err)
	}

	globalProfileStore = store
	return nil
}

func CloseProfileStore() {
	globalProfileStoreMu.Lock()
	defer globalProfileStoreMu.Unlock()
	if globalProfileStore != nil {
		globalProfileStore.db.Close()
		globalProfileStore = nil
	}
}

func GetProfileStore() *ProfileStore {
	globalProfileStoreMu.Lock()
	defer globalProfileStoreMu.Unlock()
	return globalProfileStore
}

func (s *ProfileStore) createTables() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS ai_profiles (
			id                  TEXT PRIMARY KEY,
			name                TEXT NOT NULL UNIQUE,
			label               TEXT NOT NULL DEFAULT '',
			version             INTEGER NOT NULL DEFAULT 1,
			enabled             INTEGER NOT NULL DEFAULT 1,
			provider            TEXT NOT NULL DEFAULT 'OpenAI',
			api_key             TEXT NOT NULL DEFAULT '',
			base_url            TEXT NOT NULL DEFAULT '',
			api_proxy           TEXT NOT NULL DEFAULT '',
			api_version         TEXT NOT NULL DEFAULT '',
			custom_headers      TEXT NOT NULL DEFAULT '{}',
			timeout_ms          INTEGER NOT NULL DEFAULT 30000,
			max_retries         INTEGER NOT NULL DEFAULT 3,
			retry_on_status     TEXT NOT NULL DEFAULT '[429,500,502,503]',
			rate_limit_rpm      INTEGER NOT NULL DEFAULT 0,
			rate_limit_tpm      INTEGER NOT NULL DEFAULT 0,
			max_contexts        INTEGER NOT NULL DEFAULT 7,
			user_agent          TEXT NOT NULL DEFAULT '',
			model               TEXT NOT NULL DEFAULT '',
			max_tokens          INTEGER NOT NULL DEFAULT 0,
			temperature         REAL NOT NULL DEFAULT 1.0,
			top_p               REAL NOT NULL DEFAULT 1.0,
			top_k               INTEGER NOT NULL DEFAULT 0,
			presence_penalty    REAL NOT NULL DEFAULT 0.0,
			frequency_penalty   REAL NOT NULL DEFAULT 0.0,
			stop_sequences      TEXT NOT NULL DEFAULT '[]',
			response_format     TEXT NOT NULL DEFAULT '',
			schedule_cron       TEXT NOT NULL DEFAULT '',
			schedule_target     TEXT NOT NULL DEFAULT '',
			priority            INTEGER NOT NULL DEFAULT 0,
			error_count         INTEGER NOT NULL DEFAULT 0,
			consecutive_errors  INTEGER NOT NULL DEFAULT 0,
			auto_disable_at     INTEGER NOT NULL DEFAULT 5,
			last_ok_at          INTEGER NOT NULL DEFAULT 0,
			last_error_at       INTEGER NOT NULL DEFAULT 0,
			last_error_msg      TEXT NOT NULL DEFAULT '',
			extra_json          TEXT NOT NULL DEFAULT '{}',
			total_requests      INTEGER NOT NULL DEFAULT 0,
			total_prompt_tokens      INTEGER NOT NULL DEFAULT 0,
			total_completion_tokens  INTEGER NOT NULL DEFAULT 0,
			created_at          INTEGER NOT NULL,
			updated_at          INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ai_profile_models (
			id                  TEXT PRIMARY KEY,
			profile_id          TEXT NOT NULL REFERENCES ai_profiles(id) ON DELETE CASCADE,
			model               TEXT NOT NULL,
			capabilities        TEXT NOT NULL DEFAULT '{}',
			send_as             TEXT NOT NULL DEFAULT '',
			priority            INTEGER NOT NULL DEFAULT 0,
			max_tokens          INTEGER DEFAULT NULL,
			temperature         REAL DEFAULT NULL,
			top_p               REAL DEFAULT NULL,
			top_k               INTEGER DEFAULT NULL,
			presence_penalty    REAL DEFAULT NULL,
			frequency_penalty   REAL DEFAULT NULL,
			rate_limit_rpm      INTEGER NOT NULL DEFAULT 0,
			rate_limit_tpm      INTEGER NOT NULL DEFAULT 0,
			enabled             INTEGER NOT NULL DEFAULT 1,
			total_calls         INTEGER NOT NULL DEFAULT 0,
			total_errors        INTEGER NOT NULL DEFAULT 0,
			last_used_at        INTEGER NOT NULL DEFAULT 0,
			UNIQUE(profile_id, model)
		);

		CREATE TABLE IF NOT EXISTS ai_active_profile (
			row_id      INTEGER PRIMARY KEY CHECK(row_id = 1),
			profile_id  TEXT NOT NULL,
			switched_at INTEGER NOT NULL
		);
	`)
	return err
}

func scanProfile(scanner interface {
	Scan(dest ...interface{}) error
}) (*Profile, error) {
	p := &Profile{}
	var enabled, version int
	var errorCount, consecutiveErrors, autoDisableAt int
	var totalReq, totalPT, totalCT int64
	err := scanner.Scan(
		&p.ID, &p.Name, &p.Label, &version, &enabled,
		&p.Provider, &p.APIKey, &p.BaseURL, &p.APIProxy, &p.APIVersion,
		&p.CustomHeaders,
		&p.TimeoutMs, &p.MaxRetries, &p.RetryOnStatus,
		&p.RateLimitRPM, &p.RateLimitTPM,
		&p.MaxContexts, &p.UserAgent,
		&p.Model, &p.MaxTokens, &p.Temperature,
		&p.TopP, &p.TopK, &p.PresencePenalty, &p.FrequencyPenalty,
		&p.StopSequences, &p.ResponseFormat,
		&p.ScheduleCron, &p.ScheduleTarget,
		&p.Priority, &errorCount, &consecutiveErrors, &autoDisableAt,
		&p.LastOKAt, &p.LastErrorAt, &p.LastErrorMsg,
		&p.ExtraJSON,
		&totalReq, &totalPT, &totalCT,
		&p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	p.Enabled = enabled != 0
	p.Version = version
	p.ErrorCount = errorCount
	p.ConsecutiveErrors = consecutiveErrors
	p.AutoDisableAt = autoDisableAt
	p.TotalRequests = totalReq
	p.TotalPromptTokens = totalPT
	p.TotalCompletionTokens = totalCT
	return p, nil
}

func scanProfileModel(scanner interface {
	Scan(dest ...interface{}) error
}) (*ProfileModel, error) {
	m := &ProfileModel{}
	var enabled int
	var maxToks sql.NullInt64
	var temp sql.NullFloat64
	var topP sql.NullFloat64
	var topK sql.NullInt64
	var pp sql.NullFloat64
	var fp sql.NullFloat64
	err := scanner.Scan(
		&m.ID, &m.ProfileID, &m.Model, &m.Capabilities, &m.SendAs, &m.Priority,
		&maxToks, &temp, &topP, &topK, &pp, &fp,
		&m.RateLimitRPM, &m.RateLimitTPM,
		&enabled, &m.TotalCalls, &m.TotalErrors, &m.LastUsedAt,
	)
	if err != nil {
		return nil, err
	}
	m.Enabled = enabled != 0
	if maxToks.Valid { v := int(maxToks.Int64); m.MaxTokens = &v }
	if temp.Valid { v := temp.Float64; m.Temperature = &v }
	if topP.Valid { v := topP.Float64; m.TopP = &v }
	if topK.Valid { v := int(topK.Int64); m.TopK = &v }
	if pp.Valid { v := pp.Float64; m.PresencePenalty = &v }
	if fp.Valid { v := fp.Float64; m.FrequencyPenalty = &v }
	return m, nil
}

func (s *ProfileStore) List() ([]*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query(`SELECT * FROM ai_profiles ORDER BY priority DESC, name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var profiles []*Profile
	for rows.Next() {
		p, err := scanProfile(rows)
		if err != nil {
			return nil, err
		}
		profiles = append(profiles, p)
	}
	if profiles == nil {
		profiles = []*Profile{}
	}
	return profiles, rows.Err()
}

func (s *ProfileStore) Get(id string) (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	row := s.db.QueryRow(`SELECT * FROM ai_profiles WHERE id = ?`, id)
	p, err := scanProfile(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return p, nil
}

func (s *ProfileStore) GetByName(name string) (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	row := s.db.QueryRow(`SELECT * FROM ai_profiles WHERE name = ?`, name)
	p, err := scanProfile(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return p, nil
}

func (s *ProfileStore) ListModels(profileID string) ([]*ProfileModel, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rows, err := s.db.Query(
		`SELECT * FROM ai_profile_models WHERE profile_id = ? ORDER BY priority DESC`,
		profileID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var models []*ProfileModel
	for rows.Next() {
		m, err := scanProfileModel(rows)
		if err != nil {
			return nil, err
		}
		models = append(models, m)
	}
	if models == nil {
		models = []*ProfileModel{}
	}
	return models, rows.Err()
}

func (s *ProfileStore) Upsert(p *Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixMilli()
	if p.ID == "" {
		p.ID = uuid.New().String()
		p.CreatedAt = now
	}
	p.UpdatedAt = now
	p.Version++

	enabled := 0
	if p.Enabled {
		enabled = 1
	}

	_, err := s.db.Exec(`
		INSERT INTO ai_profiles (
			id, name, label, version, enabled,
			provider, api_key, base_url, api_proxy, api_version,
			custom_headers,
			timeout_ms, max_retries, retry_on_status,
			rate_limit_rpm, rate_limit_tpm,
			max_contexts, user_agent,
			model, max_tokens, temperature,
			top_p, top_k, presence_penalty, frequency_penalty,
			stop_sequences, response_format,
			schedule_cron, schedule_target,
			priority, error_count, consecutive_errors, auto_disable_at,
			last_ok_at, last_error_at, last_error_msg,
			extra_json,
			total_requests, total_prompt_tokens, total_completion_tokens,
			created_at, updated_at
		) VALUES (?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?, ?,?, ?,?, ?,?,?,?, ?,?,?, ?, ?,?,?, ?,?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, label=excluded.label, version=excluded.version,
			enabled=excluded.enabled,
			provider=excluded.provider, api_key=excluded.api_key,
			base_url=excluded.base_url, api_proxy=excluded.api_proxy,
			api_version=excluded.api_version,
			custom_headers=excluded.custom_headers,
			timeout_ms=excluded.timeout_ms, max_retries=excluded.max_retries,
			retry_on_status=excluded.retry_on_status,
			rate_limit_rpm=excluded.rate_limit_rpm,
			rate_limit_tpm=excluded.rate_limit_tpm,
			max_contexts=excluded.max_contexts,
			user_agent=excluded.user_agent,
			model=excluded.model, max_tokens=excluded.max_tokens,
			temperature=excluded.temperature,
			top_p=excluded.top_p, top_k=excluded.top_k,
			presence_penalty=excluded.presence_penalty,
			frequency_penalty=excluded.frequency_penalty,
			stop_sequences=excluded.stop_sequences,
			response_format=excluded.response_format,
			schedule_cron=excluded.schedule_cron,
			schedule_target=excluded.schedule_target,
			priority=excluded.priority,
			error_count=excluded.error_count,
			consecutive_errors=excluded.consecutive_errors,
			auto_disable_at=excluded.auto_disable_at,
			last_ok_at=excluded.last_ok_at,
			last_error_at=excluded.last_error_at,
			last_error_msg=excluded.last_error_msg,
			extra_json=excluded.extra_json,
			total_requests=excluded.total_requests,
			total_prompt_tokens=excluded.total_prompt_tokens,
			total_completion_tokens=excluded.total_completion_tokens,
			updated_at=excluded.updated_at
	`,
		p.ID, p.Name, p.Label, p.Version, enabled,
		p.Provider, p.APIKey, p.BaseURL, p.APIProxy, p.APIVersion,
		p.CustomHeaders,
		p.TimeoutMs, p.MaxRetries, p.RetryOnStatus,
		p.RateLimitRPM, p.RateLimitTPM,
		p.MaxContexts, p.UserAgent,
		p.Model, p.MaxTokens, p.Temperature,
		p.TopP, p.TopK, p.PresencePenalty, p.FrequencyPenalty,
		p.StopSequences, p.ResponseFormat,
		p.ScheduleCron, p.ScheduleTarget,
		p.Priority, p.ErrorCount, p.ConsecutiveErrors, p.AutoDisableAt,
		p.LastOKAt, p.LastErrorAt, p.LastErrorMsg,
		p.ExtraJSON,
		p.TotalRequests, p.TotalPromptTokens, p.TotalCompletionTokens,
		p.CreatedAt, p.UpdatedAt,
	)
	if err != nil {
		return err
	}

	if err := s.replaceModels(p.ID, p.Models); err != nil {
		return fmt.Errorf("replace models: %w", err)
	}

	return nil
}

func (s *ProfileStore) replaceModels(profileID string, models []ProfileModel) error {
	if _, err := s.db.Exec(`DELETE FROM ai_profile_models WHERE profile_id = ?`, profileID); err != nil {
		return err
	}
	for i := range models {
		m := &models[i]
		if m.ID == "" {
			m.ID = uuid.New().String()
		}
		m.ProfileID = profileID
		enabled := 0
		if m.Enabled {
			enabled = 1
		}
		_, err := s.db.Exec(`
			INSERT INTO ai_profile_models (
				id, profile_id, model, capabilities, send_as, priority,
				max_tokens, temperature, top_p, top_k,
				presence_penalty, frequency_penalty,
				rate_limit_rpm, rate_limit_tpm,
				enabled, total_calls, total_errors, last_used_at
			) VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?, ?,?, ?,?,?,?)
		`,
			m.ID, profileID, m.Model, m.Capabilities, m.SendAs, m.Priority,
			m.MaxTokens, m.Temperature, m.TopP, m.TopK,
			m.PresencePenalty, m.FrequencyPenalty,
			m.RateLimitRPM, m.RateLimitTPM,
			enabled, m.TotalCalls, m.TotalErrors, m.LastUsedAt,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *ProfileStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec(`DELETE FROM ai_profiles WHERE id = ?`, id)
	return err
}

func (s *ProfileStore) GetActive() (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	row := s.db.QueryRow(`
		SELECT p.* FROM ai_profiles p
		INNER JOIN ai_active_profile a ON a.profile_id = p.id
		WHERE a.row_id = 1
	`)
	p, err := scanProfile(row)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return p, nil
}

func (s *ProfileStore) SetActive(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec(`
		INSERT INTO ai_active_profile (row_id, profile_id, switched_at)
		VALUES (1, ?, ?)
		ON CONFLICT(row_id) DO UPDATE SET profile_id=excluded.profile_id, switched_at=excluded.switched_at
	`, id, time.Now().UnixMilli())
	return err
}

func SyncActiveProfileToConf() {
	store := GetProfileStore()
	if store == nil {
		return
	}
	p, err := store.GetActive()
	if err != nil || p == nil {
		return
	}
	SyncProfileToConf(p)
}

func SyncProfileToConf(p *Profile) {
	if Conf == nil || Conf.AI == nil || Conf.AI.OpenAI == nil {
		return
	}

	sleepStart := Conf.AI.OpenAI.MAGISleepStartHour
	sleepEnd := Conf.AI.OpenAI.MAGISleepEndHour

	Conf.AI.OpenAI = &conf.OpenAI{
		APIKey:         p.APIKey,
		APIProvider:    p.Provider,
		APIBaseURL:     p.BaseURL,
		APIProxy:       p.APIProxy,
		APIModel:       p.Model,
		APIMaxTokens:   p.MaxTokens,
		APITemperature: p.Temperature,
		APITimeout:     p.TimeoutMs / 1000,
		APIVersion:     p.APIVersion,
		APIMaxContexts: p.MaxContexts,
		APIUserAgent:   p.UserAgent,

		MAGISleepStartHour: sleepStart,
		MAGISleepEndHour:   sleepEnd,
	}
	Conf.Save()
}

func MigrateFromConf() error {
	store := GetProfileStore()
	if store == nil {
		return fmt.Errorf("profile store not initialized")
	}

	active, err := store.GetActive()
	if err != nil {
		return err
	}
	if active != nil {
		return nil
	}

	profiles, err := store.List()
	if err != nil {
		return err
	}
	if len(profiles) > 0 {
		return nil
	}

	if Conf == nil || Conf.AI == nil || Conf.AI.OpenAI == nil {
		return nil
	}
	oc := Conf.AI.OpenAI
	if oc.APIKey == "" && oc.APIBaseURL == "https://api.openai.com/v1" {
		return nil
	}

	now := time.Now().UnixMilli()
	p := &Profile{
		ID:        uuid.New().String(),
		Name:      "default",
		Label:     "Default",
		Version:   1,
		Enabled:   true,
		Provider:  oc.APIProvider,
		APIKey:    oc.APIKey,
		BaseURL:   oc.APIBaseURL,
		APIProxy:  oc.APIProxy,
		APIVersion: oc.APIVersion,
		TimeoutMs: oc.APITimeout * 1000,
		MaxRetries: 3,
		RetryOnStatus: "[429,500,502,503]",
		MaxContexts: oc.APIMaxContexts,
		UserAgent: oc.APIUserAgent,
		Model:     oc.APIModel,
		MaxTokens: oc.APIMaxTokens,
		Temperature: oc.APITemperature,
		TopP:     1.0,
		TopK:     0,
		PresencePenalty:  0,
		FrequencyPenalty: 0,
		StopSequences: "[]",
		ResponseFormat: "",
		Priority: 0,
		AutoDisableAt: 5,
		ExtraJSON: "{}",
		CreatedAt: now,
		UpdatedAt: now,
		Models: []ProfileModel{
			{
				ID:           uuid.New().String(),
				Model:        oc.APIModel,
				Capabilities: `{"modalities":["text"],"supports_tools":true}`,
				Enabled:      true,
			},
		},
	}

	if err := store.Upsert(p); err != nil {
		return fmt.Errorf("migrate: create default profile: %w", err)
	}
	if err := store.SetActive(p.ID); err != nil {
		return fmt.Errorf("migrate: set active: %w", err)
	}
	SyncProfileToConf(p)
	return nil
}


