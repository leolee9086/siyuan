package config

import (
	"testing"
)

func TestWebToolDefinitionsAreReadOnlyAndAvailableInWorkHeartbeat(t *testing.T) {
	tools := []ToolDef{
		BuildSearchWebToolDef(),
		BuildFetchWebPageToolDef(),
		BuildInspectWebSearchEnginesToolDef(),
	}
	for _, tool := range tools {
		if tool.Type != "function" {
			t.Fatalf("%s must be a function tool", tool.Function.Name)
		}
		if !tool.Meta.ReadsWebContent || !tool.Meta.AvailableDirectReply || !tool.Meta.AvailableWorkHB {
			t.Fatalf("%s must be a direct/work-heartbeat web read tool: %+v", tool.Function.Name, tool.Meta)
		}
		if tool.Meta.RequiresPeerVote || tool.Meta.ModifiesNotes || tool.Meta.ModifiesFilesystem {
			t.Fatalf("%s must not be an action tool: %+v", tool.Function.Name, tool.Meta)
		}
	}

	fetch := BuildFetchWebPageToolDef()
	properties := fetch.Function.Parameters["properties"].(map[string]interface{})
	format := properties["format"].(map[string]interface{})
	if format["type"] != "string" {
		t.Fatalf("fetch format must be a string: %+v", format)
	}
}

func TestDefaultCoreSageToolsExposeAllWebTools(t *testing.T) {
	tools := buildDefaultCoreSageTools()
	want := map[string]bool{
		SearchWebToolName:               false,
		FetchWebPageToolName:            false,
		InspectWebSearchEnginesToolName: false,
	}
	for _, tool := range tools {
		if _, ok := want[tool.Function.Name]; ok {
			want[tool.Function.Name] = true
		}
	}
	for name, found := range want {
		if !found {
			t.Fatalf("default sage tools missing %s", name)
		}
	}
}
