package config

import (
	"log"
	"os"
)

type Config struct {
	DBPath    string
	JWTSecret string
	Port      string
}

func Load() *Config {
	secret := os.Getenv("DMMS_JWT_SECRET")
	if secret == "" {
		log.Fatal("DMMS_JWT_SECRET environment variable is required")
	}
	port := os.Getenv("DMMS_PORT")
	if port == "" {
		port = "3005"
	}
	dbPath := os.Getenv("DMMS_DB_PATH")
	if dbPath == "" {
		dbPath = "dmms.db"
	}
	return &Config{
		DBPath:    dbPath,
		JWTSecret: secret,
		Port:      port,
	}
}
