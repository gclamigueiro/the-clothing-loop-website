package models

import (
	"errors"
	"time"

	"gopkg.in/guregu/null.v3"
	"gopkg.in/guregu/null.v3/zero"

	"gorm.io/gorm"
)

var ErrUserNotFound = errors.New("User not found")
var ErrAddUserChainsToObject = errors.New("Unable to add associated loops to user")

type User struct {
	ID                    uint            `json:"-"`
	UID                   string          `json:"uid" gorm:"uniqueIndex"`
	FID                   zero.String     `json:"-" gorm:"column:fid"`
	Email                 zero.String     `json:"email" gorm:"unique"`
	IsEmailVerified       bool            `json:"is_email_verified"`
	IsRootAdmin           bool            `json:"is_root_admin"`
	PausedUntil           null.Time       `json:"paused_until"`
	Name                  string          `json:"name"`
	PhoneNumber           string          `json:"phone_number"`
	Address               string          `json:"address"`
	Sizes                 []string        `json:"sizes" gorm:"serializer:json"`
	LastSignedInAt        zero.Time       `json:"-"`
	LastPokeAt            zero.Time       `json:"-"`
	UserToken             []UserToken     `json:"-"`
	Event                 []Event         `json:"-"`
	Chains                []UserChain     `json:"chains"`
	UserOnesignal         []UserOnesignal `json:"-"`
	CreatedAt             time.Time       `json:"-"`
	UpdatedAt             time.Time       `json:"-"`
	I18n                  string          `json:"i18n"`
	JwtTokenPepper        int             `json:"-" `
	Latitude              float64         `json:"-"`
	Longitude             float64         `json:"-"`
	AcceptedTOH           bool            `json:"-"`
	AcceptedDPA           bool            `json:"-"`
	AcceptedTOHJSON       *bool           `json:"accepted_toh,omitempty" gorm:"-:migration;<-:false"`
	AcceptedDPAJSON       *bool           `json:"accepted_dpa,omitempty" gorm:"-:migration;<-:false"`
	NotificationChainUIDs []string        `json:"notification_chain_uids,omitempty" gorm:"-"`
}

func (u *User) AddUserChainsToObject(db *gorm.DB) error {
	userChains := []UserChain{}
	err := db.Raw(`
SELECT
	user_chains.id             AS id,
	user_chains.chain_id       AS chain_id,
	chains.uid                 AS chain_uid,
	user_chains.user_id        AS user_id,
	users.uid                  AS user_uid,
	user_chains.is_chain_admin AS is_chain_admin,
	user_chains.created_at     AS created_at,
	user_chains.is_approved    AS is_approved
FROM user_chains
LEFT JOIN chains ON user_chains.chain_id = chains.id
LEFT JOIN users ON user_chains.user_id = users.id
WHERE users.id = ?
	`, u.ID).Scan(&userChains).Error
	if err != nil {
		return err
	}

	u.Chains = userChains
	return nil
}

func (u *User) AddNotificationChainUIDs(db *gorm.DB) error {
	userChainIDs := []uint{}
	for _, uc := range u.Chains {
		if uc.IsChainAdmin {
			userChainIDs = append(userChainIDs, uc.ChainID)
		}
	}
	notificationChainUIDs := []string{}
	err := db.Raw(`
SELECT
	c.uid
	FROM chains AS c
WHERE c.id IN ?
	AND (
		SELECT COUNT(uc.id)
		FROM user_chains AS uc
		JOIN users AS u ON u.id = uc.user_id
		WHERE uc.chain_id = c.id AND uc.is_approved = FALSE AND u.is_email_verified = TRUE
	) > 0
	`, userChainIDs).Pluck("uid", &notificationChainUIDs).Error
	if err != nil {
		return err
	}

	u.NotificationChainUIDs = notificationChainUIDs

	return nil
}

// This required user to have run AddUserChainsToObject before this
func (u *User) IsPartOfChain(chainUID string) (ok, isChainAdmin bool) {
	for _, c := range u.Chains {
		if c.ChainUID == chainUID {
			ok = true
			isChainAdmin = c.IsChainAdmin
			break
		}
	}

	return ok, isChainAdmin
}

// This required user to have run AddUserChainsToObject before this
func (u *User) IsAnyChainAdmin() (isAnyChainAdmin bool) {
	for _, c := range u.Chains {
		if c.IsChainAdmin {
			isAnyChainAdmin = c.IsChainAdmin
			break
		}
	}

	return isAnyChainAdmin
}

func (u *User) LastPokeTooRecent() bool {
	if !u.LastPokeAt.Valid {
		return false
	}

	return !u.LastPokeAt.Time.Before(time.Now().Add(-24 * 7 * time.Hour))
}

func (u *User) SetLastPokeToNow(db *gorm.DB) error {
	return db.Exec(`UPDATE users SET last_poke_at = NOW() WHERE id = ?`, u.ID).Error
}

func (u *User) FindLinkedEventByUID(db *gorm.DB, eventUID string) (e *Event, err error) {
	e = &Event{}
	err = db.Raw(`
SELECT * FROM events
WHERE uid = ? AND user_id = ?
LIMIT 1
	`, eventUID, u.ID).Scan(e).Error
	if err != nil {
		return nil, err
	}

	return e, nil
}

func (u *User) SetAcceptedLegal() {
	u.AcceptedTOHJSON = &u.AcceptedTOH
	u.AcceptedDPAJSON = &u.AcceptedDPA
}

func (u *User) AcceptLegal(db *gorm.DB) error {
	if !u.AcceptedTOH || !u.AcceptedDPA {
		return db.Exec(`UPDATE users SET accepted_toh = TRUE, accepted_dpa = TRUE WHERE id = ?`, u.ID).Error
	}
	return nil
}

type UserContactData struct {
	Name       string      `gorm:"name"`
	Email      zero.String `gorm:"email"`
	I18n       string      `gorm:"i18n"`
	ChainName  string      `gorm:"chain_name"`
	IsApproved bool        `gorm:"is_approved"`
}

// Expects the userUID not to be empty
func UserGetByUID(db *gorm.DB, userUID string, checkEmailVerification bool) (*User, error) {
	query := `SELECT * FROM users	WHERE uid = ?`
	if checkEmailVerification {
		query += ` AND is_email_verified = TRUE`
	}
	query += ` LIMIT 1`

	user := &User{}
	err := db.Raw(query, userUID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return user, nil
}

func UserGetByEmail(db *gorm.DB, userEmail string) (*User, error) {
	if userEmail == "" {
		return nil, errors.New("Email is required")
	}
	query := `SELECT * FROM users	WHERE email = ? LIMIT 1`
	user := &User{}
	err := db.Raw(query, userEmail).First(&user).Error
	if err != nil {
		return nil, err
	}
	return user, nil
}

func UserGetAdminsByChain(db *gorm.DB, chainId ...uint) ([]UserContactData, error) {
	results := []UserContactData{}
	err := db.Raw(`
SELECT
	users.name AS name,
	users.email AS email,
	users.i18n AS i18n,
	chains.name AS chain_name
FROM user_chains AS uc
LEFT JOIN users ON uc.user_id = users.id
LEFT JOIN chains ON uc.chain_id = chains.id 
WHERE uc.chain_id IN ?
	AND uc.is_chain_admin = TRUE
	AND users.is_email_verified = TRUE
	`, chainId).Scan(&results).Error
	if err != nil {
		return nil, err
	}
	return results, nil
}

func UserGetAllUsersByChain(db *gorm.DB, chainID uint) ([]User, error) {
	results := []User{}

	err := db.Raw(`
SELECT users.*
FROM users
LEFT JOIN user_chains ON user_chains.user_id = users.id 
WHERE user_chains.chain_id = ? AND users.is_email_verified = TRUE
	`, chainID).Scan(&results).Error

	if err != nil {
		return nil, err
	}
	return results, nil
}

func UserCheckEmail(db *gorm.DB, userEmail string) (userID uint, found bool, err error) {
	if userEmail == "" {
		return 0, false, errors.New("Email is required")
	}

	var row struct {
		ID uint `gorm:"id"`
	}

	query := `SELECT id FROM users WHERE email = ? LIMIT 1`
	err = db.Raw(query, userEmail).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, false, nil
		}
		return 0, false, err
	}
	return row.ID, true, nil
}
