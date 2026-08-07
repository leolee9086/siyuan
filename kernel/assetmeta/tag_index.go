package assetmeta

import (
	"errors"
	"strings"
)

// TagCount is the root-scoped count used by the file-browser tag tree.
type TagCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// GetTagCounts returns deterministic counts from the same asset index used by advanced search.
// An empty root list preserves the legacy data-root query semantics; callers that need every root
// must resolve that scope explicitly before invoking this function.
func GetTagCounts(rootIDs []string) ([]TagCount, error) {
	if indexDB == nil {
		return nil, errors.New("asset metadata index is not initialized")
	}
	query := strings.Builder{}
	query.WriteString(`SELECT t.tag, COUNT(*)
		FROM asset_tags t
		JOIN asset_meta m ON m.asset_key = t.asset_key
		WHERE TRIM(t.tag) <> ''`)
	args := make([]any, 0, len(rootIDs))
	if len(rootIDs) > 0 {
		placeholders := make([]string, len(rootIDs))
		for index, rootID := range rootIDs {
			placeholders[index] = "?"
			args = append(args, rootID)
		}
		query.WriteString(" AND m.root_id IN (" + strings.Join(placeholders, ",") + ")")
	}
	query.WriteString(" GROUP BY t.tag ORDER BY LOWER(t.tag), t.tag")
	rows, err := indexDB.Query(query.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]TagCount, 0)
	for rows.Next() {
		var item TagCount
		if err = rows.Scan(&item.Name, &item.Count); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
