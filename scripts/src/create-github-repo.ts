import { ReplitConnectors } from "@replit/connectors-sdk";
import { execSync } from "child_process";

const REPO_NAME = "chainsaw-courses";
const REPO_DESCRIPTION = "Chainsaw manual professional training & certification platform";

async function main() {
  const connectors = new ReplitConnectors();

  // Get authenticated user
  const userRes = await connectors.proxy("github", "/user", { method: "GET" });
  const user = await userRes.json() as { login: string; name: string };
  console.log(`Authenticated as: ${user.login} (${user.name ?? "no name"})`);

  // Check if repo already exists
  const checkRes = await connectors.proxy("github", `/repos/${user.login}/${REPO_NAME}`, { method: "GET" });
  let repoUrl: string;

  if (checkRes.status === 200) {
    const existing = await checkRes.json() as { html_url: string; clone_url: string };
    console.log(`Repo already exists: ${existing.html_url}`);
    repoUrl = existing.clone_url;
  } else {
    // Create the repo
    const createRes = await connectors.proxy("github", "/user/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: REPO_NAME,
        description: REPO_DESCRIPTION,
        private: true,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      console.error("Failed to create repo:", JSON.stringify(err));
      process.exit(1);
    }

    const repo = await createRes.json() as { html_url: string; clone_url: string };
    console.log(`Created repo: ${repo.html_url}`);
    repoUrl = repo.clone_url;
  }

  // Get the OAuth token via a test request with Authorization header exposed
  // We need to push via HTTPS — use the connectors token
  // The clone URL is: https://github.com/{user}/{repo}.git
  // We'll set the remote with a credential helper approach
  console.log(`\nClone URL: ${repoUrl}`);
  console.log(`\nTo push, run:\n  git remote add github ${repoUrl}`);
  console.log(`  git push github main`);
  console.log(`\n(You will be prompted for GitHub credentials — use your username and a Personal Access Token)`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
