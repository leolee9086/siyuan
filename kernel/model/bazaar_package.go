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
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/siyuan-note/filelock"
	"github.com/siyuan-note/siyuan/kernel/bazaar"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type bazaarPackageSpec struct {
	ManifestFile  string
	ArchiveSuffix string
}

var bazaarPackageSpecs = map[string]bazaarPackageSpec{
	"plugins": {
		ManifestFile:  "plugin.json",
		ArchiveSuffix: ".plugin.zip",
	},
	"themes": {
		ManifestFile:  "theme.json",
		ArchiveSuffix: ".theme.zip",
	},
	"icons": {
		ManifestFile:  "icon.json",
		ArchiveSuffix: ".icon.zip",
	},
	"templates": {
		ManifestFile:  "template.json",
		ArchiveSuffix: ".template.zip",
	},
	"widgets": {
		ManifestFile:  "widget.json",
		ArchiveSuffix: ".widget.zip",
	},
}

var orderedBazaarPackageTypes = []string{
	"plugins",
	"themes",
	"icons",
	"templates",
	"widgets",
}

const (
	bazaarArchiveMaxBytes           int64 = 200 * 1024 * 1024
	bazaarArchiveMaxEntries               = 4096
	bazaarArchiveMaxSingleFileBytes int64 = 64 * 1024 * 1024
	bazaarArchiveMaxUnzipBytes      int64 = 600 * 1024 * 1024
)

func getBazaarPackageSpec(pkgType string) (ret bazaarPackageSpec, ok bool) {
	ret, ok = bazaarPackageSpecs[pkgType]
	return
}

func normalizeBazaarPackageType(pkgType string) string {
	return strings.ToLower(strings.TrimSpace(pkgType))
}

// DetectBazaarPackageTypeByArchiveName 通过集市包扩展名快速识别包类型。
func DetectBazaarPackageTypeByArchiveName(fileName string) string {
	lower := strings.ToLower(strings.TrimSpace(fileName))
	for _, pkgType := range orderedBazaarPackageTypes {
		spec := bazaarPackageSpecs[pkgType]
		if strings.HasSuffix(lower, spec.ArchiveSuffix) {
			return pkgType
		}
	}
	return ""
}

func detectBazaarPackageTypeByManifest(packageRoot string) (string, error) {
	var candidates []string
	for _, pkgType := range orderedBazaarPackageTypes {
		spec := bazaarPackageSpecs[pkgType]
		if filelock.IsExist(filepath.Join(packageRoot, spec.ManifestFile)) {
			candidates = append(candidates, pkgType)
		}
	}
	switch len(candidates) {
	case 0:
		return "", fmt.Errorf("invalid bazaar package: manifest file not found")
	case 1:
		return candidates[0], nil
	default:
		sort.Strings(candidates)
		return "", fmt.Errorf("invalid bazaar package: ambiguous package type [%s]", strings.Join(candidates, ", "))
	}
}

func resolveBazaarPackageRoot(unzipPath string) (string, error) {
	entries, err := os.ReadDir(unzipPath)
	if err != nil {
		return "", err
	}
	if 1 > len(entries) {
		return "", fmt.Errorf("invalid bazaar package: no file found")
	}

	if 1 == len(entries) && entries[0].IsDir() {
		return filepath.Join(unzipPath, entries[0].Name()), nil
	}
	return unzipPath, nil
}

func normalizeBazaarExportName(name string) string {
	name = util.FilterFileName(name)
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.TrimSpace(name)
	if "" == name {
		name = "bazaar-package"
	}
	return name
}

func validateBazaarZipSafety(zipPath string) error {
	stat, err := os.Stat(zipPath)
	if nil != err {
		return err
	}
	if stat.Size() > bazaarArchiveMaxBytes {
		return fmt.Errorf("bazaar package archive exceeds limit [%d bytes]", bazaarArchiveMaxBytes)
	}

	reader, err := zip.OpenReader(zipPath)
	if nil != err {
		return err
	}
	defer reader.Close()

	if 1 > len(reader.File) {
		return fmt.Errorf("invalid bazaar package: no file found")
	}
	if len(reader.File) > bazaarArchiveMaxEntries {
		return fmt.Errorf("bazaar package archive has too many files [%d > %d]", len(reader.File), bazaarArchiveMaxEntries)
	}

	var totalUnzipBytes int64
	for _, file := range reader.File {
		if nil == file || file.FileInfo().IsDir() {
			continue
		}
		fileBytes := int64(file.UncompressedSize64)
		if fileBytes > bazaarArchiveMaxSingleFileBytes {
			return fmt.Errorf("bazaar package file [%s] exceeds limit [%d bytes]", file.Name, bazaarArchiveMaxSingleFileBytes)
		}
		totalUnzipBytes += fileBytes
		if totalUnzipBytes > bazaarArchiveMaxUnzipBytes {
			return fmt.Errorf("bazaar package unzip size exceeds limit [%d bytes]", bazaarArchiveMaxUnzipBytes)
		}
	}
	return nil
}

func validateBazaarPackageDirectory(pkgType, packageRoot string) (ret *bazaar.Package, err error) {
	spec, ok := getBazaarPackageSpec(pkgType)
	if !ok {
		return nil, fmt.Errorf("invalid package type: %s", pkgType)
	}

	manifestPath := filepath.Join(packageRoot, spec.ManifestFile)
	if !filelock.IsExist(manifestPath) {
		return nil, fmt.Errorf("invalid %s package: missing %s", pkgType, spec.ManifestFile)
	}

	ret, err = bazaar.ParsePackageJSON(manifestPath)
	if err != nil || nil == ret {
		if nil == err {
			err = fmt.Errorf("parse package metadata failed")
		}
		return nil, fmt.Errorf("invalid %s package: %w", pkgType, err)
	}

	ret.Name = strings.TrimSpace(ret.Name)
	ret.Version = strings.TrimSpace(ret.Version)
	if "" == ret.Name {
		return nil, fmt.Errorf("invalid %s package: name is empty", pkgType)
	}
	if !util.IsValidUploadFileName(ret.Name) {
		return nil, fmt.Errorf("invalid %s package [%s]: invalid package name", pkgType, ret.Name)
	}
	if "" == ret.Version {
		return nil, fmt.Errorf("invalid %s package [%s]: version is empty", pkgType, ret.Name)
	}

	if "themes" == pkgType {
		if !filelock.IsExist(filepath.Join(packageRoot, "theme.css")) {
			return nil, fmt.Errorf("invalid theme package [%s]: missing theme.css", ret.Name)
		}
	}
	return
}

func validateInstalledBazaarPackage(pkgType, installPath, packageName string) (*bazaar.Package, error) {
	pkg, err := validateBazaarPackageDirectory(pkgType, installPath)
	if err != nil {
		return nil, err
	}
	if pkg.Name != packageName {
		return nil, fmt.Errorf("invalid %s package: package name mismatch [%s != %s]", pkgType, pkg.Name, packageName)
	}
	return pkg, nil
}

func findInstalledPackageByName(pkgType, packageName string) (pkg *bazaar.Package, installPath string, err error) {
	installedInfos, basePath, _, err := GetInstalledPackageInfos(pkgType)
	if err != nil {
		return
	}
	for _, info := range installedInfos {
		if info.Pkg.Name != packageName && info.DirName != packageName {
			continue
		}
		return info.Pkg, filepath.Join(basePath, info.DirName), nil
	}
	return nil, "", fmt.Errorf("%s package [%s] is not installed", pkgType, packageName)
}

// ExportBazaarPackage 导出本地已安装集市包为 zip。
func ExportBazaarPackage(pkgType, packageName string) (name, zipPath string, err error) {
	pkgType = normalizeBazaarPackageType(pkgType)
	spec, ok := getBazaarPackageSpec(pkgType)
	if !ok {
		return "", "", fmt.Errorf("invalid package type: %s", pkgType)
	}

	packageName = strings.TrimSpace(packageName)
	if "" == packageName {
		return "", "", fmt.Errorf("package name is empty")
	}

	installedPkg, installPath, err := findInstalledPackageByName(pkgType, packageName)
	if err != nil {
		return "", "", err
	}
	if _, err = validateInstalledBazaarPackage(pkgType, installPath, installedPkg.Name); err != nil {
		return "", "", err
	}

	exportName := normalizeBazaarExportName(installedPkg.Name) + "-" + util.CurrentTimeSecondsStr() + spec.ArchiveSuffix
	exportDir := filepath.Join(util.TempDir, "export")
	if err = os.MkdirAll(exportDir, 0755); err != nil {
		return "", "", err
	}
	zipAbsPath := filepath.Join(exportDir, exportName)

	zipFile, err := gulu.Zip.Create(zipAbsPath)
	if err != nil {
		return "", "", err
	}

	if err = zipFile.AddDirectory(installedPkg.Name, installPath); err != nil {
		zipFile.Close()
		return "", "", err
	}
	if err = zipFile.Close(); err != nil {
		return "", "", err
	}
	return exportName, "/export/" + exportName, nil
}

// InstallBazaarPackageFromLocalZip 安装本地集市包压缩文件。
func InstallBazaarPackageFromLocalZip(zipPath, originalFilename, packageType string, themeMode int) (installedType, packageName string, err error) {
	packageType = normalizeBazaarPackageType(packageType)
	if "" != packageType {
		if _, ok := getBazaarPackageSpec(packageType); !ok {
			return "", "", fmt.Errorf("invalid package type: %s", packageType)
		}
	}

	typeByExt := DetectBazaarPackageTypeByArchiveName(originalFilename)
	if "" != packageType && "" != typeByExt && packageType != typeByExt {
		return "", "", fmt.Errorf("invalid bazaar package: package type [%s] does not match file extension [%s]", packageType, typeByExt)
	}

	tmpExtractDir := filepath.Join(util.TempDir, "import", "bazaar", gulu.Rand.String(7))
	if err = os.MkdirAll(tmpExtractDir, 0755); err != nil {
		return "", "", err
	}
	defer os.RemoveAll(tmpExtractDir)

	if err = validateBazaarZipSafety(zipPath); nil != err {
		return "", "", err
	}

	if err = gulu.Zip.Unzip(zipPath, tmpExtractDir); err != nil {
		return "", "", fmt.Errorf("extract bazaar package failed: %w", err)
	}
	packageRoot, err := resolveBazaarPackageRoot(tmpExtractDir)
	if err != nil {
		return "", "", err
	}

	installedType = packageType
	if "" == installedType {
		installedType = typeByExt
	}
	if "" == installedType {
		installedType, err = detectBazaarPackageTypeByManifest(packageRoot)
		if nil != err {
			return "", "", err
		}
	}

	pkg, err := validateBazaarPackageDirectory(installedType, packageRoot)
	if err != nil {
		return "", "", err
	}
	packageName = pkg.Name

	if "" != typeByExt && typeByExt != installedType {
		return "", "", fmt.Errorf("invalid bazaar package: file extension indicates [%s], but package content is [%s]", typeByExt, installedType)
	}

	installPath, jsonFileName, err := getPackageInstallPath(installedType, packageName)
	if err != nil {
		return "", "", err
	}

	installedPkg, parseErr := bazaar.ParsePackageJSON(filepath.Join(installPath, jsonFileName))
	update := parseErr == nil && installedPkg != nil && installedPkg.Name == packageName

	if err = filelock.Copy(packageRoot, installPath); err != nil {
		return "", "", err
	}
	if _, err = validateInstalledBazaarPackage(installedType, installPath, packageName); err != nil {
		return "", "", err
	}

	now := time.Now()
	_ = os.Chtimes(installPath, now, now)
	bazaar.SetPackageInstallTime(installedType, packageName, now)

	finishInstall(installedType, []batchInstallItem{{name: packageName, meta: installMeta{update: update}}}, &ThemeInstallOptions{Mode: themeMode}, false)
	return
}
