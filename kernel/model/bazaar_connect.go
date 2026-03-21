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
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/siyuan/kernel/bazaar"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/util"
	"golang.org/x/mod/semver"
)

type BazaarPublishedItem struct {
	PackageType  string `json:"packageType"`
	PackageName  string `json:"packageName"`
	Version      string `json:"version"`
	ArtifactID   string `json:"artifactId"`
	PublishedAt  int64  `json:"publishedAt"`
	ChecksumSHA  string `json:"checksumSHA"`
	DisplayName  string `json:"displayName"`
	Description  string `json:"description"`
	Author       string `json:"author"`
	OfficialName bool   `json:"officialName"`
	DownloadPath string `json:"downloadPath"`
}

type BazaarPublishedIndex struct {
	UpdatedAt int64                  `json:"updatedAt"`
	Packages  []*BazaarPublishedItem `json:"packages"`
}

type BazaarPublishWorkspace struct {
	Sources   []*conf.BazaarSource         `json:"sources"`
	Publish   *conf.BazaarPublish          `json:"publish"`
	Security  *conf.BazaarSecurity         `json:"security"`
	Hub       *conf.BazaarHubPreference    `json:"hub"`
	Installed map[string][]*bazaar.Package `json:"installed"`
}

var bazaarConnectLock sync.Mutex

const (
	bazaarPublishEndpointIndex    = "/api/s-forge/bazaar/public/index"
	bazaarPublishEndpointDownload = "/api/s-forge/bazaar/public/download/"
	bazaarMaskedSecret            = "********"
	bazaarIndexMaxBytes           = 8 * 1024 * 1024
	bazaarDownloadMaxBytes        = 200 * 1024 * 1024
)

func ensureBazaarConfigReady() {
	if nil == Conf.Bazaar {
		Conf.Bazaar = conf.NewBazaar()
	}
	Conf.Bazaar.Normalize()
}

func cloneBazaarSource(source *conf.BazaarSource, maskToken bool) *conf.BazaarSource {
	if nil == source {
		return nil
	}
	ret := &conf.BazaarSource{
		ID:           source.ID,
		Name:         source.Name,
		URL:          source.URL,
		Token:        source.Token,
		Enabled:      source.Enabled,
		AllowInstall: source.AllowInstall,
		OpenInTab:    source.OpenInTab,
		CreatedAt:    source.CreatedAt,
		UpdatedAt:    source.UpdatedAt,
	}
	if maskToken && "" != ret.Token {
		ret.Token = bazaarMaskedSecret
	}
	return ret
}

func cloneBazaarPublish(publish *conf.BazaarPublish, maskAuthToken bool) *conf.BazaarPublish {
	if nil == publish {
		return conf.NewBazaarPublish()
	}
	ret := &conf.BazaarPublish{
		Enabled:                    publish.Enabled,
		RequireAuth:                publish.RequireAuth,
		AuthToken:                  strings.TrimSpace(publish.AuthToken),
		MinExpose:                  publish.MinExpose,
		AllowOfficialNameCollision: publish.AllowOfficialNameCollision,
		Rules:                      []*conf.BazaarPublishRule{},
		Records:                    []*conf.BazaarPublishRecord{},
	}
	if maskAuthToken && "" != ret.AuthToken {
		ret.AuthToken = bazaarMaskedSecret
	}

	for _, rule := range publish.Rules {
		if nil == rule {
			continue
		}
		ret.Rules = append(ret.Rules, &conf.BazaarPublishRule{
			PackageType: normalizeBazaarPackageType(rule.PackageType),
			PackageName: strings.TrimSpace(rule.PackageName),
			Enabled:     rule.Enabled,
		})
	}
	for _, record := range publish.Records {
		if nil == record {
			continue
		}
		ret.Records = append(ret.Records, &conf.BazaarPublishRecord{
			PackageType:  normalizeBazaarPackageType(record.PackageType),
			PackageName:  strings.TrimSpace(record.PackageName),
			Version:      strings.TrimSpace(record.Version),
			ArtifactID:   strings.TrimSpace(record.ArtifactID),
			PublishedAt:  record.PublishedAt,
			ChecksumSHA:  strings.ToLower(strings.TrimSpace(record.ChecksumSHA)),
			DisplayName:  strings.TrimSpace(record.DisplayName),
			Description:  strings.TrimSpace(record.Description),
			Author:       strings.TrimSpace(record.Author),
			OfficialName: record.OfficialName,
		})
	}
	return ret
}

func cloneBazaarSecurity(security *conf.BazaarSecurity) *conf.BazaarSecurity {
	if nil == security {
		return conf.NewBazaarSecurity()
	}
	return &conf.BazaarSecurity{
		EnableRateLimit:   security.EnableRateLimit,
		RequestsPerMinute: security.RequestsPerMinute,
		Burst:             security.Burst,
		WindowSeconds:     security.WindowSeconds,
	}
}

func cloneBazaarHubPreference(hub *conf.BazaarHubPreference) *conf.BazaarHubPreference {
	if nil == hub {
		return conf.NewBazaarHubPreference()
	}
	return &conf.BazaarHubPreference{
		DefaultSourceID: strings.TrimSpace(hub.DefaultSourceID),
		ShowOfficial:    hub.ShowOfficial,
	}
}

func GetBazaarPublishWorkspace(maskSourceToken bool) *BazaarPublishWorkspace {
	ensureBazaarConfigReady()
	ret := &BazaarPublishWorkspace{
		Sources:   []*conf.BazaarSource{},
		Publish:   cloneBazaarPublish(Conf.Bazaar.Publish, maskSourceToken),
		Security:  cloneBazaarSecurity(Conf.Bazaar.Security),
		Hub:       cloneBazaarHubPreference(Conf.Bazaar.Hub),
		Installed: map[string][]*bazaar.Package{},
	}
	for _, source := range Conf.Bazaar.Sources {
		ret.Sources = append(ret.Sources, cloneBazaarSource(source, maskSourceToken))
	}
	ret.Installed = collectInstalledPackagesForPublish()
	return ret
}

func collectInstalledPackagesForPublish() map[string][]*bazaar.Package {
	ret := map[string][]*bazaar.Package{
		"plugins":   {},
		"widgets":   {},
		"themes":    {},
		"icons":     {},
		"templates": {},
	}
	for _, pkgType := range orderedBazaarPackageTypes {
		infos, _, _, err := GetInstalledPackageInfos(pkgType)
		if nil != err {
			continue
		}
		packages := make([]*bazaar.Package, 0, len(infos))
		for _, info := range infos {
			if nil == info.Pkg {
				continue
			}
			pkgCopy := *info.Pkg
			packages = append(packages, &pkgCopy)
		}
		sort.SliceStable(packages, func(i, j int) bool {
			return packages[i].Name < packages[j].Name
		})
		ret[pkgType] = packages
	}
	return ret
}

func normalizeBazaarSourceURL(rawURL string) (string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if "" == rawURL {
		return "", fmt.Errorf("source url is empty")
	}
	u, err := url.Parse(rawURL)
	if nil != err {
		return "", err
	}
	if "http" != strings.ToLower(u.Scheme) && "https" != strings.ToLower(u.Scheme) {
		return "", fmt.Errorf("source url scheme must be http/https")
	}
	if "" == strings.TrimSpace(u.Host) {
		return "", fmt.Errorf("source host is empty")
	}
	if nil != u.User {
		return "", fmt.Errorf("source url with user info is not allowed")
	}
	if err := validateBazaarRequestURL(u); nil != err {
		return "", err
	}
	u.RawQuery = ""
	u.Fragment = ""
	u.Path = strings.TrimRight(u.Path, "/")
	return u.String(), nil
}

func isBazaarBlockedIP(ip net.IP) bool {
	if nil == ip {
		return true
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified()
}

func validateBazaarResolvedHost(hostname string) error {
	hostname = strings.TrimSpace(hostname)
	if "" == hostname {
		return fmt.Errorf("source host is empty")
	}
	if util.IsLocalHostname(hostname) {
		return fmt.Errorf("source host [%s] is prohibited", hostname)
	}
	if ip := net.ParseIP(hostname); nil != ip {
		if isBazaarBlockedIP(ip) {
			return fmt.Errorf("source host ip [%s] is prohibited", hostname)
		}
		return nil
	}

	ips, err := net.LookupIP(hostname)
	if nil != err {
		return fmt.Errorf("resolve source host [%s] failed", hostname)
	}
	if 1 > len(ips) {
		return fmt.Errorf("source host [%s] has no resolved ip", hostname)
	}
	for _, ip := range ips {
		if isBazaarBlockedIP(ip) {
			return fmt.Errorf("source host [%s] resolves to prohibited ip [%s]", hostname, ip.String())
		}
	}
	return nil
}

func validateBazaarRequestURL(u *url.URL) error {
	if nil == u {
		return fmt.Errorf("source url is nil")
	}
	scheme := strings.ToLower(strings.TrimSpace(u.Scheme))
	if "http" != scheme && "https" != scheme {
		return fmt.Errorf("source url scheme must be http/https")
	}
	if nil != u.User {
		return fmt.Errorf("source url with user info is not allowed")
	}
	host := strings.TrimSpace(u.Hostname())
	if "" == host {
		return fmt.Errorf("source host is empty")
	}
	return validateBazaarResolvedHost(host)
}

func normalizeBazaarURLPort(u *url.URL) string {
	if nil == u {
		return ""
	}
	port := strings.TrimSpace(u.Port())
	if "" != port {
		return port
	}
	if "https" == strings.ToLower(strings.TrimSpace(u.Scheme)) {
		return "443"
	}
	return "80"
}

func isSameBazaarHost(left, right *url.URL) bool {
	if nil == left || nil == right {
		return false
	}
	if !strings.EqualFold(strings.TrimSpace(left.Hostname()), strings.TrimSpace(right.Hostname())) {
		return false
	}
	return normalizeBazaarURLPort(left) == normalizeBazaarURLPort(right)
}

func newBazaarHTTPClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout: timeout,
		Control: func(network, address string, c syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if nil != err {
				return err
			}
			ip := net.ParseIP(host)
			if nil != ip && isBazaarBlockedIP(ip) {
				return fmt.Errorf("dial prohibited ip [%s]", host)
			}
			return nil
		},
	}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          20,
		IdleConnTimeout:       30 * time.Second,
		TLSHandshakeTimeout:   timeout,
		ExpectContinueTimeout: time.Second,
		ResponseHeaderTimeout: timeout,
	}
	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if 3 <= len(via) {
				return fmt.Errorf("too many redirects")
			}
			if err := validateBazaarRequestURL(req.URL); nil != err {
				return err
			}
			if 0 < len(via) && !isSameBazaarHost(via[0].URL, req.URL) {
				return fmt.Errorf("redirect to different host is prohibited")
			}
			return nil
		},
	}
}

func resolveBazaarDownloadURL(sourceURL string, target *BazaarPublishedItem) (string, error) {
	baseURL, err := url.Parse(strings.TrimSpace(sourceURL))
	if nil != err {
		return "", err
	}
	if err = validateBazaarRequestURL(baseURL); nil != err {
		return "", err
	}

	downloadPath := strings.TrimSpace(target.DownloadPath)
	if "" == downloadPath {
		downloadPath = bazaarPublishEndpointDownload + strings.TrimSpace(target.ArtifactID)
	}
	parsedDownloadURL, err := url.Parse(downloadPath)
	if nil != err {
		return "", err
	}
	resolved := parsedDownloadURL
	if !parsedDownloadURL.IsAbs() {
		resolved = baseURL.ResolveReference(parsedDownloadURL)
	}
	if err = validateBazaarRequestURL(resolved); nil != err {
		return "", err
	}
	if !isSameBazaarHost(baseURL, resolved) {
		return "", fmt.Errorf("download host [%s] mismatches source host [%s]", resolved.Host, baseURL.Host)
	}
	resolved.Fragment = ""
	return resolved.String(), nil
}

func isValidChecksumSHA(checksumSHA string) bool {
	checksumSHA = strings.TrimSpace(checksumSHA)
	if 64 != len(checksumSHA) {
		return false
	}
	_, err := hex.DecodeString(checksumSHA)
	return nil == err
}

func verifyBazaarPackageChecksum(zipPath, checksumSHA string) error {
	checksumSHA = strings.ToLower(strings.TrimSpace(checksumSHA))
	if !isValidChecksumSHA(checksumSHA) {
		return fmt.Errorf("invalid package checksum")
	}
	actual, err := hashFileSHA256(zipPath)
	if nil != err {
		return err
	}
	if !strings.EqualFold(actual, checksumSHA) {
		return fmt.Errorf("package checksum mismatch")
	}
	return nil
}

func copyWithLimit(dst io.Writer, src io.Reader, maxBytes int64) (int64, error) {
	if 0 >= maxBytes {
		return 0, fmt.Errorf("invalid size limit")
	}
	written, err := io.Copy(dst, io.LimitReader(src, maxBytes+1))
	if nil != err {
		return written, err
	}
	if written > maxBytes {
		return written, fmt.Errorf("download size exceeds limit [%d bytes]", maxBytes)
	}
	return written, nil
}

func hostNameFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if nil != err {
		return rawURL
	}
	if "" != u.Hostname() {
		return u.Hostname()
	}
	return rawURL
}

func UpsertBazaarSource(source *conf.BazaarSource) (*conf.BazaarSource, error) {
	if nil == source {
		return nil, fmt.Errorf("source is nil")
	}

	bazaarConnectLock.Lock()
	defer bazaarConnectLock.Unlock()

	ensureBazaarConfigReady()

	normalizedURL, err := normalizeBazaarSourceURL(source.URL)
	if nil != err {
		return nil, err
	}
	source.URL = normalizedURL
	source.Name = strings.TrimSpace(source.Name)
	if "" == source.Name {
		source.Name = hostNameFromURL(source.URL)
	}
	source.ID = strings.TrimSpace(source.ID)
	if "" == source.ID {
		source.ID = "source-" + gulu.Rand.String(10)
	}

	now := time.Now().UnixMilli()
	newSource := cloneBazaarSource(source, false)
	newSource.Token = strings.TrimSpace(newSource.Token)
	newSource.UpdatedAt = now
	if 0 == newSource.CreatedAt {
		newSource.CreatedAt = now
	}

	updated := false
	for idx, existing := range Conf.Bazaar.Sources {
		if nil == existing {
			continue
		}
		if existing.ID != newSource.ID {
			continue
		}
		if 0 == newSource.CreatedAt {
			newSource.CreatedAt = existing.CreatedAt
		}
		if bazaarMaskedSecret == newSource.Token {
			newSource.Token = existing.Token
		}
		Conf.Bazaar.Sources[idx] = newSource
		updated = true
		break
	}
	if !updated {
		if bazaarMaskedSecret == newSource.Token {
			newSource.Token = ""
		}
		Conf.Bazaar.Sources = append(Conf.Bazaar.Sources, newSource)
	}

	Conf.Bazaar.Normalize()
	Conf.Save()
	return cloneBazaarSource(newSource, true), nil
}

func RemoveBazaarSource(sourceID string) error {
	sourceID = strings.TrimSpace(sourceID)
	if "" == sourceID {
		return fmt.Errorf("source id is empty")
	}

	bazaarConnectLock.Lock()
	defer bazaarConnectLock.Unlock()

	ensureBazaarConfigReady()

	filtered := make([]*conf.BazaarSource, 0, len(Conf.Bazaar.Sources))
	removed := false
	for _, item := range Conf.Bazaar.Sources {
		if nil == item {
			continue
		}
		if item.ID == sourceID {
			removed = true
			continue
		}
		filtered = append(filtered, item)
	}
	if !removed {
		return fmt.Errorf("source [%s] not found", sourceID)
	}
	Conf.Bazaar.Sources = filtered
	Conf.Save()
	return nil
}

func getBazaarSourceByID(sourceID string) (*conf.BazaarSource, error) {
	ensureBazaarConfigReady()
	for _, item := range Conf.Bazaar.Sources {
		if nil == item {
			continue
		}
		if item.ID == sourceID {
			return item, nil
		}
	}
	return nil, fmt.Errorf("source [%s] not found", sourceID)
}

func fetchBazaarPublishedIndex(sourceURL, token string) (*BazaarPublishedIndex, error) {
	normalizedSourceURL, err := normalizeBazaarSourceURL(sourceURL)
	if nil != err {
		return nil, err
	}
	normalizedSourceURL = strings.TrimRight(normalizedSourceURL, "/")
	requestURL := normalizedSourceURL + bazaarPublishEndpointIndex

	req, err := http.NewRequest(http.MethodGet, requestURL, nil)
	if nil != err {
		return nil, err
	}
	token = strings.TrimSpace(token)
	if "" != token {
		req.Header.Set("X-Bazaar-Token", token)
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := newBazaarHTTPClient(12 * time.Second)
	resp, err := client.Do(req)
	if nil != err {
		return nil, err
	}
	defer resp.Body.Close()
	if http.StatusOK != resp.StatusCode {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("request bazaar index failed [%d]: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, bazaarIndexMaxBytes))
	if nil != err {
		return nil, err
	}

	ret := &BazaarPublishedIndex{}
	if err = gulu.JSON.UnmarshalJSON(data, ret); nil != err {
		return nil, err
	}
	if nil == ret.Packages {
		ret.Packages = []*BazaarPublishedItem{}
	} else {
		for _, item := range ret.Packages {
			if nil == item {
				continue
			}
			item.PackageType = normalizeBazaarPackageType(item.PackageType)
			item.PackageName = strings.TrimSpace(item.PackageName)
			item.Version = strings.TrimSpace(item.Version)
			item.ArtifactID = strings.TrimSpace(item.ArtifactID)
			item.ChecksumSHA = strings.ToLower(strings.TrimSpace(item.ChecksumSHA))
			item.DisplayName = strings.TrimSpace(item.DisplayName)
			item.Description = strings.TrimSpace(item.Description)
			item.Author = strings.TrimSpace(item.Author)
			item.DownloadPath = strings.TrimSpace(item.DownloadPath)
		}
	}
	return ret, nil
}

func TestBazaarSource(sourceURL, token string) (int, error) {
	index, err := fetchBazaarPublishedIndex(sourceURL, token)
	if nil != err {
		return 0, err
	}
	return len(index.Packages), nil
}

func TestBazaarSourceByID(sourceID string) (int, error) {
	sourceID = strings.TrimSpace(sourceID)
	if "" == sourceID {
		return 0, fmt.Errorf("source id is empty")
	}
	source, err := getBazaarSourceByID(sourceID)
	if nil != err {
		return 0, err
	}
	return TestBazaarSource(source.URL, source.Token)
}

func GetBazaarSourcePackages(sourceID string) (*BazaarPublishedIndex, error) {
	source, err := getBazaarSourceByID(sourceID)
	if nil != err {
		return nil, err
	}
	if !source.Enabled {
		return nil, fmt.Errorf("source [%s] is disabled", sourceID)
	}
	return fetchBazaarPublishedIndex(source.URL, source.Token)
}

func comparePackageVersion(v1, v2 string) int {
	normalized1 := normalizeVersion(v1)
	normalized2 := normalizeVersion(v2)
	if semver.IsValid(normalized1) && semver.IsValid(normalized2) {
		return semver.Compare(normalized1, normalized2)
	}
	if v1 == v2 {
		return 0
	}
	if v1 > v2 {
		return 1
	}
	return -1
}

func normalizeVersion(version string) string {
	version = strings.TrimSpace(version)
	if "" == version {
		return "v0.0.0"
	}
	if strings.HasPrefix(version, "v") {
		return version
	}
	return "v" + version
}

func getCurrentPublishedVersion(pkgType, packageName string) string {
	ensureBazaarConfigReady()
	latest := ""
	for _, record := range Conf.Bazaar.Publish.Records {
		if nil == record {
			continue
		}
		if record.PackageType != pkgType || record.PackageName != packageName {
			continue
		}
		if "" == latest || comparePackageVersion(record.Version, latest) > 0 {
			latest = record.Version
		}
	}
	return latest
}

func matchBazaarPublishRule(rule *conf.BazaarPublishRule, pkgType, packageName string) (matched bool, specificity int) {
	if nil == rule {
		return
	}
	ruleType := normalizeBazaarPackageType(rule.PackageType)
	ruleName := strings.TrimSpace(rule.PackageName)
	if "" != ruleType && ruleType != pkgType {
		return
	}
	if "" != ruleName && ruleName != packageName {
		return
	}
	specificity = 0
	if "" != ruleType {
		specificity += 2
	}
	if "" != ruleName {
		specificity++
	}
	matched = true
	return
}

func resolveBazaarPublishRule(pkgType, packageName string) (matched, enabled bool) {
	ensureBazaarConfigReady()
	pkgType = normalizeBazaarPackageType(pkgType)
	packageName = strings.TrimSpace(packageName)

	bestSpecificity := -1
	bestIdx := -1
	enabled = true
	for idx, rule := range Conf.Bazaar.Publish.Rules {
		ok, specificity := matchBazaarPublishRule(rule, pkgType, packageName)
		if !ok {
			continue
		}
		if specificity > bestSpecificity || (specificity == bestSpecificity && idx > bestIdx) {
			bestSpecificity = specificity
			bestIdx = idx
			enabled = rule.Enabled
			matched = true
		}
	}
	return
}

func isBazaarPublishAllowedByRule(pkgType, packageName string) bool {
	matched, enabled := resolveBazaarPublishRule(pkgType, packageName)
	if !matched {
		return true
	}
	return enabled
}

func isOfficialBazaarPackageName(pkgType, packageName string) bool {
	packageName = strings.TrimSpace(packageName)
	if "" == packageName {
		return false
	}
	for _, item := range bazaar.GetBazaarPackages(pkgType, "") {
		if nil == item {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(item.Name), packageName) {
			return true
		}
	}
	return false
}

func getPublishedPackageDir() string {
	return filepath.Join(util.DataDir, ".siyuan", "bazaar-publish", "packages")
}

func buildArtifactID(pkgType, pkgName, version string) string {
	seed := strings.Join([]string{
		pkgType,
		pkgName,
		version,
		util.CurrentTimeSecondsStr(),
		gulu.Rand.String(6),
	}, ":")
	sum := sha256.Sum256([]byte(seed))
	return hex.EncodeToString(sum[:8])
}

func hashFileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if nil != err {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err = io.Copy(hash, file); nil != err {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func PublishInstalledBazaarPackage(pkgType, packageName string) (*conf.BazaarPublishRecord, string, error) {
	bazaarConnectLock.Lock()
	defer bazaarConnectLock.Unlock()

	ensureBazaarConfigReady()
	if !Conf.Bazaar.Publish.Enabled {
		return nil, "", fmt.Errorf("bazaar publish is disabled")
	}

	pkgType = normalizeBazaarPackageType(pkgType)
	installedPkg, _, err := findInstalledPackageByName(pkgType, strings.TrimSpace(packageName))
	if nil != err {
		return nil, "", err
	}
	if nil == installedPkg {
		return nil, "", fmt.Errorf("%s package [%s] not found", pkgType, packageName)
	}
	if strings.TrimSpace(installedPkg.Version) == "" {
		return nil, "", fmt.Errorf("package [%s] version is empty", installedPkg.Name)
	}
	if !isBazaarPublishAllowedByRule(pkgType, installedPkg.Name) {
		return nil, "", fmt.Errorf("package [%s/%s] is blocked by publish rules", pkgType, installedPkg.Name)
	}

	latestVersion := getCurrentPublishedVersion(pkgType, installedPkg.Name)
	if "" != latestVersion && comparePackageVersion(installedPkg.Version, latestVersion) <= 0 {
		return nil, "", fmt.Errorf("version [%s] is not greater than published version [%s]", installedPkg.Version, latestVersion)
	}

	exportName, zipPath, err := ExportBazaarPackage(pkgType, installedPkg.Name)
	if nil != err {
		return nil, "", err
	}
	if strings.HasPrefix(zipPath, "/") {
		zipPath = filepath.Join(util.TempDir, strings.TrimPrefix(zipPath, "/"))
	}

	publishDir := getPublishedPackageDir()
	if err = os.MkdirAll(publishDir, 0755); nil != err {
		return nil, "", err
	}

	artifactID := buildArtifactID(pkgType, installedPkg.Name, installedPkg.Version)
	targetPath := filepath.Join(publishDir, artifactID+".zip")
	srcFile, err := os.Open(zipPath)
	if nil != err {
		return nil, "", err
	}
	defer srcFile.Close()
	dstFile, err := os.Create(targetPath)
	if nil != err {
		return nil, "", err
	}
	if _, err = io.Copy(dstFile, srcFile); nil != err {
		dstFile.Close()
		return nil, "", err
	}
	if err = dstFile.Close(); nil != err {
		return nil, "", err
	}

	fileSHA, err := hashFileSHA256(targetPath)
	if nil != err {
		return nil, "", err
	}

	record := &conf.BazaarPublishRecord{
		PackageType:  pkgType,
		PackageName:  installedPkg.Name,
		Version:      installedPkg.Version,
		ArtifactID:   artifactID,
		PublishedAt:  time.Now().UnixMilli(),
		ChecksumSHA:  fileSHA,
		DisplayName:  installedPkg.PreferredName,
		Description:  installedPkg.PreferredDesc,
		Author:       installedPkg.Author,
		OfficialName: isOfficialBazaarPackageName(pkgType, installedPkg.Name),
	}
	if "" == strings.TrimSpace(record.DisplayName) {
		record.DisplayName = installedPkg.Name
	}

	Conf.Bazaar.Publish.Records = append(Conf.Bazaar.Publish.Records, record)
	Conf.Save()

	warn := ""
	if record.OfficialName && !Conf.Bazaar.Publish.AllowOfficialNameCollision {
		warn = fmt.Sprintf("package name [%s] conflicts with official bazaar package, consider rename", record.PackageName)
	}
	_ = exportName
	return record, warn, nil
}

func buildBazaarPublishedIndex(public bool) *BazaarPublishedIndex {
	ensureBazaarConfigReady()
	ret := &BazaarPublishedIndex{
		UpdatedAt: time.Now().UnixMilli(),
		Packages:  []*BazaarPublishedItem{},
	}
	minExpose := public && Conf.Bazaar.Publish.MinExpose
	for _, record := range Conf.Bazaar.Publish.Records {
		if nil == record {
			continue
		}
		if public && !isBazaarPublishAllowedByRule(record.PackageType, record.PackageName) {
			continue
		}
		item := &BazaarPublishedItem{
			PackageType:  record.PackageType,
			PackageName:  record.PackageName,
			Version:      record.Version,
			ArtifactID:   record.ArtifactID,
			PublishedAt:  record.PublishedAt,
			ChecksumSHA:  record.ChecksumSHA,
			DisplayName:  record.DisplayName,
			Description:  record.Description,
			Author:       record.Author,
			OfficialName: record.OfficialName,
			DownloadPath: bazaarPublishEndpointDownload + record.ArtifactID,
		}
		if minExpose {
			item.Description = ""
			item.Author = ""
		}
		ret.Packages = append(ret.Packages, item)
	}
	sort.SliceStable(ret.Packages, func(i, j int) bool {
		if ret.Packages[i].PublishedAt == ret.Packages[j].PublishedAt {
			return ret.Packages[i].PackageName < ret.Packages[j].PackageName
		}
		return ret.Packages[i].PublishedAt > ret.Packages[j].PublishedAt
	})
	return ret
}

func GetBazaarPublishedIndex() *BazaarPublishedIndex {
	return buildBazaarPublishedIndex(false)
}

func GetBazaarPublicPublishedIndex() *BazaarPublishedIndex {
	return buildBazaarPublishedIndex(true)
}

func ResolveBazaarPublishedArtifact(artifactID string) (zipPath, downloadName string, err error) {
	ensureBazaarConfigReady()
	artifactID = strings.TrimSpace(artifactID)
	if "" == artifactID {
		err = fmt.Errorf("artifact id is empty")
		return
	}
	for _, record := range Conf.Bazaar.Publish.Records {
		if nil == record {
			continue
		}
		if record.ArtifactID != artifactID {
			continue
		}
		if !isBazaarPublishAllowedByRule(record.PackageType, record.PackageName) {
			continue
		}
		zipPath = filepath.Join(getPublishedPackageDir(), record.ArtifactID+".zip")
		downloadName = fmt.Sprintf("%s-%s.%s.zip", record.PackageName, record.Version, strings.TrimSuffix(record.PackageType, "s"))
		if !gulu.File.IsExist(zipPath) {
			err = fmt.Errorf("artifact [%s] not found on disk", artifactID)
		}
		return
	}
	err = fmt.Errorf("artifact [%s] not found", artifactID)
	return
}

func SetBazaarPublishConfig(publish *conf.BazaarPublish, security *conf.BazaarSecurity, hub *conf.BazaarHubPreference) {
	bazaarConnectLock.Lock()
	defer bazaarConnectLock.Unlock()

	ensureBazaarConfigReady()
	if nil != publish {
		oldToken := strings.TrimSpace(Conf.Bazaar.Publish.AuthToken)
		publish.AuthToken = strings.TrimSpace(publish.AuthToken)
		if bazaarMaskedSecret == publish.AuthToken {
			publish.AuthToken = oldToken
		}
		rules := make([]*conf.BazaarPublishRule, 0, len(publish.Rules))
		for _, rule := range publish.Rules {
			if nil == rule {
				continue
			}
			rules = append(rules, &conf.BazaarPublishRule{
				PackageType: normalizeBazaarPackageType(rule.PackageType),
				PackageName: strings.TrimSpace(rule.PackageName),
				Enabled:     rule.Enabled,
			})
		}
		publish.Rules = rules
		Conf.Bazaar.Publish = publish
	}
	if nil != security {
		Conf.Bazaar.Security = security
	}
	if nil != hub {
		Conf.Bazaar.Hub = hub
	}
	Conf.Bazaar.Normalize()
	Conf.Save()
}

func InstallBazaarPackageFromSource(sourceID, packageType, packageName, version string, themeMode int) (installedType, installedName string, err error) {
	source, err := getBazaarSourceByID(sourceID)
	if nil != err {
		return "", "", err
	}
	if !source.Enabled {
		return "", "", fmt.Errorf("source [%s] is disabled", sourceID)
	}
	if !source.AllowInstall {
		return "", "", fmt.Errorf("source [%s] disallows install", sourceID)
	}

	index, err := fetchBazaarPublishedIndex(source.URL, source.Token)
	if nil != err {
		return "", "", err
	}

	packageType = normalizeBazaarPackageType(packageType)
	packageName = strings.TrimSpace(packageName)
	version = strings.TrimSpace(version)

	var target *BazaarPublishedItem
	for _, item := range index.Packages {
		if nil == item {
			continue
		}
		if "" != packageType && item.PackageType != packageType {
			continue
		}
		if "" != packageName && item.PackageName != packageName {
			continue
		}
		if "" != version && item.Version != version {
			continue
		}
		if nil == target ||
			(comparePackageVersion(item.Version, target.Version) > 0) ||
			(item.Version == target.Version && item.PublishedAt > target.PublishedAt) {
			target = item
		}
	}
	if nil == target {
		return "", "", fmt.Errorf("package not found in source [%s]", sourceID)
	}

	downloadURL, err := resolveBazaarDownloadURL(source.URL, target)
	if nil != err {
		return "", "", err
	}

	req, err := http.NewRequest(http.MethodGet, downloadURL, nil)
	if nil != err {
		return "", "", err
	}
	if token := strings.TrimSpace(source.Token); "" != token {
		req.Header.Set("X-Bazaar-Token", token)
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := newBazaarHTTPClient(30 * time.Second)
	resp, err := client.Do(req)
	if nil != err {
		return "", "", err
	}
	defer resp.Body.Close()
	if http.StatusOK != resp.StatusCode {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return "", "", fmt.Errorf("download package failed [%d]: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	if resp.ContentLength > bazaarDownloadMaxBytes {
		return "", "", fmt.Errorf("download package exceeds size limit [%d bytes]", bazaarDownloadMaxBytes)
	}

	tmpDir := filepath.Join(util.TempDir, "import", "bazaar-remote")
	if err = os.MkdirAll(tmpDir, 0755); nil != err {
		return "", "", err
	}
	tmpZipPath := filepath.Join(tmpDir, "remote-"+gulu.Rand.String(14)+".zip")
	dst, err := os.Create(tmpZipPath)
	if nil != err {
		return "", "", err
	}
	if _, err = copyWithLimit(dst, resp.Body, bazaarDownloadMaxBytes); nil != err {
		dst.Close()
		return "", "", err
	}
	if err = dst.Close(); nil != err {
		return "", "", err
	}
	defer os.Remove(tmpZipPath)
	if err = verifyBazaarPackageChecksum(tmpZipPath, target.ChecksumSHA); nil != err {
		return "", "", err
	}

	return InstallBazaarPackageFromLocalZip(tmpZipPath, filepath.Base(tmpZipPath), target.PackageType, themeMode)
}
