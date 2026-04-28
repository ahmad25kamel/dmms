package main

import (
	"fmt"
	"finance-game/internal/dmms/config"
	"finance-game/internal/dmms/database"
)

func main() {
	cfg := config.Load()
	db, err := database.Open(cfg)
	if err != nil {
		fmt.Println("DB error:", err)
		return
	}

	type Column struct {
		Field string
		Type  string
	}
	var columns []Column
	db.Raw("SHOW COLUMNS FROM dmms_deliverables").Scan(&columns)
	for _, c := range columns {
		if c.Field == "brief" || c.Field == "scope" || c.Field == "acceptance_criteria" {
			fmt.Printf("%s: %s\n", c.Field, c.Type)
		}
	}
}
