package main

import (
	"fmt"
	"finance-game/internal/dmms/config"
	"finance-game/internal/dmms/database"
	"finance-game/internal/dmms/models"
)

func main() {
	cfg := config.Load()
	db, err := database.Open(cfg)
	if err != nil {
		fmt.Println("DB error:", err)
		return
	}

	var count int64
	db.Model(&models.Deliverable{}).Count(&count)
	fmt.Printf("Total deliverables: %d\n", count)
	
	var d []models.Deliverable
	db.Order("created_at desc").Limit(5).Find(&d)
	for _, del := range d {
		fmt.Printf("ID: %s, Title: %s, Created: %s\n", del.ID, del.Title, del.CreatedAt)
	}
}
