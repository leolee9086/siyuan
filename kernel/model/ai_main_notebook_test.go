package model

import "testing"

func TestDeriveWorkspaceAIMainNotebookState(t *testing.T) {
	tests := []struct {
		name             string
		notebooks        []*Box
		expectedStatus   string
		expectedActiveID string
		expectedOpenCnt  int
		expectedAllCnt   int
	}{
		{
			name:           "missing",
			notebooks:      []*Box{{ID: "n1", Name: "普通笔记本", Closed: false}},
			expectedStatus: WorkspaceAIMainNotebookStatusMissing,
		},
		{
			name: "single ready even when closed",
			notebooks: []*Box{
				{ID: "ai1", Name: "AI", Closed: true, AIMainNotebook: true},
			},
			expectedStatus:   WorkspaceAIMainNotebookStatusReady,
			expectedActiveID: "ai1",
			expectedAllCnt:   1,
		},
		{
			name: "multiple ready with exactly one open",
			notebooks: []*Box{
				{ID: "ai1", Name: "AI-1", Closed: false, AIMainNotebook: true},
				{ID: "ai2", Name: "AI-2", Closed: true, AIMainNotebook: true},
			},
			expectedStatus:   WorkspaceAIMainNotebookStatusReady,
			expectedActiveID: "ai1",
			expectedOpenCnt:  1,
			expectedAllCnt:   2,
		},
		{
			name: "multiple conflict",
			notebooks: []*Box{
				{ID: "ai1", Name: "AI-1", Closed: false, AIMainNotebook: true},
				{ID: "ai2", Name: "AI-2", Closed: false, AIMainNotebook: true},
			},
			expectedStatus:  WorkspaceAIMainNotebookStatusConflict,
			expectedOpenCnt: 2,
			expectedAllCnt:  2,
		},
		{
			name: "multiple inactive",
			notebooks: []*Box{
				{ID: "ai1", Name: "AI-1", Closed: true, AIMainNotebook: true},
				{ID: "ai2", Name: "AI-2", Closed: true, AIMainNotebook: true},
			},
			expectedStatus: WorkspaceAIMainNotebookStatusInactive,
			expectedAllCnt: 2,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			state := deriveWorkspaceAIMainNotebookState(test.notebooks)
			if state.Status != test.expectedStatus {
				t.Fatalf("期望状态=%s，实际=%s", test.expectedStatus, state.Status)
			}
			if len(state.Notebooks) != test.expectedAllCnt {
				t.Fatalf("期望AI主笔记本数=%d，实际=%d", test.expectedAllCnt, len(state.Notebooks))
			}
			if len(state.OpenNotebooks) != test.expectedOpenCnt {
				t.Fatalf("期望打开AI主笔记本数=%d，实际=%d", test.expectedOpenCnt, len(state.OpenNotebooks))
			}
			activeID := ""
			if state.ActiveNotebook != nil {
				activeID = state.ActiveNotebook.ID
			}
			if activeID != test.expectedActiveID {
				t.Fatalf("期望活动AI主笔记本=%s，实际=%s", test.expectedActiveID, activeID)
			}
		})
	}
}
