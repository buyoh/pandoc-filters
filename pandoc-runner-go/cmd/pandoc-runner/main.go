// main.go は pandoc-runner-go のエントリポイント。
package main

import (
	"flag"
	"fmt"
	"os"

	"pandoc-runner-go/internal/logger"
	"pandoc-runner-go/internal/server"
)

const version = "1.0.0"

func main() {
	socketPath := flag.String("socket", server.DefaultSocketPath, "Unix socket path")
	verbose := flag.Bool("verbose", false, "Verbose logging (debug level)")
	quiet := flag.Bool("quiet", false, "Quiet logging (warn level)")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Printf("pandoc-runner-go %s\n", version)
		os.Exit(0)
	}

	logLevel := logger.LevelInfo
	if *verbose {
		logLevel = logger.LevelDebug
	} else if *quiet {
		logLevel = logger.LevelWarn
	}

	log := logger.New(logLevel)
	srv := server.NewPandocRunnerServer(*socketPath, log)

	if err := srv.Start(); err != nil {
		log.Error("Server error: " + err.Error())
		os.Exit(1)
	}
}
