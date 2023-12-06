package main

import (
	"actors/core"
)

func main() {
	platform := core.NewPlatform()
	platform.Run(8080)
}
