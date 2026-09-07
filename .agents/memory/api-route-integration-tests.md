---
name: API route integration tests
description: How to run HTTP-level API tests without adding a TypeScript runtime dependency.
---

Run HTTP-level route tests against the built API server rather than importing the source app directly with Node.

**Why:** The source tree uses extensionless ESM imports, including a directory import for the route index. Node's built-in TypeScript support rejects these imports, and the API package does not include a TypeScript loader.

**How to apply:** Make the test command build first, spawn the resulting server bundle on an isolated port with test-specific environment values, exercise it over HTTP, clean up created records, and terminate the child process.