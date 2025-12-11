# How to Generate JWT Secret

## Quick Answer

Use one of these methods to generate a secure random secret:

### Method 1: Using OpenSSL (Recommended)
```bash
openssl rand -base64 32
```

### Method 2: Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Method 3: Using Online Generator
Visit: https://generate-secret.vercel.app/32 (or similar tools)

---

## Detailed Methods

### Method 1: OpenSSL (Most Common)

**On Mac/Linux:**
```bash
# Generate a 32-byte (256-bit) secret, base64 encoded
openssl rand -base64 32
```

**Example output:**
```
k5prOOB4Xrtk5RglbKDxvaK7VflPKj7V0Ep6LQw+0NU=
```

**For longer secrets (64 bytes):**
```bash
openssl rand -base64 64
```

**For hex format:**
```bash
openssl rand -hex 32
```

---

### Method 2: Node.js

**Using Node.js command line:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Or create a simple script:**
```javascript
// generate-secret.js
const crypto = require('crypto');
console.log(crypto.randomBytes(32).toString('base64'));
```

Run it:
```bash
node generate-secret.js
```

---

### Method 3: Python

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

### Method 4: Online Generators

**Secure options:**
- https://generate-secret.vercel.app/32
- https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx

⚠️ **Warning**: Only use trusted online generators. Better to use command-line tools.

---

## For Your Project

You need **TWO** JWT secrets:

1. **JWT_SECRET** - For access tokens (short-lived)
2. **JWT_REFRESH_SECRET** - For refresh tokens (long-lived)

### Generate Both:

```bash
# Generate JWT_SECRET
openssl rand -base64 32

# Generate JWT_REFRESH_SECRET (different from above!)
openssl rand -base64 32
```

**Example:**
```bash
$ openssl rand -base64 32
k5prOOB4Xrtk5RglbKDxvaK7VflPKj7V0Ep6LQw+0NU=

$ openssl rand -base64 32
m8qR2pL9vXw4nB6tY8zA1cD3eF5gH7jK9lM0nP2qR4=
```

---

## Where to Use Them

### In EasyPanel Environment Variables:

```bash
JWT_SECRET=k5prOOB4Xrtk5RglbKDxvaK7VflPKj7V0Ep6LQw+0NU=
JWT_REFRESH_SECRET=m8qR2pL9vXw4nB6tY8zA1cD3eF5gH7jK9lM0nP2qR4=
```

### In Your .env File (Local Development):

```bash
JWT_SECRET=k5prOOB4Xrtk5RglbKDxvaK7VflPKj7V0Ep6LQw+0NU=
JWT_REFRESH_SECRET=m8qR2pL9vXw4nB6tY8zA1cD3eF5gH7jK9lM0nP2qR4=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

---

## Security Best Practices

### ✅ DO:
- Use **at least 32 bytes** (256 bits) for secrets
- Generate **different secrets** for JWT_SECRET and JWT_REFRESH_SECRET
- Use **base64** or **hex** encoding (easy to store)
- Store secrets in **environment variables**, never in code
- Use **different secrets** for development and production

### ❌ DON'T:
- Use simple passwords like "secret123"
- Reuse the same secret for both JWT_SECRET and JWT_REFRESH_SECRET
- Commit secrets to git
- Share secrets publicly
- Use short secrets (< 32 bytes)

---

## Quick Script to Generate Both

Create a file `generate-secrets.sh`:

```bash
#!/bin/bash

echo "Generating JWT secrets..."
echo ""
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
echo ""
echo "Copy these to your .env file or EasyPanel environment variables"
```

Make it executable and run:
```bash
chmod +x generate-secrets.sh
./generate-secrets.sh
```

---

## For Your Current Deployment

Since you're deploying to EasyPanel, generate secrets now:

```bash
# Run these commands:
openssl rand -base64 32  # Use for JWT_SECRET
openssl rand -base64 32  # Use for JWT_REFRESH_SECRET
```

Then add them to EasyPanel:
1. Go to your **backend service** → **Environment Variables**
2. Add:
   - `JWT_SECRET` = (first generated value)
   - `JWT_REFRESH_SECRET` = (second generated value)

---

## Verification

After generating, verify the secrets:
- ✅ Are at least 32 characters long
- ✅ Are different from each other
- ✅ Don't contain obvious patterns
- ✅ Are stored securely (environment variables)

---

## Common Mistakes

### Mistake 1: Using the Same Secret Twice
```bash
# ❌ WRONG
JWT_SECRET=my-secret-key
JWT_REFRESH_SECRET=my-secret-key  # Same secret!

# ✅ CORRECT
JWT_SECRET=k5prOOB4Xrtk5RglbKDxvaK7VflPKj7V0Ep6LQw+0NU=
JWT_REFRESH_SECRET=m8qR2pL9vXw4nB6tY8zA1cD3eF5gH7jK9lM0nP2qR4=
```

### Mistake 2: Using Weak Secrets
```bash
# ❌ WRONG
JWT_SECRET=secret123
JWT_SECRET=password

# ✅ CORRECT
JWT_SECRET=k5prOOB4Xrtk5RglbKDxvaK7VflPKj7V0Ep6LQw+0NU=
```

### Mistake 3: Committing Secrets to Git
```bash
# ❌ WRONG - Don't commit .env files with secrets
git add .env

# ✅ CORRECT - Add .env to .gitignore
echo ".env" >> .gitignore
```

---

## Summary

**Easiest Method:**
```bash
openssl rand -base64 32
```

**Run it twice** to get two different secrets for JWT_SECRET and JWT_REFRESH_SECRET.

**Then add them to EasyPanel environment variables** for your backend service.

That's it! 🎉
