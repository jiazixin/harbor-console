package main

import (
	"flag"
	"fmt"
	"io"
	"strings"
)

type cliOptions struct {
	ConfigPath string
	Help       bool
	Version    bool
}

const usageText = `harbor-console — Harbor 管理控制台
用法：harbor-console [-c config.yaml | --config config.yaml]
  -c, --config  指定 YAML 配置文件（优先于 CONFIG_FILE）
  -h, --help    显示帮助
      --version 显示版本、提交与构建时间
未指定配置文件时读取 CONFIG_FILE；未设置时读取可选的 configs/config.local.yaml。
相对配置路径以当前工作目录为基准；配置字段优先级：环境变量 > YAML > 内置默认值。
`

func parseArgs(args []string) (cliOptions, error) {
	var options cliOptions
	flags := flag.NewFlagSet("harbor-console", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	setConfig := func(value string) error {
		value = strings.TrimSpace(value)
		if value == "" {
			return fmt.Errorf("配置文件路径不能为空")
		}
		if options.ConfigPath != "" && options.ConfigPath != value {
			return fmt.Errorf("多次指定的配置文件路径不一致")
		}
		options.ConfigPath = value
		return nil
	}
	flags.Func("c", "配置文件路径", setConfig)
	flags.Func("config", "配置文件路径", setConfig)
	flags.BoolVar(&options.Help, "h", false, "显示帮助")
	flags.BoolVar(&options.Help, "help", false, "显示帮助")
	flags.BoolVar(&options.Version, "version", false, "显示版本")
	if err := flags.Parse(args); err != nil {
		return cliOptions{}, err
	}
	if flags.NArg() > 0 {
		return cliOptions{}, fmt.Errorf("不接受额外位置参数")
	}
	return options, nil
}
