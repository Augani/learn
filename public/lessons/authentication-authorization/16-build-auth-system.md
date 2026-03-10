# Lesson 16: Build a Complete Auth System (Capstone)

> **The one thing to remember**: A production auth system combines
> everything from this course — password hashing, sessions or JWTs,
> refresh tokens, RBAC middleware, MFA, and social login. This lesson
> walks you through building one end-to-end. The code is real and
> functional, not pseudocode.

---

## What We're Building

```
SYSTEM ARCHITECTURE

  ┌─────────────────────────────────────────────────────────┐
  │                    FRONTEND (SPA)                       │
  │  Login ─ Register ─ Dashboard ─ Admin Panel             │
  └────────────────────────┬────────────────────────────────┘
                           │ HTTP / JSON
                           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    API SERVER                           │
  │                                                         │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
  │  │ Auth     │  │ RBAC     │  │ OAuth    │              │
  │  │ Routes   │  │ Middleware│  │ Routes   │              │
  │  │          │  │          │  │          │              │
  │  │ /register│  │ check    │  │ /oauth/  │              │
  │  │ /login   │  │ roles &  │  │  github  │              │
  │  │ /refresh │  │ perms    │  │ /oauth/  │              │
  │  │ /logout  │  │          │  │  callback│              │
  │  └──────────┘  └──────────┘  └──────────┘              │
  │                                                         │
  │  ┌──────────────────────────────────────────────┐       │
  │  │            JWT Service                       │       │
  │  │  sign / verify / refresh token management    │       │
  │  └──────────────────────────────────────────────┘       │
  └────────────────────────┬────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    DATABASE                             │
  │                                                         │
  │  users ─ roles ─ permissions ─ user_roles               │
  │  role_permissions ─ refresh_tokens                      │
  └─────────────────────────────────────────────────────────┘
```

---

## Step 1: Database Schema

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name          VARCHAR(255) NOT NULL,
    provider      VARCHAR(50) DEFAULT 'local',
    provider_id   VARCHAR(255),
    mfa_secret    VARCHAR(255),
    mfa_enabled   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE permissions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE user_roles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    role_id       INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE refresh_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    family_id  VARCHAR(255) NOT NULL
);

CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system access'),
    ('user', 'Standard user access'),
    ('moderator', 'Content moderation access');

INSERT INTO permissions (name, description) VALUES
    ('users:read', 'View user profiles'),
    ('users:write', 'Edit user profiles'),
    ('users:delete', 'Delete user accounts'),
    ('posts:read', 'View posts'),
    ('posts:write', 'Create and edit posts'),
    ('posts:delete', 'Delete posts'),
    ('admin:access', 'Access admin panel');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN ('users:read', 'posts:read', 'posts:write');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'moderator'
AND p.name IN ('users:read', 'posts:read', 'posts:write', 'posts:delete');
```

---

## Step 2: Password Hashing Service

```javascript
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 12) {
        errors.push('Password must be at least 12 characters');
    }
    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = { hashPassword, verifyPassword, validatePasswordStrength };
```

---

## Step 3: JWT Service

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(user, permissions) {
    return jwt.sign(
        {
            sub: String(user.id),
            email: user.email,
            role: user.role_name,
            permissions: permissions,
            type: 'access'
        },
        ACCESS_TOKEN_SECRET,
        {
            algorithm: 'HS256',
            expiresIn: ACCESS_TOKEN_EXPIRY,
            issuer: 'myapp.com'
        }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, ACCESS_TOKEN_SECRET, {
        algorithms: ['HS256'],
        issuer: 'myapp.com'
    });
}

function generateRefreshToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    generateAccessToken,
    verifyAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    REFRESH_TOKEN_EXPIRY_DAYS
};
```

---

## Step 4: Auth Routes

### Registration

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const { hashPassword, validatePasswordStrength } = require('../services/password');
const { generateAccessToken, generateRefreshToken, hashRefreshToken,
        REFRESH_TOKEN_EXPIRY_DAYS } = require('../services/jwt');

router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name required' });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
        return res.status(400).json({ error: strength.errors[0] });
    }

    const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1', [email]
    );
    if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);

    const result = await db.query(
        `INSERT INTO users (email, password_hash, name)
         VALUES ($1, $2, $3) RETURNING id, email, name`,
        [email, passwordHash, name]
    );

    const user = result.rows[0];

    await db.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE name = 'user'`,
        [user.id]
    );

    res.status(201).json({
        message: 'Account created',
        user: { id: user.id, email: user.email, name: user.name }
    });
});
```

### Login

```javascript
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const userResult = await db.query(
        `SELECT u.id, u.email, u.name, u.password_hash,
                u.mfa_enabled, u.mfa_secret, r.name as role_name
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.email = $1 AND u.provider = 'local'`,
        [email]
    );

    if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];
    const passwordValid = await verifyPassword(password, user.password_hash);

    if (!passwordValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.mfa_enabled) {
        const mfaToken = crypto.randomBytes(16).toString('hex');
        await db.query(
            `INSERT INTO mfa_challenges (token_hash, user_id, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
            [hashRefreshToken(mfaToken), user.id]
        );
        return res.json({
            mfa_required: true,
            mfa_token: mfaToken
        });
    }

    const tokens = await issueTokens(user);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
        access_token: tokens.accessToken,
        user: { id: user.id, email: user.email, name: user.name }
    });
});
```

### Token Refresh

```javascript
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
    }

    const tokenHash = hashRefreshToken(refreshToken);

    const tokenResult = await db.query(
        `SELECT rt.id, rt.user_id, rt.family_id, rt.revoked,
                u.email, u.name, r.name as role_name
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
        [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const storedToken = tokenResult.rows[0];

    if (storedToken.revoked) {
        await db.query(
            'UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1',
            [storedToken.family_id]
        );
        return res.status(401).json({ error: 'Token reuse detected' });
    }

    await db.query(
        'UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1',
        [storedToken.id]
    );

    const user = {
        id: storedToken.user_id,
        email: storedToken.email,
        name: storedToken.name,
        role_name: storedToken.role_name
    };

    const tokens = await issueTokens(user, storedToken.family_id);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
        access_token: tokens.accessToken
    });
});
```

### Logout

```javascript
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies.refresh_token;

    if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await db.query(
            'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1',
            [tokenHash]
        );
    }

    res.clearCookie('refresh_token');
    res.json({ message: 'Logged out' });
});
```

### Helper Functions

```javascript
async function issueTokens(user, familyId = null) {
    const permissions = await getUserPermissions(user.id);
    const accessToken = generateAccessToken(user, permissions);

    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, family_id)
         VALUES ($1, $2, $3, $4)`,
        [user.id, tokenHash, expiresAt, familyId || crypto.randomUUID()]
    );

    return { accessToken, refreshToken };
}

async function getUserPermissions(userId) {
    const result = await db.query(
        `SELECT DISTINCT p.name
         FROM user_roles ur
         JOIN role_permissions rp ON ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = $1`,
        [userId]
    );
    return result.rows.map(r => r.name);
}

function setRefreshTokenCookie(res, token) {
    res.cookie('refresh_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth'
    });
}
```

---

## Step 5: Auth & RBAC Middleware

```javascript
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = verifyAccessToken(token);
        req.user = {
            id: parseInt(payload.sub),
            email: payload.email,
            role: payload.role,
            permissions: payload.permissions || []
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requirePermission(...requiredPermissions) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const hasAll = requiredPermissions.every(
            perm => req.user.permissions.includes(perm)
        );

        if (!hasAll) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient role' });
        }

        next();
    };
}

module.exports = { authenticate, requirePermission, requireRole };
```

Using the middleware:

```javascript
const { authenticate, requirePermission, requireRole } = require('./middleware/auth');

app.get('/api/posts',
    authenticate,
    requirePermission('posts:read'),
    postsController.list
);

app.post('/api/posts',
    authenticate,
    requirePermission('posts:write'),
    postsController.create
);

app.delete('/api/posts/:id',
    authenticate,
    requirePermission('posts:delete'),
    postsController.remove
);

app.get('/api/admin/users',
    authenticate,
    requireRole('admin'),
    requirePermission('admin:access', 'users:read'),
    adminController.listUsers
);
```

---

## Step 6: OAuth 2.0 Social Login (GitHub)

```javascript
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;

router.get('/oauth/github', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauth_state = state;

    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_CALLBACK_URL,
        scope: 'read:user user:email',
        state: state,
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/oauth/github/callback', async (req, res) => {
    const { code, state } = req.query;

    if (state !== req.session.oauth_state) {
        return res.status(403).json({ error: 'Invalid state' });
    }
    delete req.session.oauth_state;

    const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code: code,
                redirect_uri: GITHUB_CALLBACK_URL
            })
        }
    );
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
        return res.status(400).json({ error: 'OAuth token exchange failed' });
    }

    const userResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const githubUser = await userResponse.json();

    const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const emails = await emailResponse.json();
    const primaryEmail = emails.find(e => e.primary && e.verified);

    let user = await findUserByProvider('github', String(githubUser.id));

    if (!user && primaryEmail) {
        user = await findUserByEmail(primaryEmail.email);
        if (user) {
            await linkProvider(user.id, 'github', String(githubUser.id));
        }
    }

    if (!user) {
        user = await createUser({
            email: primaryEmail?.email || `${githubUser.id}@github.local`,
            name: githubUser.name || githubUser.login,
            provider: 'github',
            provider_id: String(githubUser.id)
        });
        await assignRole(user.id, 'user');
    }

    const tokens = await issueTokens(user);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.redirect(`/auth/callback?token=${tokens.accessToken}`);
});
```

---

## Step 7: Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                    // 10 attempts per window
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.body.email || req.ip;
    }
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 5,                     // 5 registrations per hour per IP
    message: { error: 'Too many registration attempts.' }
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many token refresh attempts.' }
});

router.post('/login', loginLimiter, loginHandler);
router.post('/register', registerLimiter, registerHandler);
router.post('/refresh', refreshLimiter, refreshHandler);
```

---

## Step 8: Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet());
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
    }
}));

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
```

---

## Putting It All Together

```
COMPLETE REQUEST LIFECYCLE

  1. User registers      POST /api/auth/register
     → Password hashed with bcrypt (cost 12)
     → User created with "user" role
     → 201 Created

  2. User logs in         POST /api/auth/login
     → Password verified against hash
     → MFA checked (if enabled)
     → Access token (JWT, 15 min) + Refresh token (cookie, 7 days) issued
     → 200 OK

  3. User accesses API    GET /api/posts
     → Auth middleware: verify JWT signature, expiry, issuer
     → RBAC middleware: check "posts:read" permission
     → 200 OK with data

  4. Token expires        GET /api/posts → 401

  5. Token refreshed      POST /api/auth/refresh
     → Refresh token from cookie validated
     → Old refresh token revoked (rotation)
     → New access + refresh tokens issued
     → 200 OK

  6. User logs out        POST /api/auth/logout
     → Refresh token revoked in DB
     → Cookie cleared
     → 200 OK

  7. Social login         GET /api/auth/oauth/github
     → Redirect to GitHub
     → User authorizes
     → Callback exchanges code for token
     → GitHub user linked or created
     → Tokens issued, redirect to app
```

---

## Exercises

1. **Build it all**: Implement this complete system from scratch.
   Use the code in this lesson as your guide, but type it yourself
   (don't copy-paste — you'll learn more). Test every endpoint
   with curl or Postman.

2. **Add MFA**: Extend the login flow to support TOTP. Implement
   enrollment (QR code generation), verification (6-digit code),
   and backup codes.

3. **Add password reset**: Implement "forgot password" with a
   time-limited, single-use reset token sent via email. Consider:
   how long should the token be valid? What happens if the user
   requests multiple resets?

4. **Security audit**: Review the complete system and identify at
   least 3 things you'd add for production readiness. Consider:
   logging, monitoring, input validation, error handling,
   database connection pooling, and CORS configuration.

5. **Load test**: Use a tool like k6 or Artillery to test the
   /login endpoint under load. How many requests per second can
   your system handle? Where's the bottleneck? (Hint: bcrypt is
   intentionally slow.)

---

[Back to Roadmap](./00-roadmap.md)
