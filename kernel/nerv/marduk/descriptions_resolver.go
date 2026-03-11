package marduk

import (
	"os"
	"path/filepath"
	"strings"
)

const sampleFileMarker = "_ipip120_sample_"

// ResolvePersonaSeedDescriptions 解析人格种子四轨描述。
// 描述源与人格档案分离：优先从原始问卷样本文件中加载描述。
// 对于预设人格（丽/薰/式波/Jarvis），返回预设描述；对于非预设人格，尝试加载对应的样本文件。
func ResolvePersonaSeedDescriptions(dataDir string, profile *IpipPersonaProfile) IpipPersonaSeedDescriptions {
	if profile == nil {
		return GetReiSubmissionPayload().Descriptions
	}

	id := strings.TrimSpace(profile.Subject.ID)
	lowerID := strings.ToLower(id)
	name := strings.TrimSpace(profile.Subject.Name)

	// 预设人格
	if lowerID == "rei" || name == "丽" {
		return GetReiSubmissionPayload().Descriptions
	}
	if lowerID == "kaoru" || name == "薰" {
		return GetKaoruSubmissionPayload().Descriptions
	}
	if lowerID == "shikinami" || name == "式波" || name == "式波明日香" {
		return GetShikinamiSubmissionPayload().Descriptions
	}
	if lowerID == "jarvis" || strings.EqualFold(name, "jarvis") || name == "贾维斯" {
		return GetJarvisSubmissionPayload().Descriptions
	}

	storage := NewStorage(dataDir)

	// 先按 active seed 指针定位当前生效样本。
	if samplePath, ok := resolveSamplePathFromActiveSeed(storage, id); ok {
		if descriptions, loaded := loadDescriptionsFromSamplePath(storage, samplePath); loaded {
			return descriptions
		}
	}

	// active seed 不可用时，回退到同 subject 的最新样本。
	if samplePath, ok := resolveLatestSamplePathBySubjectID(dataDir, id); ok {
		if descriptions, loaded := loadDescriptionsFromSamplePath(storage, samplePath); loaded {
			return descriptions
		}
	}

	// 加载失败，返回空描述
	return IpipPersonaSeedDescriptions{}
}

func resolveSamplePathFromActiveSeed(storage *Storage, subjectID string) (string, bool) {
	pointer, err := loadActiveSeedPointer(storage)
	if err != nil {
		return "", false
	}

	samplePath, ok := deriveSamplePathFromProfilePath(pointer.ActiveProfilePath)
	if !ok {
		return "", false
	}

	if subjectID == "" {
		return samplePath, true
	}

	sampleFileName := filepath.Base(strings.ReplaceAll(samplePath, "/", string(filepath.Separator)))
	sampleSubjectID, _, ok := parseIndexedJSONFileName(sampleFileName, sampleFileMarker)
	if !ok || !strings.EqualFold(sampleSubjectID, subjectID) {
		return "", false
	}
	return samplePath, true
}

func resolveLatestSamplePathBySubjectID(dataDir, subjectID string) (string, bool) {
	if strings.TrimSpace(subjectID) == "" {
		return "", false
	}

	privateDir := filepath.Join(dataDir, "private")
	entries, err := os.ReadDir(privateDir)
	if err != nil {
		return "", false
	}

	maxIndex := -1
	latestFileName := ""
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		fileSubjectID, index, ok := parseIndexedJSONFileName(entry.Name(), sampleFileMarker)
		if !ok || !strings.EqualFold(fileSubjectID, subjectID) {
			continue
		}
		if index > maxIndex {
			maxIndex = index
			latestFileName = entry.Name()
		}
	}

	if latestFileName == "" {
		return "", false
	}
	return privateDataPath + "/" + latestFileName, true
}

func loadDescriptionsFromSamplePath(storage *Storage, samplePath string) (IpipPersonaSeedDescriptions, bool) {
	payload, err := storage.LoadSubmissionPayload(samplePath)
	if err != nil {
		return IpipPersonaSeedDescriptions{}, false
	}
	return payload.Descriptions, true
}
