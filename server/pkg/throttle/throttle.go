package throttle

import (
	"net"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	cache "github.com/patrickmn/go-cache"
)

const (
	// Too Many Requests According to http://tools.ietf.org/html/rfc6585#page-3
	StatusTooManyRequests = 429

	// The default Status Code used
	defaultStatusCode = StatusTooManyRequests

	// The default Message to include, defaults to 429 status code title
	defaultMessage = "Too Many Requests"

	// The default key prefix for Key Value Storage
	defaultKeyPrefix = "throttle"

	// The header name to retrieve an IP address under a proxy
	forwardedForHeader = "X-FORWARDED-FOR"

	// The default for the disabled setting
	defaultDisabled = false
)

type Options struct {
	// The status code to be returned for throttled requests
	// Defaults to 429 Too Many Requests
	StatusCode int

	// The message to be returned as the body of throttled requests
	Message string

	// The function used to identify the requester
	// Defaults to IP identification
	IdentificationFunction func(*http.Request) string

	// The key prefix to use in any key value store
	// defaults to "throttle"
	KeyPrefix string

	// The store to use
	// defaults to a simple concurrent-safe map[string]string
	Store *cache.Cache

	// If the throttle is disabled or not
	// defaults to false
	Disabled bool
}

// The Quota is Request Rates per Time for a given policy
type Quota struct {
	// The Request Limit
	Limit uint64
	// The time window for the request Limit
	Within time.Duration
}

func (q *Quota) KeyId() string {
	return strconv.FormatInt(int64(q.Within)/int64(q.Limit), 10)
}

// An access message to return to the user
type accessMessage struct {
	// The given status Code
	StatusCode int
	// The given message
	Message string
}

// Return a new access message with the properties given
func newAccessMessage(statusCode int, message string) *accessMessage {
	return &accessMessage{
		StatusCode: statusCode,
		Message:    message,
	}
}

// An access count for a single identified user.
// Will be stored in the key value store, 1 per Policy and User
type accessCount struct {
	Count    uint64        `json:"count"`
	Start    time.Time     `json:"start"`
	Duration time.Duration `json:"duration"`
}

// Determine if the count is still fresh
func (r accessCount) IsFresh() bool {
	return time.Now().UTC().Sub(r.Start) < r.Duration
}

// Increment the count when fresh, or reset and then increment when stale
func (r *accessCount) Increment() {
	if r.IsFresh() {
		r.Count++
	} else {
		r.Count = 1
		r.Start = time.Now().UTC()
	}
}

// Get the count
func (r *accessCount) GetCount() uint64 {
	if r.IsFresh() {
		return r.Count
	} else {
		return 0
	}
}

// Return a new access count with the given duration
func newAccessCount(duration time.Duration) *accessCount {
	return &accessCount{
		0,
		time.Now().UTC(),
		duration,
	}
}

// Unmarshal a stringified JSON respresentation of an access count
func accessCountFromPtr(value any) *accessCount {
	accessCountPtr, ok := value.(*accessCount)
	if !ok {
		panic("No access count found from pointer")
	}

	return accessCountPtr
}

// The controller, stores the allowed quota and has access to the store
type controller struct {
	*sync.Mutex
	quota *Quota
	store *cache.Cache
}

// Get an access count by id
func (c *controller) GetAccessCount(id string) (a *accessCount) {
	v, ok := c.store.Get(id)

	if ok {
		a = accessCountFromPtr(v)
	} else {
		a = newAccessCount(c.quota.Within)
	}

	return a
}

// Set an access count by id, will write to the store
func (c *controller) SetAccessCount(id string, a *accessCount) {
	c.store.Set(id, a, 0)
}

// Gets the access count, increments it and writes it back to the store
func (c *controller) RegisterAccess(id string) {
	c.Lock()
	defer c.Unlock()

	counter := c.GetAccessCount(id)
	counter.Increment()
	c.SetAccessCount(id, counter)
}

// Check if the controller denies access for the given id based on
// the quota and used access
func (c *controller) DeniesAccess(id string) bool {
	counter := c.GetAccessCount(id)
	return counter.GetCount() >= c.quota.Limit
}

// Get a time for the given id when the quota time window will be reset
func (c *controller) RetryAt(id string) time.Time {
	counter := c.GetAccessCount(id)

	return counter.Start.Add(c.quota.Within)
}

// Get the remaining limit for the given id
func (c *controller) RemainingLimit(id string) uint64 {
	counter := c.GetAccessCount(id)

	return c.quota.Limit - counter.GetCount()
}

// Return a new controller with the given quota and store
func newController(quota *Quota, store *cache.Cache) *controller {
	return &controller{
		&sync.Mutex{},
		quota,
		store,
	}
}

// Identify via the given Identification Function
func (o *Options) Identify(req *http.Request) string {
	return o.IdentificationFunction(req)
}

// A throttling Policy
// Takes two arguments, one required:
// First is a Quota (A Limit with an associated time). When the given Limit
// of requests is reached by a user within the given time window, access to
// access to resources will be denied to this user
// Second is Options to use with this policy. For further information on options,
// see Options further above.
func Policy(quota *Quota, options ...*Options) gin.HandlerFunc {
	o := newOptions(options)
	if o.Disabled {
		return func(c *gin.Context) {}
	}

	controller := newController(quota, o.Store)

	return func(c *gin.Context) {
		id := makeKey(o.KeyPrefix, quota.KeyId(), o.Identify(c.Request))

		if controller.DeniesAccess(id) {
			msg := newAccessMessage(o.StatusCode, o.Message)
			setRateLimitHeaders(c.Writer, controller, id)
			c.Writer.WriteHeader(msg.StatusCode)
			c.Writer.Write([]byte(msg.Message))
			c.Abort()
		} else {
			controller.RegisterAccess(id)
			setRateLimitHeaders(c.Writer, controller, id)
			c.Next()
		}

	}
}

// Set Rate Limit Headers helper function
func setRateLimitHeaders(resp http.ResponseWriter, controller *controller, id string) {
	headers := resp.Header()
	headers.Set("X-RateLimit-Limit", strconv.FormatUint(controller.quota.Limit, 10))
	headers.Set("X-RateLimit-Reset", strconv.FormatInt(controller.RetryAt(id).Unix(), 10))
	headers.Set("X-RateLimit-Remaining", strconv.FormatUint(controller.RemainingLimit(id), 10))
}

// The default identifier function. Identifies a client by IP
func defaultIdentify(req *http.Request) string {
	if forwardedFor := req.Header.Get(forwardedForHeader); forwardedFor != "" {
		if ipParsed := net.ParseIP(forwardedFor); ipParsed != nil {
			return ipParsed.String()
		}
	}

	ip, _, err := net.SplitHostPort(req.RemoteAddr)
	if err != nil {
		panic(err.Error())
	}
	return ip
}

// Make a key from various parts for use in the key value store
func makeKey(parts ...string) string {
	return strings.Join(parts, "_")
}

// Creates new default options and assigns any given options
func newOptions(options []*Options) *Options {
	o := Options{
		StatusCode:             defaultStatusCode,
		Message:                defaultMessage,
		IdentificationFunction: defaultIdentify,
		KeyPrefix:              defaultKeyPrefix,
		Store:                  nil,
		Disabled:               defaultDisabled,
	}

	// when all defaults, return it
	if len(options) == 0 {
		o.Store = cache.New(24*time.Hour, 5*24*time.Hour)
		return &o
	}

	// map the given values to the options
	optionsValue := reflect.ValueOf(options[0])
	oValue := reflect.ValueOf(&o)
	numFields := optionsValue.Elem().NumField()

	for i := 0; i < numFields; i++ {
		if value := optionsValue.Elem().Field(i); value.IsValid() && value.CanSet() && isNonEmptyOption(value) {
			oValue.Elem().Field(i).Set(value)
		}
	}

	if o.Store == nil {
		o.Store = cache.New(24*time.Hour, 5*24*time.Hour)
	}

	return &o
}

// Check if an option is assigned
func isNonEmptyOption(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.String:
		return v.Len() != 0
	case reflect.Bool:
		return v.IsValid()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() != 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint() != 0
	case reflect.Float32, reflect.Float64:
		return v.Float() != 0
	case reflect.Interface, reflect.Ptr, reflect.Func:
		return !v.IsNil()
	}
	return false
}
