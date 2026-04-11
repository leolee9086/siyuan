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

package api

import (
	"net/http"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
	"golang.org/x/time/rate"
)

type bazaarRateClient struct {
	IP        string
	Accepted  int64
	Rejected  int64
	LastSeen  int64
	limiter   *rate.Limiter
	rateEvery time.Duration
	burst     int
}

type bazaarRateGuard struct {
	mu            sync.Mutex
	clients       map[string]*bazaarRateClient
	totalAccepted int64
	totalRejected int64
}

var globalBazaarRateGuard = &bazaarRateGuard{
	clients: map[string]*bazaarRateClient{},
}

const (
	bazaarPublicAuthCookieName   = "bazaar-public-auth"
	bazaarPublicAuthCookiePath   = "/api/s-forge/bazaar/public"
	bazaarPublicAuthCookieMaxAge = 2 * 60 * 60
)

func getWorkspaceAPIToken() string {
	if nil == model.Conf || nil == model.Conf.Api {
		return ""
	}
	return strings.TrimSpace(model.Conf.Api.Token)
}

func getBazaarPublishAuthToken() string {
	if nil == model.Conf || nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Publish {
		return ""
	}
	return strings.TrimSpace(model.Conf.Bazaar.Publish.AuthToken)
}

func buildBazaarPublicAuthCookieValue(rawToken string) string {
	return util.SHA256Hash([]byte("bazaar-public-auth:" + strings.TrimSpace(rawToken)))
}

func setBazaarPublicAuthCookie(c *gin.Context, rawToken string) {
	rawToken = strings.TrimSpace(rawToken)
	if "" == rawToken {
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     bazaarPublicAuthCookieName,
		Value:    buildBazaarPublicAuthCookieValue(rawToken),
		MaxAge:   bazaarPublicAuthCookieMaxAge,
		Path:     bazaarPublicAuthCookiePath,
		Secure:   util.SSL,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func clearBazaarPublicAuthCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     bazaarPublicAuthCookieName,
		Value:    "",
		MaxAge:   -1,
		Path:     bazaarPublicAuthCookiePath,
		Secure:   util.SSL,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func isAcceptedBazaarPublicRawToken(rawToken string) bool {
	rawToken = strings.TrimSpace(rawToken)
	if "" == rawToken {
		return false
	}
	if workspaceToken := getWorkspaceAPIToken(); "" != workspaceToken && workspaceToken == rawToken {
		return true
	}
	if bazaarToken := getBazaarPublishAuthToken(); "" != bazaarToken && bazaarToken == rawToken {
		return true
	}
	return false
}

func isValidBazaarPublicAuthCookie(c *gin.Context) bool {
	cookie, cookieErr := c.Request.Cookie(bazaarPublicAuthCookieName)
	if nil != cookieErr {
		return false
	}
	cookieValue := strings.TrimSpace(cookie.Value)
	if "" == cookieValue {
		return false
	}
	if workspaceToken := getWorkspaceAPIToken(); "" != workspaceToken && cookieValue == buildBazaarPublicAuthCookieValue(workspaceToken) {
		return true
	}
	if bazaarToken := getBazaarPublishAuthToken(); "" != bazaarToken && cookieValue == buildBazaarPublicAuthCookieValue(bazaarToken) {
		return true
	}
	return false
}

func parseAuthToken(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if "" == authHeader {
		return ""
	}
	switch {
	case strings.HasPrefix(authHeader, "Token "):
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Token "))
	case strings.HasPrefix(authHeader, "token "):
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "token "))
	case strings.HasPrefix(authHeader, "Bearer "):
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	case strings.HasPrefix(authHeader, "bearer "):
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "bearer "))
	default:
		return authHeader
	}
}

func isValidWorkspaceAPIToken(c *gin.Context) bool {
	expected := getWorkspaceAPIToken()
	if "" == expected {
		return false
	}
	if parseAuthToken(c) == expected {
		return true
	}
	if strings.TrimSpace(c.GetHeader("X-API-Token")) == expected {
		return true
	}
	return false
}

func isValidBazaarPublishToken(c *gin.Context) bool {
	expected := getBazaarPublishAuthToken()
	if "" == expected {
		return false
	}
	if strings.TrimSpace(c.GetHeader("X-Bazaar-Token")) == expected {
		return true
	}
	if parseAuthToken(c) == expected {
		return true
	}
	return false
}

func isValidGlobalArmor(c *gin.Context) bool {
	claims, authErr := extractMagiArmorClaimsFromContext(c)
	if nil != authErr || nil == claims {
		return false
	}
	_, authErr = ensureMagiArmorIdentityConsistency(claims)
	return nil == authErr
}

func checkBazaarPublicAuth(c *gin.Context) {
	if nil == model.Conf || nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Publish {
		c.Next()
		return
	}
	if !model.Conf.Bazaar.Publish.RequireAuth {
		c.Next()
		return
	}
	if isValidBazaarPublicAuthCookie(c) || isValidWorkspaceAPIToken(c) || isValidBazaarPublishToken(c) || isValidGlobalArmor(c) {
		c.Next()
		return
	}

	c.JSON(http.StatusUnauthorized, gin.H{
		"code":  -1,
		"msg":   "bazaar public auth required",
		"error": "bazaar_publish_auth_required",
	})
	c.Abort()
}

func loginBazaarPublicAuth(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	if nil == model.Conf || nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Publish || !model.Conf.Bazaar.Publish.Enabled {
		ret.Code = -1
		ret.Msg = "bazaar publish is disabled"
		return
	}

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	var token string
	if !util.ParseJsonArgs(arg, ret, util.BindJsonArg("token", &token, true, true)) {
		return
	}

	if !isAcceptedBazaarPublicRawToken(token) {
		ret.Code = -1
		ret.Msg = "invalid bazaar public auth token"
		return
	}

	setBazaarPublicAuthCookie(c, token)
	ret.Data = map[string]any{
		"expireSeconds": bazaarPublicAuthCookieMaxAge,
	}
}

func logoutBazaarPublicAuth(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	clearBazaarPublicAuthCookie(c)
}

func checkBazaarRateLimit(c *gin.Context) {
	if nil == model.Conf || nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Security {
		c.Next()
		return
	}
	cfg := model.Conf.Bazaar.Security
	if !cfg.EnableRateLimit {
		c.Next()
		return
	}
	requests := cfg.RequestsPerMinute
	if 1 > requests {
		requests = 120
	}
	windowSeconds := cfg.WindowSeconds
	if 1 > windowSeconds {
		windowSeconds = 60
	}
	burst := cfg.Burst
	if 1 > burst {
		burst = 30
	}
	rateEvery := time.Duration(windowSeconds) * time.Second / time.Duration(requests)
	if rateEvery <= 0 {
		rateEvery = time.Second
	}

	ip := strings.TrimSpace(c.ClientIP())
	if "" == ip {
		ip = strings.TrimSpace(c.GetHeader("X-Forwarded-For"))
	}
	if "" == ip {
		ip = "unknown"
	}

	now := time.Now().UnixMilli()
	allowed := false

	globalBazaarRateGuard.mu.Lock()
	client, exists := globalBazaarRateGuard.clients[ip]
	if !exists {
		client = &bazaarRateClient{
			IP:        ip,
			LastSeen:  now,
			limiter:   rate.NewLimiter(rate.Every(rateEvery), burst),
			rateEvery: rateEvery,
			burst:     burst,
		}
		globalBazaarRateGuard.clients[ip] = client
	}
	if client.rateEvery != rateEvery || client.burst != burst {
		client.limiter = rate.NewLimiter(rate.Every(rateEvery), burst)
		client.rateEvery = rateEvery
		client.burst = burst
	}

	allowed = client.limiter.Allow()
	client.LastSeen = now
	if allowed {
		client.Accepted++
		globalBazaarRateGuard.totalAccepted++
	} else {
		client.Rejected++
		globalBazaarRateGuard.totalRejected++
	}

	expireBefore := now - 30*60*1000
	for key, item := range globalBazaarRateGuard.clients {
		if nil == item {
			delete(globalBazaarRateGuard.clients, key)
			continue
		}
		if item.LastSeen < expireBefore {
			delete(globalBazaarRateGuard.clients, key)
		}
	}
	globalBazaarRateGuard.mu.Unlock()

	if !allowed {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"code": -1,
			"msg":  "too many bazaar requests, please retry later",
		})
		c.Abort()
		return
	}
	c.Next()
}

func getBazaarRateStats() map[string]any {
	globalBazaarRateGuard.mu.Lock()
	defer globalBazaarRateGuard.mu.Unlock()

	clients := make([]map[string]any, 0, len(globalBazaarRateGuard.clients))
	for _, client := range globalBazaarRateGuard.clients {
		if nil == client {
			continue
		}
		clients = append(clients, map[string]any{
			"ip":       client.IP,
			"accepted": client.Accepted,
			"rejected": client.Rejected,
			"lastSeen": client.LastSeen,
		})
	}
	sort.SliceStable(clients, func(i, j int) bool {
		left := clients[i]
		right := clients[j]
		return left["lastSeen"].(int64) > right["lastSeen"].(int64)
	})
	if len(clients) > 50 {
		clients = clients[:50]
	}

	return map[string]any{
		"totalAccepted": globalBazaarRateGuard.totalAccepted,
		"totalRejected": globalBazaarRateGuard.totalRejected,
		"clients":       clients,
	}
}

func getBazaarPublishWorkspace(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	data := model.GetBazaarPublishWorkspace(true)
	ret.Data = map[string]any{
		"workspace": data,
		"published": model.GetBazaarPublishedIndex(),
	}
}

func setBazaarPublishConfig(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	decode := func(raw any, target any) bool {
		if nil == raw {
			return false
		}
		data, err := gulu.JSON.MarshalJSON(raw)
		if nil != err {
			ret.Code = -1
			ret.Msg = err.Error()
			return false
		}
		if err = gulu.JSON.UnmarshalJSON(data, target); nil != err {
			ret.Code = -1
			ret.Msg = err.Error()
			return false
		}
		return true
	}

	var publish *conf.BazaarPublish
	var security *conf.BazaarSecurity
	var hub *conf.BazaarHubPreference

	if rawPublish, exists := arg["publish"]; exists {
		tmp := conf.NewBazaarPublish()
		if !decode(rawPublish, tmp) {
			return
		}
		publish = tmp
	}
	if rawSecurity, exists := arg["security"]; exists {
		tmp := conf.NewBazaarSecurity()
		if !decode(rawSecurity, tmp) {
			return
		}
		security = tmp
	}
	if rawHub, exists := arg["hub"]; exists {
		tmp := conf.NewBazaarHubPreference()
		if !decode(rawHub, tmp) {
			return
		}
		hub = tmp
	}

	model.SetBazaarPublishConfig(publish, security, hub)
	ret.Data = model.GetBazaarPublishWorkspace(true)
}

func upsertBazaarSource(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	data, err := gulu.JSON.MarshalJSON(arg)
	if nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	source := conf.NewBazaarSource()
	if err = gulu.JSON.UnmarshalJSON(data, source); nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	saved, err := model.UpsertBazaarSource(source)
	if nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = map[string]any{
		"source": saved,
	}
}

func removeBazaarSource(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}
	var sourceID string
	if !util.ParseJsonArgs(arg, ret, util.BindJsonArg("sourceID", &sourceID, true, true)) {
		return
	}
	if err := model.RemoveBazaarSource(sourceID); nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = map[string]any{
		"sourceID": sourceID,
	}
}

func testBazaarSource(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}
	var sourceID, sourceURL, token string
	if !util.ParseJsonArgs(arg, ret,
		util.BindJsonArg("sourceID", &sourceID, false, false),
		util.BindJsonArg("url", &sourceURL, false, false),
		util.BindJsonArg("token", &token, false, false),
	) {
		return
	}

	var (
		count int
		err   error
	)
	if "" != strings.TrimSpace(sourceID) {
		count, err = model.TestBazaarSourceByID(sourceID)
	} else {
		if "" == strings.TrimSpace(sourceURL) {
			ret.Code = -1
			ret.Msg = "[url] is required"
			return
		}
		count, err = model.TestBazaarSource(sourceURL, token)
	}
	if nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = map[string]any{
		"packageCount": count,
	}
}

func getBazaarSourcePackages(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}
	var sourceID string
	if !util.ParseJsonArgs(arg, ret, util.BindJsonArg("sourceID", &sourceID, true, true)) {
		return
	}

	index, err := model.GetBazaarSourcePackages(sourceID)
	if nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = index
}

func publishBazaarPackage(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}
	var packageType, packageName string
	if !util.ParseJsonArgs(arg, ret,
		util.BindJsonArg("packageType", &packageType, true, true),
		util.BindJsonArg("packageName", &packageName, true, true),
	) {
		return
	}

	record, warn, err := model.PublishInstalledBazaarPackage(packageType, packageName)
	if nil != err {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = map[string]any{
		"record":  record,
		"warning": warn,
	}
}

func installBazaarPackageFromSource(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}

	var sourceID, packageType, packageName, version, frontend, keyword string
	var mode float64
	if !util.ParseJsonArgs(arg, ret,
		util.BindJsonArg("sourceID", &sourceID, true, true),
		util.BindJsonArg("packageType", &packageType, false, false),
		util.BindJsonArg("packageName", &packageName, false, false),
		util.BindJsonArg("version", &version, false, false),
		util.BindJsonArg("mode", &mode, false, false),
		util.BindJsonArg("frontend", &frontend, false, false),
		util.BindJsonArg("keyword", &keyword, false, false),
	) {
		return
	}

	installedType, installedName, err := model.InstallBazaarPackageFromSource(sourceID, packageType, packageName, version, int(mode))
	if nil != err {
		ret.Code = 1
		ret.Msg = err.Error()
		return
	}

	// 安装主题后保持和其他入口一致，不跟随系统切换
	if "themes" == installedType {
		model.Conf.Appearance.ModeOS = false
		model.Conf.Save()
	}

	packages := model.GetBazaarPackages(installedType, "", keyword)
	if "plugins" == installedType {
		packages = model.GetBazaarPackages(installedType, frontend, keyword)
	}

	data := map[string]any{
		"packageType": installedType,
		"packageName": installedName,
		"packages":    packages,
	}
	if "themes" == installedType || "icons" == installedType {
		data["appearance"] = model.Conf.Appearance
	}
	ret.Data = data
	util.PushMsg(model.Conf.Language(69), 3000)
}

func getBazaarPublicIndex(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	if nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Publish || !model.Conf.Bazaar.Publish.Enabled {
		ret.Code = -1
		ret.Msg = "bazaar publish is disabled"
		return
	}
	ret.Data = model.GetBazaarPublicPublishedIndex()
}

func getBazaarPublicSourcePage(c *gin.Context) {
	if nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Publish || !model.Conf.Bazaar.Publish.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "bazaar publish is disabled"})
		return
	}

	rootDir := filepath.Join(util.WorkingDir, "stage", "build", "bazaar-source")
	reqPath := strings.TrimPrefix(strings.TrimSpace(c.Param("filepath")), "/")
	if "" == reqPath {
		reqPath = "index.html"
	}

	target := filepath.Clean(filepath.Join(rootDir, reqPath))
	relative, relErr := filepath.Rel(rootDir, target)
	if nil != relErr || strings.HasPrefix(relative, "..") || filepath.IsAbs(relative) {
		c.JSON(http.StatusForbidden, gin.H{"code": -1, "msg": "invalid path"})
		return
	}
	if !gulu.File.IsExist(target) {
		target = filepath.Join(rootDir, "index.html")
		if !gulu.File.IsExist(target) {
			c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "bazaar source page not built"})
			return
		}
	}
	c.File(target)
}

func downloadBazaarPublicPackage(c *gin.Context) {
	if nil == model.Conf.Bazaar || nil == model.Conf.Bazaar.Publish || !model.Conf.Bazaar.Publish.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "bazaar publish is disabled"})
		return
	}
	artifactID := strings.TrimSpace(c.Param("artifactID"))
	zipPath, downloadName, err := model.ResolveBazaarPublishedArtifact(artifactID)
	if nil != err {
		c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": err.Error()})
		return
	}
	c.FileAttachment(zipPath, downloadName)
}

func getBazaarSecurityStats(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	ret.Data = getBazaarRateStats()
}
