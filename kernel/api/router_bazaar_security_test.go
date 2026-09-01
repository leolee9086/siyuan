// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package api

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"runtime"
	"strconv"
	"testing"
)

func TestBazaarReadRoutesRequireAdmin(t *testing.T) {
	_, sourceFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("test source location is unavailable")
	}
	parsed, err := parser.ParseFile(token.NewFileSet(), filepath.Join(filepath.Dir(sourceFile), "router.go"), nil, 0)
	if err != nil {
		t.Fatal(err)
	}

	expected := map[string][]string{
		"/api/bazaar/getBazaarPlugin":         {"model.CheckAuth", "model.CheckAdminRole", "getBazaarPlugin"},
		"/api/bazaar/getInstalledPlugin":      {"model.CheckAuth", "model.CheckAdminRole", "getInstalledPlugin"},
		"/api/bazaar/getBazaarWidget":         {"model.CheckAuth", "model.CheckAdminRole", "getBazaarWidget"},
		"/api/bazaar/getInstalledWidget":      {"model.CheckAuth", "model.CheckAdminRole", "getInstalledWidget"},
		"/api/bazaar/getBazaarIcon":           {"model.CheckAuth", "model.CheckAdminRole", "getBazaarIcon"},
		"/api/bazaar/getInstalledIcon":        {"model.CheckAuth", "model.CheckAdminRole", "getInstalledIcon"},
		"/api/bazaar/getBazaarTemplate":       {"model.CheckAuth", "model.CheckAdminRole", "getBazaarTemplate"},
		"/api/bazaar/getInstalledTemplate":    {"model.CheckAuth", "model.CheckAdminRole", "getInstalledTemplate"},
		"/api/bazaar/getBazaarTheme":          {"model.CheckAuth", "model.CheckAdminRole", "getBazaarTheme"},
		"/api/bazaar/getInstalledTheme":       {"model.CheckAuth", "model.CheckAdminRole", "getInstalledTheme"},
		"/api/bazaar/getBazaarPackageREADME":  {"model.CheckAuth", "model.CheckAdminRole", "getBazaarPackageREADME"},
		"/api/bazaar/getInstalledPackageSize": {"model.CheckAuth", "model.CheckAdminRole", "getInstalledPackageSize"},
		"/api/bazaar/getBazaarPackage":        {"model.CheckAuth", "model.CheckAdminRole", "getBazaarPackage"},
		"/api/bazaar/getUpdatedPackage":       {"model.CheckAuth", "model.CheckAdminRole", "getUpdatedPackage"},
	}
	found := map[string][]string{}
	ast.Inspect(parsed, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok || len(call.Args) < 3 {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || selector.Sel.Name != "Handle" {
			return true
		}
		pathLiteral, ok := call.Args[1].(*ast.BasicLit)
		if !ok || pathLiteral.Kind != token.STRING {
			return true
		}
		pathValue, err := strconv.Unquote(pathLiteral.Value)
		if err != nil || expected[pathValue] == nil {
			return true
		}
		for _, expression := range call.Args[2:] {
			found[pathValue] = append(found[pathValue], bazaarRouteHandlerName(expression))
		}
		return true
	})

	for path, wanted := range expected {
		got := found[path]
		if len(got) != len(wanted) {
			t.Fatalf("%s handlers = %v, want %v", path, got, wanted)
		}
		for index := range wanted {
			if got[index] != wanted[index] {
				t.Fatalf("%s handlers = %v, want %v", path, got, wanted)
			}
		}
	}
}

func bazaarRouteHandlerName(expression ast.Expr) string {
	switch value := expression.(type) {
	case *ast.Ident:
		return value.Name
	case *ast.SelectorExpr:
		if qualifier, ok := value.X.(*ast.Ident); ok {
			return qualifier.Name + "." + value.Sel.Name
		}
	}
	return ""
}
