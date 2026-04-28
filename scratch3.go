package main

import (
	"fmt"
	"finance-game/internal/dmms/config"
	"finance-game/internal/dmms/database"
)

func main() {
	cfg := config.Load()
	_, err := database.Open(cfg)
	if err != nil {
		fmt.Println("DB error:", err)
		return
	}
	fmt.Println("Migration successful")
}
