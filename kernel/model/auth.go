// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package model

import (
	"crypto/rand"
	"fmt"
	"net/http"
	"sync"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/siyuan-note/logging"
)

type Account struct {
	Username string
	Password string
	Token    string
}
type AccountsMap map[string]*Account // username -> account
type SessionsMap map[string]string   // sessionID -> username
type ClaimsKeyType string

const (
	XAuthTokenKey = "X-Auth-Token"

	SessionIdCookieName = "publish-visitor-session-id"

	ClaimsContextKey = "claims"

	iss = "siyuan-kernel" // token 的发行者

	ClaimsKeyRole string = "role"
)

var (
	accountsMap = AccountsMap{}
	sessionsMap = SessionsMap{}
	sessionLock = sync.Mutex{}

	jwtKey = make([]byte, 32)
)

func InitJwtKey() error {
	if _, err := rand.Read(jwtKey); err != nil {
		logging.LogErrorf("generate JWT signing key failed: %s", err)
		return err
	}
	return nil
}

func GetBasicAuthAccount(username string) *Account {
	return accountsMap[username]
}

func GetBasicAuthUsernameBySessionID(sessionID string) string {
	return sessionsMap[sessionID]
}

func GetNewSessionID() string {
	sessionID := uuid.New().String()
	return sessionID
}

func AddSession(sessionID, username string) {
	sessionLock.Lock()
	defer sessionLock.Unlock()
	sessionsMap[sessionID] = username
}

func DeleteSession(sessionID string) {
	sessionLock.Lock()
	defer sessionLock.Unlock()
	delete(sessionsMap, sessionID)
}

func InitPublishAccounts() {
	accountsMap = AccountsMap{
		"": &Account{}, // 匿名用户
	}
	for _, account := range Conf.Publish.Auth.Accounts {
		accountsMap[account.Username] = &Account{
			Username: account.Username,
			Password: account.Password,
		}
	}

	InitPublishJWT()
}

func InitPublishJWT() {
	if _, err := rand.Read(jwtKey); err != nil {
		logging.LogErrorf("generate JWT signing key failed: %s", err)
		return
	}

	for username, account := range accountsMap {
		// REF: https://golang-jwt.github.io/jwt/usage/create/
		t := jwt.NewWithClaims(
			jwt.SigningMethodHS256,
			jwt.MapClaims{
				"iss": iss,                     // token 的发行者
				"sub": username,                // token 代表的主体
				"aud": "siyuan-publish-server", // token 的受众
				"jti": uuid.New().String(),     // token 的唯一标识

				ClaimsKeyRole: RoleReader, // 角色
			},
		)
		if token, err := t.SignedString(jwtKey); err != nil {
			logging.LogErrorf("JWT signature failed: %s", err)
			return
		} else {
			account.Token = token
		}
	}
}

// CreatePluginJWT 为指定名称的内核插件创建一个 JWT，包含管理员权限。插件使用这个 JWT 调用内核 API。
func CreatePluginJWT(name string) (string, error) {
	t := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		jwt.MapClaims{
			"iss": iss,
			"sub": name,
			"aud": "siyuan-kernel-plugin",
			"jti": uuid.New().String(),

			ClaimsKeyRole: RoleAdministrator,
		},
	)
	if token, err := t.SignedString(jwtKey); err != nil {
		logging.LogErrorf("JWT signature failed: %s", err)
		return "", err
	} else {
		return token, nil
	}
}

func ParseJWT(tokenString string) (*jwt.Token, error) {
	// REF: https://golang-jwt.github.io/jwt/usage/parse/
	return jwt.Parse(
		tokenString,
		func(token *jwt.Token) (any, error) {
			return jwtKey, nil
		},
		jwt.WithIssuer(iss),
	)
}

func ParseXAuthToken(r *http.Request) *jwt.Token {
	tokenString := r.Header.Get(XAuthTokenKey)
	if tokenString != "" {
		if token, err := ParseJWT(tokenString); err != nil {
			logging.LogErrorf("JWT parse failed: %s", err)
		} else {
			return token
		}
	}
	return nil
}

func GetTokenClaims(token *jwt.Token) jwt.MapClaims {
	return token.Claims.(jwt.MapClaims)
}

func GetClaimRole(claims jwt.MapClaims) Role {
	if role := claims[ClaimsKeyRole]; role != nil {
		return Role(role.(float64))
	}
	return RoleVisitor
}

const (
	CLIDelegationIss = "siyuan"
	CLIDelegationSub = "cli-delegation"
	CLIDelegationAud = "magi-cli"
)

// IssueCLIDelegationToken 签发 CLI 代理身份 JWT。
func IssueCLIDelegationToken(userID string) (string, error) {
	t := jwt.NewWithClaims(
		jwt.SigningMethodHS256,
		jwt.MapClaims{
			"iss": CLIDelegationIss,
			"sub": CLIDelegationSub,
			"aud": CLIDelegationAud,
			"uid": userID,
		},
	)
	return t.SignedString(jwtKey)
}

// ParseCLIDelegationToken 解析 CLI 代理身份 JWT。
// 使用与系统相同的 jwtKey 签名，但使用专属的 iss/sub/aud。
// Token 中 "uid" 声明为被代理用户 ID，"scp" 为权限范围列表（可选）。
func ParseCLIDelegationToken(tokenString string) (userID string, scope []string, err error) {
	token, parseErr := jwt.Parse(
		tokenString,
		func(token *jwt.Token) (any, error) {
			return jwtKey, nil
		},
		jwt.WithIssuer(CLIDelegationIss),
		jwt.WithSubject(CLIDelegationSub),
		jwt.WithAudience(CLIDelegationAud),
	)
	if parseErr != nil {
		return "", nil, fmt.Errorf("parse CLI delegation token: %w", parseErr)
	}
	claims := GetTokenClaims(token)
	uid, ok := claims["uid"].(string)
	if !ok || uid == "" {
		return "", nil, fmt.Errorf("CLI delegation token missing uid claim")
	}
	if rawScope, ok := claims["scp"].([]interface{}); ok {
		for _, s := range rawScope {
			if str, ok := s.(string); ok {
				scope = append(scope, str)
			}
		}
	}
	return uid, scope, nil
}

// IsPublishServiceToken 检查 token 是否来自发布服务
func IsPublishServiceToken(token *jwt.Token) bool {
	if token == nil || !token.Valid {
		return false
	}
	claims := GetTokenClaims(token)
	if tokenIssuer, ok := claims["iss"].(string); ok {
		return tokenIssuer == iss
	}
	return false
}
