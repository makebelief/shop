# Security

## Architecture

This deployment is a static storefront. It has no database, authentication,
administrative interface, payment processor, file upload, or server-side form
handling. Orders and contact messages are handed to WhatsApp, and customers
must wait for official confirmation before making a payment.

## Controls

- Strict Content Security Policy with same-origin scripts and connections
- Clickjacking protection through CSP `frame-ancestors` and `X-Frame-Options`
- MIME sniffing, referrer, permissions, opener, and resource-policy headers
- HTTPS enforcement through HSTS on production deployments
- Locally hosted JavaScript, CSS, fonts, icons, logo, and favicon
- No Readdy preview instrumentation, PostHog execution, or external form posts
- Read-only static server supporting only `GET` and `HEAD`
- URI length, request timeout, header timeout, and connection limits
- Path confinement and malformed-request handling
- Automated production and security checks

All product and category images are hosted locally. The Content Security Policy
allows no third-party script, style, font, image, frame, form, or connection
origin. WhatsApp is opened only after an intentional customer action.

## Reporting a vulnerability

Do not disclose a suspected vulnerability publicly. Contact the site owner
through the official WhatsApp number listed on the storefront with a concise
description and reproduction steps. Do not access, modify, or retain another
person's information while investigating.

## Operational requirements

- Deploy only over HTTPS.
- Protect the hosting, registrar, DNS, Git, and WhatsApp accounts with unique
  passwords and multi-factor authentication.
- Restrict deployment access to trusted maintainers.
- Review provider access logs and security alerts.
- Apply Node.js and container base-image updates regularly.
- Re-run `npm run check` before every deployment.
