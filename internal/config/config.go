package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBPath    string
	JWTSecret string
	Port      string

	// MySQL
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
}

func Load() *Config {
	// Try to load .env.dmms if it exists
	_ = godotenv.Load(".env.dmms")

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
		DBPath:     dbPath,
		JWTSecret:  secret,
		Port:       port,
		DBHost:     os.Getenv("DB_HOST"),
		DBPort:     os.Getenv("DB_PORT"),
		DBUser:     os.Getenv("DB_USERNAME"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		DBName:     os.Getenv("DB_DATABASE"),
	}
}

func (c *Config) GetMySQLDSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}
