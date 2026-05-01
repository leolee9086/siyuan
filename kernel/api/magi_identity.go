package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
	"golang.org/x/crypto/bcrypt"
)

const (
	magiRouteClassGuardian   = "guardian"
	magiRouteClassAvatarOnly = "avatar-only"

	magiRequestChannelMainUI        = "magi-main-ui"
	magiRequestChannelToolClaude    = "tool-claude-code"
	magiRequestChannelToolOpenAI    = "tool-openai-sdk"
	magiRequestChannelToolAnthropic = "tool-claude-sdk"
	magiRequestChannelToolCustom    = "tool-custom"
	magiRequestChannelSystemCron    = "system-cron"

	magiArmorTokenPrefix = "magi_ak_v1_"
	magiBindCodePrefix   = "MB-"
	magiBindCodeTTL      = 5 * time.Minute
	magiBindCodeLen      = 6
)

var (
	errMagiIdentityNotFound = errors.New("magi identity not found")
	errMagiIdentityDisabled = errors.New("magi identity is disabled")
)

type magiBindCodeEntry struct {
	IdentityID string
	ExpiresAt  time.Time
}

var magiBindCodeStore = struct {
	mu    sync.Mutex
	codes map[string]magiBindCodeEntry
}{codes: make(map[string]magiBindCodeEntry)}

func generateBindCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, magiBindCodeLen)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func storeBindCode(identityID string) string {
	magiBindCodeStore.mu.Lock()
	defer magiBindCodeStore.mu.Unlock()

	// 清理过期
	now := time.Now()
	for code, entry := range magiBindCodeStore.codes {
		if now.After(entry.ExpiresAt) {
			delete(magiBindCodeStore.codes, code)
		}
	}

	// 为该身份撤回旧码
	for code, entry := range magiBindCodeStore.codes {
		if entry.IdentityID == identityID {
			delete(magiBindCodeStore.codes, code)
		}
	}

	// 生成唯一码
	var code string
	for i := 0; i < 20; i++ {
		code = generateBindCode()
		if _, exists := magiBindCodeStore.codes[code]; !exists {
			break
		}
	}

	magiBindCodeStore.codes[code] = magiBindCodeEntry{
		IdentityID: identityID,
		ExpiresAt:  now.Add(magiBindCodeTTL),
	}
	return magiBindCodePrefix + code
}

func consumeBindCode(code string) (identityID string, ok bool) {
	magiBindCodeStore.mu.Lock()
	defer magiBindCodeStore.mu.Unlock()

	entry, exists := magiBindCodeStore.codes[code]
	if !exists {
		return "", false
	}
	if time.Now().After(entry.ExpiresAt) {
		delete(magiBindCodeStore.codes, code)
		return "", false
	}
	delete(magiBindCodeStore.codes, code)
	return entry.IdentityID, true
}

type magiIdentityRecord struct {
	IdentityID          string            `json:"identityId"`
	DisplayName         string            `json:"displayName"`
	Nickname            string            `json:"nickname"`
	PasswordHash        string            `json:"passwordHash"`
	RouteClass          string            `json:"routeClass"`
	Enabled             bool              `json:"enabled"`
	CreatedAt           int64             `json:"createdAt"`
	UpdatedAt           int64             `json:"updatedAt"`
	TokenExpiresSeconds int64             `json:"tokenExpiresSeconds,omitempty"`
	UsageCount          int64             `json:"usageCount,omitempty"`
	ChannelBindings     []channelBinding  `json:"channelBindings,omitempty"`
}

type channelBinding struct {
	ChannelID string `json:"channelId"`
	AccountID string `json:"accountId"`
	UserID    string `json:"userId"`
}

type magiIdentityStoreFile struct {
	Version    int                  `json:"version"`
	Identities []magiIdentityRecord `json:"identities"`
}

type magiIdentityStore struct {
	mu     sync.RWMutex
	path   string
	loaded bool
	items  map[string]magiIdentityRecord
}

type magiIdentityView struct {
	IdentityID          string           `json:"identityId"`
	DisplayName         string           `json:"displayName"`
	Nickname            string           `json:"nickname,omitempty"`
	RouteClass          string           `json:"routeClass"`
	Enabled             bool             `json:"enabled"`
	CreatedAt           int64            `json:"createdAt"`
	UpdatedAt           int64            `json:"updatedAt"`
	TokenExpiresSeconds int64            `json:"tokenExpiresSeconds,omitempty"`
	UsageCount          int64            `json:"usageCount,omitempty"`
	ChannelBindings     []channelBinding `json:"channelBindings,omitempty"`
}

type magiArmorClaimsV1 struct {
	Sub string `json:"sub"`
	Chn string `json:"chn"`
	Ws  string `json:"ws"`
	Rtc string `json:"rtc"`
	Nck string `json:"nck,omitempty"`
	Doc string `json:"doc,omitempty"`
	Iat int64  `json:"iat"`
	Exp int64  `json:"exp"`
	Jti string `json:"jti"`
}

var globalMagiIdentityStore = &magiIdentityStore{}

func magiIdentityStorePath() string {
	return filepath.Join(util.ConfDir, "magi-identities.json")
}

func (s *magiIdentityStore) ensureLoaded() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := magiIdentityStorePath()
	if s.loaded && s.path == path {
		return nil
	}

	s.path = path
	s.items = map[string]magiIdentityRecord{}
	s.loaded = true

	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var fileData magiIdentityStoreFile
	if err = json.Unmarshal(raw, &fileData); err != nil {
		return err
	}
	for _, item := range fileData.Identities {
		identityID := strings.TrimSpace(item.IdentityID)
		if identityID == "" {
			continue
		}
		s.items[identityID] = item
	}
	return nil
}

func (s *magiIdentityStore) saveLocked() error {
	if s.path == "" {
		s.path = magiIdentityStorePath()
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0755); err != nil {
		return err
	}

	identities := make([]magiIdentityRecord, 0, len(s.items))
	for _, item := range s.items {
		identities = append(identities, item)
	}
	sort.SliceStable(identities, func(i, j int) bool {
		return identities[i].IdentityID < identities[j].IdentityID
	})

	fileData := magiIdentityStoreFile{
		Version:    1,
		Identities: identities,
	}
	raw, err := json.MarshalIndent(fileData, "", "  ")
	if err != nil {
		return err
	}

	tmpPath := s.path + ".tmp"
	if err = os.WriteFile(tmpPath, raw, 0600); err != nil {
		return err
	}
	return os.Rename(tmpPath, s.path)
}

func (s *magiIdentityStore) listViews() ([]magiIdentityView, error) {
	if err := s.ensureLoaded(); err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	ret := make([]magiIdentityView, 0, len(s.items))
	for _, item := range s.items {
		ret = append(ret, magiIdentityView{
			IdentityID:          item.IdentityID,
			DisplayName:         item.DisplayName,
			Nickname:            item.Nickname,
			RouteClass:          item.RouteClass,
			Enabled:             item.Enabled,
			CreatedAt:           item.CreatedAt,
			UpdatedAt:           item.UpdatedAt,
			TokenExpiresSeconds: item.TokenExpiresSeconds,
			UsageCount:          item.UsageCount,
			ChannelBindings:     copyChannelBindings(item.ChannelBindings),
		})
	}
	sort.SliceStable(ret, func(i, j int) bool {
		return ret[i].IdentityID < ret[j].IdentityID
	})
	return ret, nil
}

func (s *magiIdentityStore) get(identityID string) (*magiIdentityRecord, error) {
	if err := s.ensureLoaded(); err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	item, ok := s.items[identityID]
	if !ok {
		return nil, errMagiIdentityNotFound
	}
	copyItem := item
	return &copyItem, nil
}

func (s *magiIdentityStore) upsert(identityID, displayName, nickname, password, routeClass string, enabled bool, tokenExpiresSeconds int64, bindings []channelBinding) (*magiIdentityRecord, error) {
	if err := s.ensureLoaded(); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixMilli()
	identity, exists := s.items[identityID]
	if !exists {
		needsPassword := routeClass == magiRouteClassGuardian
		if strings.TrimSpace(password) == "" && needsPassword {
			return nil, errors.New("password is required for new guardian identity")
		}
		var hash string
		if strings.TrimSpace(password) != "" {
			var err error
			hash, err = hashMagiIdentityPassword(password)
			if err != nil {
				return nil, err
			}
		}
		identity = magiIdentityRecord{
			IdentityID:          identityID,
			DisplayName:         displayName,
			Nickname:            nickname,
			PasswordHash:        hash,
			RouteClass:          routeClass,
			Enabled:             enabled,
			CreatedAt:           now,
			UpdatedAt:           now,
			TokenExpiresSeconds: tokenExpiresSeconds,
			ChannelBindings:     normalizeChannelBindings(bindings),
		}
	} else {
		identity.DisplayName = displayName
		identity.Nickname = nickname
		identity.RouteClass = routeClass
		identity.Enabled = enabled
		identity.UpdatedAt = now
		if tokenExpiresSeconds > 0 {
			identity.TokenExpiresSeconds = tokenExpiresSeconds
		}
		if strings.TrimSpace(password) != "" {
			hash, err := hashMagiIdentityPassword(password)
			if err != nil {
				return nil, err
			}
			identity.PasswordHash = hash
		}
		if bindings != nil || len(identity.ChannelBindings) > 0 {
			identity.ChannelBindings = normalizeChannelBindings(bindings)
		}
	}

	s.items[identityID] = identity
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	copyIdentity := identity
	return &copyIdentity, nil
}

func normalizeChannelBindings(bindings []channelBinding) []channelBinding {
	if len(bindings) == 0 {
		return nil
	}
	seen := map[string]bool{}
	result := make([]channelBinding, 0, len(bindings))
	for _, b := range bindings {
		ch := strings.TrimSpace(b.ChannelID)
		acct := strings.TrimSpace(b.AccountID)
		uid := strings.TrimSpace(b.UserID)
		if ch == "" || acct == "" || uid == "" {
			continue
		}
		key := ch + ":" + acct + ":" + uid
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, channelBinding{
			ChannelID: ch,
			AccountID: acct,
			UserID:    uid,
		})
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func copyChannelBindings(bindings []channelBinding) []channelBinding {
	if len(bindings) == 0 {
		return nil
	}
	result := make([]channelBinding, len(bindings))
	copy(result, bindings)
	return result
}

func (s *magiIdentityStore) resolveIdentityByChannel(channelID, accountID, userID string) *magiIdentityRecord {
	if err := s.ensureLoaded(); err != nil {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, item := range s.items {
		if !item.Enabled {
			continue
		}
		for _, b := range item.ChannelBindings {
			if strings.EqualFold(b.ChannelID, channelID) &&
				strings.EqualFold(b.AccountID, accountID) &&
				b.UserID == userID {
				copyItem := item
				return &copyItem
			}
		}
	}
	return nil
}

func (s *magiIdentityStore) remove(identityID string) error {
	if err := s.ensureLoaded(); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.items[identityID]; !ok {
		return errMagiIdentityNotFound
	}
	delete(s.items, identityID)
	return s.saveLocked()
}

func (s *magiIdentityStore) incrementUsage(identityID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if item, ok := s.items[identityID]; ok {
		item.UsageCount++
		s.items[identityID] = item
	}
	_ = s.saveLocked()
}

func (s *magiIdentityStore) verify(identityID, password string) (*magiIdentityRecord, error) {
	item, err := s.get(identityID)
	if err != nil {
		return nil, err
	}
	if !item.Enabled {
		return nil, errMagiIdentityDisabled
	}
	if err := bcrypt.CompareHashAndPassword([]byte(item.PasswordHash), []byte(password)); err != nil {
		return nil, errors.New("invalid identity credentials")
	}
	return item, nil
}

func hashMagiIdentityPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func isValidMagiRouteClass(routeClass string) bool {
	switch routeClass {
	case magiRouteClassGuardian, magiRouteClassAvatarOnly:
		return true
	default:
		return false
	}
}

func normalizeMagiRouteClass(raw string) string {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "avatar" {
		return magiRouteClassAvatarOnly
	}
	return value
}

func isValidMagiRequestChannel(channel string) bool {
	switch channel {
	case magiRequestChannelMainUI,
		magiRequestChannelToolClaude,
		magiRequestChannelToolOpenAI,
		magiRequestChannelToolAnthropic,
		magiRequestChannelToolCustom,
		magiRequestChannelSystemCron:
		return true
	default:
		return false
	}
}

func normalizeMagiRequestChannel(raw string) string {
	return strings.TrimSpace(strings.ToLower(raw))
}

func magiWorkspaceBinding() string {
	token := workspaceAPIToken()
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:8])
}

func magiArmorSigningKey() []byte {
	token := workspaceAPIToken()
	if token == "" {
		return nil
	}
	sum := sha256.Sum256([]byte("magi-armor-signing-v1:" + token))
	key := make([]byte, len(sum))
	copy(key, sum[:])
	return key
}

func signMagiArmorToken(claims magiArmorClaimsV1) (string, error) {
	rawClaims, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payload := base64.RawURLEncoding.EncodeToString(rawClaims)
	key := magiArmorSigningKey()
	if len(key) == 0 {
		return "", errors.New("workspace api token not configured")
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(payload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return magiArmorTokenPrefix + payload + "." + signature, nil
}

func verifyMagiArmorToken(rawToken string) (*magiArmorClaimsV1, *magiSourceAuthError) {
	token := strings.TrimSpace(rawToken)
	if token == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_missing",
			Message:    "missing MAGI armor token",
		}
	}

	if strings.HasPrefix(strings.ToLower(token), "bearer ") {
		token = strings.TrimSpace(token[7:])
	}
	if !strings.HasPrefix(token, magiArmorTokenPrefix) {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_invalid",
			Message:    "invalid MAGI armor token",
		}
	}

	encoded := strings.TrimPrefix(token, magiArmorTokenPrefix)
	parts := strings.Split(encoded, ".")
	if len(parts) != 2 {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_malformed",
			Message:    "malformed MAGI armor token",
		}
	}
	payload := strings.TrimSpace(parts[0])
	signature := strings.TrimSpace(parts[1])
	if payload == "" || signature == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_malformed",
			Message:    "malformed MAGI armor token",
		}
	}

	key := magiArmorSigningKey()
	if len(key) == 0 {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_signing_key_unavailable",
			Message:    "workspace API token is unavailable",
		}
	}

	providedSig, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_signature_invalid",
			Message:    "invalid MAGI armor signature",
		}
	}

	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(payload))
	expectedSig := mac.Sum(nil)
	if subtle.ConstantTimeCompare(expectedSig, providedSig) != 1 {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_signature_mismatch",
			Message:    "MAGI armor signature mismatch",
		}
	}

	rawClaims, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_payload_invalid",
			Message:    "invalid MAGI armor payload",
		}
	}

	var claims magiArmorClaimsV1
	if err = json.Unmarshal(rawClaims, &claims); err != nil {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_claims_invalid",
			Message:    "invalid MAGI armor claims",
		}
	}

	now := time.Now().Unix()
	if claims.Sub == "" || claims.Chn == "" || claims.Ws == "" || claims.Jti == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_claims_missing",
			Message:    "required MAGI armor claims are missing",
		}
	}
	if claims.Exp <= now || claims.Exp <= claims.Iat {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_expired",
			Message:    "MAGI armor token expired",
		}
	}
	if claims.Iat > now+60 {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_issued_in_future",
			Message:    "MAGI armor token issued_at is invalid",
		}
	}
	if claims.Ws != magiWorkspaceBinding() {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_workspace_mismatch",
			Message:    "MAGI armor token is not bound to current workspace",
		}
	}

	claims.Chn = normalizeMagiRequestChannel(claims.Chn)
	claims.Rtc = normalizeMagiRouteClass(claims.Rtc)
	if !isValidMagiRequestChannel(claims.Chn) {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_channel_invalid",
			Message:    "invalid request channel in MAGI armor token",
		}
	}
	if !isValidMagiRouteClass(claims.Rtc) {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_route_class_invalid",
			Message:    "invalid route class in MAGI armor token",
		}
	}
	return &claims, nil
}

func resolveMagiArmorTokenFromContext(c *gin.Context) string {
	if c == nil {
		return ""
	}
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	return strings.TrimSpace(authHeader)
}

func isMagiMainUIAccessAuthorized(c *gin.Context) bool {
	if model.Conf == nil {
		return false
	}

	if strings.TrimSpace(model.Conf.AccessAuthCode) == "" {
		if util.SiYuanAccessAuthCodeBypass {
			return true
		}
		localhost := util.IsLocalHost(c.Request.RemoteAddr)
		clientIP := c.ClientIP()
		host := c.GetHeader("Host")
		origin := c.GetHeader("Origin")
		forwardedHost := c.GetHeader("X-Forwarded-Host")
		if !localhost ||
			(clientIP != "" && !util.IsLocalHostname(clientIP)) ||
			(host != "" && !util.IsLocalHost(host)) ||
			(origin != "" && !util.IsLocalOrigin(origin) && !strings.HasPrefix(origin, "chrome-extension://")) ||
			(forwardedHost != "" && !util.IsLocalHost(forwardedHost)) {
			return false
		}
		return true
	}

	session := util.GetSession(c)
	workspaceSession := util.GetWorkspaceSession(session)
	if workspaceSession.AccessAuthCode == model.Conf.AccessAuthCode {
		return true
	}
	if username, password, ok := c.Request.BasicAuth(); ok {
		if util.WorkspaceName == username && model.Conf.AccessAuthCode == password {
			return true
		}
	}
	return false
}

func requireMagiMainUIAccess(c *gin.Context) *magiSourceAuthError {
	if isMagiMainUIAccessAuthorized(c) {
		return nil
	}
	return &magiSourceAuthError{
		StatusCode: http.StatusForbidden,
		Code:       "magi_main_ui_access_required",
		Message:    "magi-main-ui access authorization is required",
	}
}

func resolveIdentityByID(identityID string) (*magiIdentityRecord, *magiSourceAuthError) {
	identityID = strings.TrimSpace(identityID)
	if identityID == "" {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_identity_missing",
			Message:    "identity id is required",
		}
	}
	item, err := globalMagiIdentityStore.get(identityID)
	if err != nil {
		if errors.Is(err, errMagiIdentityNotFound) {
			return nil, &magiSourceAuthError{
				StatusCode: http.StatusUnauthorized,
				Code:       "magi_identity_not_found",
				Message:    "identity does not exist",
			}
		}
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusInternalServerError,
			Code:       "magi_identity_load_failed",
			Message:    "failed to load identity",
		}
	}
	if !item.Enabled {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_identity_disabled",
			Message:    "identity is disabled",
		}
	}
	return item, nil
}

type magiIdentityUpsertRequest struct {
	IdentityID          string           `json:"identity_id"`
	DisplayName         string           `json:"display_name"`
	Nickname            string           `json:"nickname,omitempty"`
	Password            string           `json:"password"`
	RouteClass          string           `json:"route_class"`
	Enabled             *bool            `json:"enabled"`
	TokenExpiresSeconds int64            `json:"token_expires_seconds,omitempty"`
	ChannelBindings     []channelBinding `json:"channel_bindings,omitempty"`
}

type magiIdentityRemoveRequest struct {
	IdentityID string `json:"identity_id"`
}

type magiIdentityLoginRequest struct {
	IdentityID       string `json:"identity_id"`
	Password         string `json:"password"`
	Nickname         string `json:"nickname"`
	Channel          string `json:"channel"`
	ExpiresInSeconds int64  `json:"expires_in_seconds,omitempty"`
}

func magiIdentityList(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	views, err := globalMagiIdentityStore.listViews()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list MAGI identities",
			"code":  "magi_identity_list_failed",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"identities": views,
	})
}

func validateMagiIdentityID(identityID string) error {
	identityID = strings.TrimSpace(identityID)
	if identityID == "" {
		return errors.New("identity_id is required")
	}
	if len(identityID) > 64 {
		return errors.New("identity_id is too long")
	}
	for _, ch := range identityID {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' || ch == '.' {
			continue
		}
		return errors.New("identity_id contains invalid characters")
	}
	return nil
}

func magiIdentityUpsert(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	var req magiIdentityUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_identity_upsert_request_invalid",
		})
		return
	}

	identityID := strings.TrimSpace(req.IdentityID)
	if err := validateMagiIdentityID(identityID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
			"code":  "magi_identity_id_invalid",
		})
		return
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = identityID
	}
	routeClass := normalizeMagiRouteClass(req.RouteClass)
	if !isValidMagiRouteClass(routeClass) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "route_class must be guardian or avatar-only",
			"code":  "magi_route_class_invalid",
		})
		return
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	record, err := globalMagiIdentityStore.upsert(
		identityID,
		displayName,
		req.Nickname,
		req.Password,
		routeClass,
		enabled,
		req.TokenExpiresSeconds,
		req.ChannelBindings,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
			"code":  "magi_identity_upsert_failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"identity": magiIdentityView{
			IdentityID:          record.IdentityID,
			DisplayName:         record.DisplayName,
			Nickname:            record.Nickname,
			RouteClass:          record.RouteClass,
			Enabled:             record.Enabled,
			CreatedAt:           record.CreatedAt,
			UpdatedAt:           record.UpdatedAt,
			TokenExpiresSeconds: record.TokenExpiresSeconds,
			UsageCount:          record.UsageCount,
			ChannelBindings:     copyChannelBindings(record.ChannelBindings),
		},
	})
}

func magiIdentityRemove(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	var req magiIdentityRemoveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_identity_remove_request_invalid",
		})
		return
	}
	identityID := strings.TrimSpace(req.IdentityID)
	if identityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "identity_id is required",
			"code":  "magi_identity_id_required",
		})
		return
	}
	if err := globalMagiIdentityStore.remove(identityID); err != nil {
		if errors.Is(err, errMagiIdentityNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "identity not found",
				"code":  "magi_identity_not_found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to remove identity",
			"code":  "magi_identity_remove_failed",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"ok": true,
	})
}

type magiIdentityIssueBindCodeRequest struct {
	IdentityID string `json:"identity_id"`
}

func magiIdentityIssueBindCode(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	var req magiIdentityIssueBindCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_identity_bind_code_request_invalid",
		})
		return
	}

	identityID := strings.TrimSpace(req.IdentityID)
	if identityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "identity_id is required",
			"code":  "magi_identity_id_required",
		})
		return
	}

	record, err := globalMagiIdentityStore.get(identityID)
	if err != nil {
		if errors.Is(err, errMagiIdentityNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "identity not found",
				"code":  "magi_identity_not_found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to load identity",
			"code":  "magi_identity_load_failed",
		})
		return
	}

	if !record.Enabled {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "identity is disabled",
			"code":  "magi_identity_disabled",
		})
		return
	}

	code := storeBindCode(record.IdentityID)
	expiresAt := time.Now().Add(magiBindCodeTTL)

	c.JSON(http.StatusOK, gin.H{
		"bindCode":   code,
		"expiresAt":  expiresAt.UnixMilli(),
		"ttlSeconds": int64(magiBindCodeTTL.Seconds()),
	})
}

type magiIdentityChannelBindRequest struct {
	IdentityID string          `json:"identity_id"`
	Bindings   []channelBinding `json:"bindings"`
}

func magiIdentityChannelBind(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	var req magiIdentityChannelBindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_identity_bind_request_invalid",
		})
		return
	}

	identityID := strings.TrimSpace(req.IdentityID)
	if identityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "identity_id is required",
			"code":  "magi_identity_id_required",
		})
		return
	}

	record, err := globalMagiIdentityStore.get(identityID)
	if err != nil {
		if errors.Is(err, errMagiIdentityNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "identity not found",
				"code":  "magi_identity_not_found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to load identity",
			"code":  "magi_identity_load_failed",
		})
		return
	}

	if err := globalMagiIdentityStore.setChannelBindings(identityID, req.Bindings); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
			"code":  "magi_identity_bind_failed",
		})
		return
	}

	// 重新获取最新记录，确保 UpdatedAt 等字段反映 bind 操作
	record, _ = globalMagiIdentityStore.get(identityID)

	c.JSON(http.StatusOK, gin.H{
		"identity": magiIdentityView{
			IdentityID:          record.IdentityID,
			DisplayName:         record.DisplayName,
			Nickname:            record.Nickname,
			RouteClass:          record.RouteClass,
			Enabled:             record.Enabled,
			CreatedAt:           record.CreatedAt,
			UpdatedAt:           record.UpdatedAt,
			TokenExpiresSeconds: record.TokenExpiresSeconds,
			UsageCount:          record.UsageCount,
			ChannelBindings:     copyChannelBindings(record.ChannelBindings),
		},
	})
}

type magiIdentityChannelUnbindRequest struct {
	IdentityID string          `json:"identity_id"`
	Binding    channelBinding `json:"binding"`
}

func magiIdentityChannelUnbind(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	var req magiIdentityChannelUnbindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_identity_unbind_request_invalid",
		})
		return
	}

	identityID := strings.TrimSpace(req.IdentityID)
	if identityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "identity_id is required",
			"code":  "magi_identity_id_required",
		})
		return
	}

	if err := globalMagiIdentityStore.removeChannelBinding(identityID, req.Binding); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
			"code":  "magi_identity_unbind_failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *magiIdentityStore) setChannelBindings(identityID string, bindings []channelBinding) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[identityID]
	if !ok {
		return errMagiIdentityNotFound
	}
	item.ChannelBindings = normalizeChannelBindings(bindings)
	item.UpdatedAt = time.Now().UnixMilli()
	s.items[identityID] = item
	return s.saveLocked()
}

func (s *magiIdentityStore) addChannelBinding(identityID string, binding channelBinding) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[identityID]
	if !ok {
		return errMagiIdentityNotFound
	}

	ch := strings.TrimSpace(binding.ChannelID)
	acct := strings.TrimSpace(binding.AccountID)
	uid := strings.TrimSpace(binding.UserID)
	if ch == "" || acct == "" || uid == "" {
		return nil
	}

	for _, b := range item.ChannelBindings {
		if strings.EqualFold(b.ChannelID, ch) && strings.EqualFold(b.AccountID, acct) && b.UserID == uid {
			return nil // 已存在
		}
	}

	item.ChannelBindings = append(item.ChannelBindings, channelBinding{ChannelID: ch, AccountID: acct, UserID: uid})
	item.UpdatedAt = time.Now().UnixMilli()
	s.items[identityID] = item
	return s.saveLocked()
}

func (s *magiIdentityStore) removeChannelBinding(identityID string, binding channelBinding) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	item, ok := s.items[identityID]
	if !ok {
		return errMagiIdentityNotFound
	}

	filtered := make([]channelBinding, 0, len(item.ChannelBindings))
	for _, b := range item.ChannelBindings {
		if strings.EqualFold(b.ChannelID, binding.ChannelID) &&
			strings.EqualFold(b.AccountID, binding.AccountID) &&
			b.UserID == binding.UserID {
			continue
		}
		filtered = append(filtered, b)
	}
	item.ChannelBindings = filtered
	item.UpdatedAt = time.Now().UnixMilli()
	s.items[identityID] = item
	return s.saveLocked()
}

func magiIdentityLogin(c *gin.Context) {
	var req magiIdentityLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_identity_login_request_invalid",
		})
		return
	}

	identityID := strings.TrimSpace(req.IdentityID)
	password := strings.TrimSpace(req.Password)
	channel := normalizeMagiRequestChannel(req.Channel)
	if !isValidMagiRequestChannel(channel) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid channel",
			"code":  "magi_channel_invalid",
		})
		return
	}
	if channel == magiRequestChannelMainUI {
		if authErr := requireMagiMainUIAccess(c); authErr != nil {
			writeMagiSourceAuthError(c, authErr)
			return
		}
	}

	identity, err := globalMagiIdentityStore.verify(identityID, password)
	if err != nil {
		if errors.Is(err, errMagiIdentityNotFound) || errors.Is(err, errMagiIdentityDisabled) {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": err.Error(),
				"code":  "magi_identity_login_failed",
			})
			return
		}
		if strings.Contains(strings.ToLower(err.Error()), "invalid identity credentials") {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid identity credentials",
				"code":  "magi_identity_login_failed",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to verify identity",
			"code":  "magi_identity_verify_failed",
		})
		return
	}

	nowUnix := time.Now().Unix()
	expiresIn := req.ExpiresInSeconds
	if expiresIn <= 0 {
		expiresIn = identity.TokenExpiresSeconds
	}
	if expiresIn <= 0 {
		expiresIn = 1200
	}
	expiresAtUnix := nowUnix + expiresIn

	globalMagiIdentityStore.incrementUsage(identityID)

	nickname := identity.Nickname
	if nickname == "" {
		nickname = identity.DisplayName
		if nickname == "" {
			nickname = identity.IdentityID
		}
	}

	claims := magiArmorClaimsV1{
		Sub: identity.IdentityID,
		Chn: channel,
		Ws:  magiWorkspaceBinding(),
		Rtc: identity.RouteClass,
		Nck: nickname,
		Iat: nowUnix,
		Exp: expiresAtUnix,
		Jti: "jti-" + gulu.Rand.String(20),
	}
	token, signErr := signMagiArmorToken(claims)
	if signErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": signErr.Error(),
			"code":  "magi_armor_sign_failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"armor_token": token,
		"expires_at":  expiresAtUnix * 1000,
		"identity": gin.H{
			"identity_id":  identity.IdentityID,
			"display_name": identity.DisplayName,
			"route_class":  identity.RouteClass,
		},
		"channel":  channel,
		"nickname": nickname,
	})
}

type magiIdentityStatsResponse struct {
	TotalIdentities  int                         `json:"totalIdentities"`
	EnabledCount     int                         `json:"enabledCount"`
	TotalUsage       int64                       `json:"totalUsage"`
	Identities       []magiIdentityUsageSummary   `json:"identities"`
}

type magiIdentityUsageSummary struct {
	IdentityID  string `json:"identityId"`
	DisplayName string `json:"displayName"`
	RouteClass  string `json:"routeClass"`
	Enabled     bool   `json:"enabled"`
	UsageCount  int64  `json:"usageCount"`
	CreatedAt   int64  `json:"createdAt"`
}

type magiIdentityIssueAvatarTokenRequest struct {
	IdentityID       string `json:"identity_id"`
	Channel          string `json:"channel"`
	ExpiresInSeconds int64  `json:"expires_in_seconds,omitempty"`
	DocumentID       string `json:"document_id,omitempty"`
}

func magiIdentityIssueAvatarToken(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	var req magiIdentityIssueAvatarTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"code":  "magi_issue_avatar_token_request_invalid",
		})
		return
	}

	identityID := strings.TrimSpace(req.IdentityID)
	if identityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "identity_id is required",
			"code":  "magi_identity_id_required",
		})
		return
	}

	channel := normalizeMagiRequestChannel(req.Channel)
	if !isValidMagiRequestChannel(channel) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid channel",
			"code":  "magi_channel_invalid",
		})
		return
	}

	identity, err := globalMagiIdentityStore.get(identityID)
	if err != nil {
		if !errors.Is(err, errMagiIdentityNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to load identity",
				"code":  "magi_identity_load_failed",
			})
			return
		}
		created, createErr := globalMagiIdentityStore.upsert(
			identityID, identityID, "", "",
			magiRouteClassAvatarOnly, true, 0, nil,
		)
		if createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": createErr.Error(),
				"code":  "magi_identity_create_failed",
			})
			return
		}
		identity = created
	}
	if !identity.Enabled {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "identity is disabled",
			"code":  "magi_identity_disabled",
		})
		return
	}

	nowUnix := time.Now().Unix()
	expiresIn := req.ExpiresInSeconds
	if expiresIn <= 0 {
		expiresIn = identity.TokenExpiresSeconds
	}
	if expiresIn <= 0 {
		expiresIn = 1200
	}
	expiresAtUnix := nowUnix + expiresIn

	nickname := identity.Nickname
	if nickname == "" {
		nickname = identity.DisplayName
		if nickname == "" {
			nickname = identity.IdentityID
		}
	}

	docID := strings.TrimSpace(req.DocumentID)

	claims := magiArmorClaimsV1{
		Sub: identity.IdentityID,
		Chn: channel,
		Ws:  magiWorkspaceBinding(),
		Rtc: magiRouteClassAvatarOnly,
		Nck: nickname,
		Doc: docID,
		Iat: nowUnix,
		Exp: expiresAtUnix,
		Jti: "jti-" + gulu.Rand.String(20),
	}
	token, signErr := signMagiArmorToken(claims)
	if signErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": signErr.Error(),
			"code":  "magi_armor_sign_failed",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"armor_token": token,
		"expires_at":  expiresAtUnix * 1000,
		"identity": gin.H{
			"identity_id":  identity.IdentityID,
			"display_name": identity.DisplayName,
			"route_class":  magiRouteClassAvatarOnly,
		},
		"channel":  channel,
		"nickname": nickname,
	})
}

func magiIdentityStats(c *gin.Context) {
	if authErr := requireMagiMainUIAccess(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	views, err := globalMagiIdentityStore.listViews()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to list MAGI identities",
			"code":  "magi_identity_list_failed",
		})
		return
	}

	var totalUsage int64
	summaries := make([]magiIdentityUsageSummary, 0, len(views))
	enabledCount := 0
	for _, v := range views {
		totalUsage += v.UsageCount
		if v.Enabled {
			enabledCount++
		}
		summaries = append(summaries, magiIdentityUsageSummary{
			IdentityID:  v.IdentityID,
			DisplayName: v.DisplayName,
			RouteClass:  v.RouteClass,
			Enabled:     v.Enabled,
			UsageCount:  v.UsageCount,
			CreatedAt:   v.CreatedAt,
		})
	}

	c.JSON(http.StatusOK, magiIdentityStatsResponse{
		TotalIdentities: len(views),
		EnabledCount:    enabledCount,
		TotalUsage:      totalUsage,
		Identities:      summaries,
	})
}

func extractMagiArmorClaimsFromContext(c *gin.Context) (*magiArmorClaimsV1, *magiSourceAuthError) {
	token := resolveMagiArmorTokenFromContext(c)
	return verifyMagiArmorToken(token)
}

func ensureMagiArmorIdentityConsistency(claims *magiArmorClaimsV1) (*magiIdentityRecord, *magiSourceAuthError) {
	if claims == nil {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusUnauthorized,
			Code:       "magi_armor_claims_missing",
			Message:    "missing MAGI armor claims",
		}
	}
	identity, authErr := resolveIdentityByID(claims.Sub)
	if authErr != nil {
		return nil, authErr
	}
	if identity.RouteClass != claims.Rtc {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_route_class_mismatch",
			Message:    fmt.Sprintf("identity route class mismatch: token=%s current=%s", claims.Rtc, identity.RouteClass),
		}
	}
	return identity, nil
}
