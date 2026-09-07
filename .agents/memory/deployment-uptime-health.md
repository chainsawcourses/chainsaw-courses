---
name: Deployment uptime health path
description: Replit deployment monitoring probes the API artifact preview path in addition to its configured startup health endpoint.
---

Keep the API artifact preview path returning a lightweight HTTP 200 response, even when a separate canonical startup health endpoint is configured.

**Why:** Deployment monitoring was observed probing the preview path and recording non-200 responses there while the configured startup health endpoint remained healthy. This can create apparent outage periods without an application stack trace.

**How to apply:** When changing API routing or artifact preview paths, verify both the preview path and the configured health endpoint return 200 without authentication or database work.