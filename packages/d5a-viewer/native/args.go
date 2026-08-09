package d5a

import (
	"fmt"
	"strconv"
	"strings"
)

type arguments struct {
	positionals []string
	values      map[string][]string
	flags       map[string]bool
}

func parseArguments(raw []string, valueNames, flagNames []string) (arguments, error) {
	valueSet := make(map[string]bool, len(valueNames))
	flagSet := make(map[string]bool, len(flagNames))
	for _, name := range valueNames {
		valueSet[name] = true
	}
	for _, name := range flagNames {
		flagSet[name] = true
	}
	result := arguments{values: map[string][]string{}, flags: map[string]bool{}}
	for index := 0; index < len(raw); index++ {
		item := raw[index]
		if item == "--" {
			result.positionals = append(result.positionals, raw[index+1:]...)
			break
		}
		if !strings.HasPrefix(item, "--") {
			result.positionals = append(result.positionals, item)
			continue
		}
		nameValue := strings.TrimPrefix(item, "--")
		name, inline, hasInline := strings.Cut(nameValue, "=")
		if flagSet[name] {
			if hasInline {
				return result, fmt.Errorf("--%s 不接受值", name)
			}
			result.flags[name] = true
			continue
		}
		if !valueSet[name] {
			return result, fmt.Errorf("未知参数 --%s", name)
		}
		value := inline
		if !hasInline {
			index++
			if index >= len(raw) || strings.HasPrefix(raw[index], "--") {
				return result, fmt.Errorf("--%s 需要值", name)
			}
			value = raw[index]
		}
		result.values[name] = append(result.values[name], value)
	}
	return result, nil
}

func (args arguments) one(name string) string {
	values := args.values[name]
	if len(values) == 0 {
		return ""
	}
	return values[len(values)-1]
}

func (args arguments) many(name string) []string {
	return append([]string(nil), args.values[name]...)
}

func parsePort(value string) (int, error) {
	port, errorValue := strconv.Atoi(value)
	if errorValue != nil || port < 1 || port > 65535 {
		return 0, fmt.Errorf("端口必须是 1 到 65535 之间的整数")
	}
	return port, nil
}
