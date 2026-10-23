package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"strings"
)

const usage = `harbor-console - administration console for Harbor

Usage:
  harbor-console [options]

Options:
  -c, --config <file>  Configuration file (default: configs/config.local.yaml)
  -h, --help           Print this help and exit
      --version        Print version information and exit

Environment:
  CONFIG_FILE          Configuration file, used when --config is not given

Settings resolve as environment variables > YAML > built-in defaults; without
a configuration file the built-in defaults apply. Relative paths resolve
against the working directory.
`

type options struct {
	configFile string // empty: CONFIG_FILE or the default file
	help       bool
	version    bool
}

// parseArgs accepts -x and --x spellings, "--config file" and "--config=file".
func parseArgs(args []string) (options, error) {
	var o options
	flags := flag.NewFlagSet("harbor-console", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	setConfig := func(v string) error {
		if strings.TrimSpace(v) == "" {
			return errors.New("configuration path must not be empty")
		}
		if o.configFile != "" && o.configFile != v {
			return errors.New("-c and --config name different files")
		}
		o.configFile = v
		return nil
	}
	flags.Func("c", "", setConfig)
	flags.Func("config", "", setConfig)
	flags.BoolVar(&o.help, "h", false, "")
	flags.BoolVar(&o.help, "help", false, "")
	flags.BoolVar(&o.version, "version", false, "")
	if err := flags.Parse(args); err != nil {
		return options{}, err
	}
	if flags.NArg() > 0 {
		return options{}, fmt.Errorf("unexpected argument %q", flags.Arg(0))
	}
	return o, nil
}
