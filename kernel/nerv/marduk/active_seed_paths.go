package marduk

import (
	"encoding/json"
	"fmt"
	"path"
	"strconv"
	"strings"

	"github.com/siyuan-note/filelock"
)

const (
	activeSeedPointerPath = "/data/private/magi_active_persona_seed.json"
	privateDataPath       = "/data/private"
)

type activeSeedPointer struct {
	SchemaVersion     string `json:"schemaVersion"`
	ActiveProfilePath string `json:"activeProfilePath"`
	UpdatedAt         string `json:"updatedAt"`
}

func loadActiveSeedPointer(storage *Storage) (*activeSeedPointer, error) {
	if storage == nil {
		return nil, fmt.Errorf("storage is nil")
	}

	pointerAbsPath := storage.resolveFullPath(activeSeedPointerPath)
	data, err := filelock.ReadFile(pointerAbsPath)
	if err != nil {
		return nil, fmt.Errorf("read active seed pointer failed: %w", err)
	}

	var pointer activeSeedPointer
	if err := json.Unmarshal(data, &pointer); err != nil {
		return nil, fmt.Errorf("parse active seed pointer failed: %w", err)
	}

	pointer.ActiveProfilePath = strings.TrimSpace(pointer.ActiveProfilePath)
	if pointer.ActiveProfilePath == "" {
		return nil, fmt.Errorf("activeProfilePath is empty")
	}
	return &pointer, nil
}

func deriveSamplePathFromProfilePath(profilePath string) (string, bool) {
	normalized := strings.ReplaceAll(strings.TrimSpace(profilePath), "\\", "/")
	profileFileName := path.Base(normalized)
	subjectID, index, ok := parseIndexedJSONFileName(profileFileName, "_persona_profile_")
	if !ok {
		return "", false
	}
	return buildSamplePath(subjectID, index), true
}

func buildSamplePath(subjectID string, index int) string {
	return fmt.Sprintf("%s/%s_ipip120_sample_%d.json", privateDataPath, subjectID, index)
}

func parseIndexedJSONFileName(fileName, marker string) (subjectID string, index int, ok bool) {
	if marker == "" || !strings.HasSuffix(fileName, ".json") {
		return "", 0, false
	}

	baseName := strings.TrimSuffix(fileName, ".json")
	separatorPos := strings.LastIndex(baseName, marker)
	if separatorPos <= 0 {
		return "", 0, false
	}

	idPart := strings.TrimSpace(baseName[:separatorPos])
	if idPart == "" {
		return "", 0, false
	}

	indexPart := strings.TrimSpace(baseName[separatorPos+len(marker):])
	n, err := strconv.Atoi(indexPart)
	if err != nil || n <= 0 {
		return "", 0, false
	}

	return idPart, n, true
}
