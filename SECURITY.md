# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately by emailing the maintainers or using [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability):

> **GitHub → Security tab → "Report a vulnerability"**

### What to include

- Description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept if possible)
- Affected component (auth, API endpoint, JWT handling, file upload, etc.)
- Suggested fix if you have one

### What to expect

- Acknowledgement within **48 hours**
- A fix or mitigation plan within **14 days** for critical issues
- Credit in the release notes (if you'd like)

## Scope

The following are in scope:

- Authentication and authorisation bypasses (JWT, role checks)
- SQL injection or data leakage via API endpoints
- Insecure file upload handling
- Privilege escalation between roles (PM / Contributor / Admin)
- Sensitive data exposure in API responses

Out of scope: issues in development-only dependencies, rate limiting absence, and self-hosted infrastructure configuration.
