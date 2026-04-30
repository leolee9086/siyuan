package model

import (
	"errors"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/treenode"
)

const (
	WorkspaceAIMainNotebookStatusMissing  = "missing"
	WorkspaceAIMainNotebookStatusReady    = "ready"
	WorkspaceAIMainNotebookStatusConflict = "conflict"
	WorkspaceAIMainNotebookStatusInactive = "inactive"

	DefaultWorkspaceAIMainNotebookName = "AI主笔记本"
)

var (
	ErrWorkspaceAIMainNotebookMissing  = errors.New("workspace ai main notebook missing")
	ErrWorkspaceAIMainNotebookConflict = errors.New("multiple ai main notebooks are open")
	ErrWorkspaceAIMainNotebookInactive = errors.New("workspace ai main notebook is inactive")
)

type WorkspaceAIMainNotebookState struct {
	Status         string `json:"status"`
	Notebooks      []*Box `json:"notebooks"`
	OpenNotebooks  []*Box `json:"openNotebooks"`
	ActiveNotebook *Box   `json:"activeNotebook,omitempty"`
}

type WorkspaceAIMainNotebookAccessScope struct {
	State             *WorkspaceAIMainNotebookState `json:"state"`
	ActiveNotebook    *Box                          `json:"activeNotebook,omitempty"`
	AccessibleRootIDs map[string]struct{}           `json:"-"`
	ReferencedRootIDs map[string]struct{}           `json:"-"`
}

func cloneWorkspaceAIMainNotebookBox(box *Box) *Box {
	if box == nil {
		return nil
	}
	cloned := *box
	return &cloned
}

func deriveWorkspaceAIMainNotebookState(notebooks []*Box) *WorkspaceAIMainNotebookState {
	state := &WorkspaceAIMainNotebookState{
		Status:        WorkspaceAIMainNotebookStatusMissing,
		Notebooks:     []*Box{},
		OpenNotebooks: []*Box{},
	}
	for _, notebook := range notebooks {
		if notebook == nil || !notebook.AIMainNotebook {
			continue
		}
		cloned := cloneWorkspaceAIMainNotebookBox(notebook)
		state.Notebooks = append(state.Notebooks, cloned)
		if !cloned.Closed {
			state.OpenNotebooks = append(state.OpenNotebooks, cloneWorkspaceAIMainNotebookBox(cloned))
		}
	}

	switch len(state.Notebooks) {
	case 0:
		state.Status = WorkspaceAIMainNotebookStatusMissing
		return state
	case 1:
		state.Status = WorkspaceAIMainNotebookStatusReady
		state.ActiveNotebook = cloneWorkspaceAIMainNotebookBox(state.Notebooks[0])
		return state
	}

	switch len(state.OpenNotebooks) {
	case 0:
		state.Status = WorkspaceAIMainNotebookStatusInactive
	case 1:
		state.Status = WorkspaceAIMainNotebookStatusReady
		state.ActiveNotebook = cloneWorkspaceAIMainNotebookBox(state.OpenNotebooks[0])
	default:
		state.Status = WorkspaceAIMainNotebookStatusConflict
	}
	return state
}

func GetWorkspaceAIMainNotebookState() (*WorkspaceAIMainNotebookState, error) {
	notebooks, err := ListNotebooks()
	if err != nil {
		return nil, err
	}
	return deriveWorkspaceAIMainNotebookState(notebooks), nil
}

func workspaceAIMainNotebookStateError(state *WorkspaceAIMainNotebookState) error {
	if state == nil {
		return ErrWorkspaceAIMainNotebookMissing
	}
	switch state.Status {
	case WorkspaceAIMainNotebookStatusConflict:
		return ErrWorkspaceAIMainNotebookConflict
	case WorkspaceAIMainNotebookStatusInactive:
		return ErrWorkspaceAIMainNotebookInactive
	default:
		return ErrWorkspaceAIMainNotebookMissing
	}
}

func ResolveActiveWorkspaceAIMainNotebook() (*Box, *WorkspaceAIMainNotebookState, error) {
	state, err := GetWorkspaceAIMainNotebookState()
	if err != nil {
		return nil, nil, err
	}
	if state.ActiveNotebook != nil && state.Status == WorkspaceAIMainNotebookStatusReady {
		return cloneWorkspaceAIMainNotebookBox(state.ActiveNotebook), state, nil
	}
	return nil, state, workspaceAIMainNotebookStateError(state)
}

func CreateWorkspaceAIMainNotebook(name string) (*Box, bool, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = DefaultWorkspaceAIMainNotebookName
	}

	id, err := CreateBox(name)
	if err != nil {
		return nil, false, err
	}

	box := Conf.GetBox(id)
	if box == nil {
		box = &Box{ID: id, Name: name}
	}
	boxConf := box.GetConf()
	boxConf.Name = name
	boxConf.AIMainNotebook = true
	box.SaveConf(boxConf)
	box.AIMainNotebook = true

	alreadyMount, err := Mount(id)
	if err != nil {
		return nil, false, err
	}

	if openedBox := Conf.Box(id); openedBox != nil {
		openedBox.AIMainNotebook = true
		return cloneWorkspaceAIMainNotebookBox(openedBox), alreadyMount, nil
	}
	return cloneWorkspaceAIMainNotebookBox(box), alreadyMount, nil
}

func ResolveWorkspaceAIMainNotebookAccessScope() (*WorkspaceAIMainNotebookAccessScope, error) {
	activeNotebook, state, err := ResolveActiveWorkspaceAIMainNotebook()
	scope := &WorkspaceAIMainNotebookAccessScope{
		State:             state,
		ActiveNotebook:    cloneWorkspaceAIMainNotebookBox(activeNotebook),
		AccessibleRootIDs: map[string]struct{}{},
		ReferencedRootIDs: map[string]struct{}{},
	}
	if err != nil {
		return scope, err
	}

	for _, blockTree := range treenode.GetBlockTreesByBoxID(activeNotebook.ID) {
		if blockTree == nil || blockTree.Type != "d" {
			continue
		}
		rootID := strings.TrimSpace(blockTree.RootID)
		if rootID == "" {
			rootID = strings.TrimSpace(blockTree.ID)
		}
		if rootID == "" {
			continue
		}
		scope.AccessibleRootIDs[rootID] = struct{}{}
	}

	notebooks, listErr := ListNotebooks()
	if listErr == nil {
		for _, box := range notebooks {
			if box == nil || !IsUserGuide(box.ID) {
				continue
			}
			for _, blockTree := range treenode.GetBlockTreesByBoxID(box.ID) {
				if blockTree == nil || blockTree.Type != "d" {
					continue
				}
				rootID := strings.TrimSpace(blockTree.RootID)
				if rootID == "" {
					rootID = strings.TrimSpace(blockTree.ID)
				}
				if rootID == "" {
					continue
				}
				scope.AccessibleRootIDs[rootID] = struct{}{}
			}
		}
	}

	for _, rootID := range sql.QueryDefRootIDsByRefBox(activeNotebook.ID) {
		rootID = strings.TrimSpace(rootID)
		if rootID == "" {
			continue
		}
		scope.AccessibleRootIDs[rootID] = struct{}{}
		scope.ReferencedRootIDs[rootID] = struct{}{}
	}
	return scope, nil
}
