package repository

import (
	"fmt"

	"finance-game/internal/models"
	"gorm.io/gorm"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) WithDB(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(u *models.User, passwordHash string) error {
	u.PasswordHash = passwordHash
	return r.db.Create(u).Error
}

func (r *UserRepo) FindByEmail(email string) (*models.User, string, error) {
	var u models.User
	if err := r.db.Where("email = ?", email).First(&u).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, "", fmt.Errorf("user not found")
		}
		return nil, "", err
	}
	return &u, u.PasswordHash, nil
}

func (r *UserRepo) FindByID(id string) (*models.User, error) {
	var u models.User
	if err := r.db.First(&u, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) List() ([]*models.User, error) {
	var users []*models.User
	if err := r.db.Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *UserRepo) UpdateRole(id string, role models.Role) error {
	return r.db.Model(&models.User{}).Where("id = ?", id).Update("role", role).Error
}

func (r *UserRepo) Delete(id string) error {
	return r.db.Delete(&models.User{}, "id = ?", id).Error
}
