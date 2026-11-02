import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const REQUIRED_RELEASE_CHECKS = [
  "pnpm run check:release-contract",
  "pnpm run check:mobile-packages",
  "pnpm run check:mobile-handoffs",
  "pnpm --filter @workspace/chainsaw-training run check:manual-pages",
  "pnpm --filter @workspace/chainsaw-training run check:privacy-policy",
  "pnpm run check:privacy-policy-download",
  "pnpm --filter @workspace/chainsaw-training run test:store-policy",
  "pnpm --filter @workspace/chainsaw-training run test:manual-delivery-analytics",
  "pnpm --filter @workspace/chainsaw-training run test:manual-delivery-browser",
  "pnpm --filter @workspace/chainsaw-training run test:billing-history-browser",
  "pnpm run check:uk-english",
  "pnpm run typecheck",
  "pnpm run check:project-secrets",
  "pnpm run check:deployment-size",
  "pnpm run check:lifecycle-browser",
];

const REQUIRED_WORKFLOW_COMMANDS = [
  {
    command: "pnpm run check:release-contract",
    message:
      "Release workflow must run the release-gate contract: pnpm run check:release-contract",
  },
  {
    command: "pnpm run check:release",
    message:
      "Release workflow must run the standard release validation: pnpm run check:release",
  },
];

const SUPPORTED_PRODUCTION_DEPLOYMENT_CONFIGURATIONS = [
  ".replit",
  "netlify.toml",
  "railway.json",
  "railway.toml",
  "render.yaml",
  "render.yml",
  "vercel.json",
];

async function readPackageConfiguration() {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );

  return {
    productionDeploymentConfigurations:
      packageJson.releaseGate?.productionDeploymentConfigurations ?? [],
    productionScriptNames: packageJson.releaseGate?.productionScriptNames ?? [],
    scripts: packageJson.scripts ?? {},
  };
}

async function readPackageScripts() {
  return (await readPackageConfiguration()).scripts;
}

async function readProductionDeploymentConfigurations() {
  const repositoryRoot = new URL("../", import.meta.url);
  const configurationPaths = [];

  async function discover(directory, relativeDirectory = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const relativePath = `${relativeDirectory}${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name !== ".git" && entry.name !== "node_modules") {
            await discover(
              new URL(`${encodeURIComponent(entry.name)}/`, directory),
              `${relativePath}/`,
            );
          }
          return;
        }

        if (
          entry.isFile() &&
          SUPPORTED_PRODUCTION_DEPLOYMENT_CONFIGURATIONS.includes(entry.name)
        ) {
          configurationPaths.push(relativePath);
        }
      }),
    );
  }

  await discover(repositoryRoot);
  configurationPaths.sort();

  return Object.fromEntries(
    await Promise.all(
      configurationPaths.map(async (configurationPath) => [
        configurationPath,
        await readFile(new URL(configurationPath, repositoryRoot), "utf8"),
      ]),
    ),
  );
}

function discoverProductionScripts(scripts, productionScriptNames) {
  return Object.keys(scripts).filter((scriptName) =>
    productionScriptNames.some((pattern) => {
      if (pattern.endsWith("*")) {
        return scriptName.startsWith(pattern.slice(0, -1));
      }

      return scriptName === pattern;
    }),
  );
}

function assertProductionScriptsUseReleaseGate(scripts, productionScriptNames) {
  assert.deepEqual(
    productionScriptNames,
    ["build", "build:*", "package:*"],
    'releaseGate.productionScriptNames must define the production and packaging script naming convention: "build", "build:*", and "package:*"',
  );

  const productionScripts = discoverProductionScripts(
    scripts,
    productionScriptNames,
  );
  assert.ok(
    productionScripts.length > 0,
    "The production script naming convention must discover at least one script",
  );

  for (const scriptName of productionScripts) {
    const commands = scripts[scriptName]
      ?.split("&&")
      .map((command) => command.trim());

    assert.equal(
      commands?.[0],
      "pnpm run check:release",
      `Production or packaging script "${scriptName}" must run the release gate before any production command: pnpm run check:release`,
    );
  }
}

function matchesProductionScriptName(scriptName, productionScriptNames) {
  return productionScriptNames.some((pattern) =>
    pattern.endsWith("*")
      ? scriptName.startsWith(pattern.slice(0, -1))
      : scriptName === pattern,
  );
}

function readReplitDeploymentBuildCommand(configuration) {
  const deploymentSection = configuration.match(
    /^\[deployment\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/m,
  )?.[1];
  assert.ok(
    deploymentSection,
    'Production deployment configuration ".replit" must define a [deployment] section',
  );

  const buildValue = deploymentSection.match(/^\s*build\s*=\s*(.+)\s*$/m)?.[1];
  assert.ok(
    buildValue,
    'Production deployment configuration ".replit" must define an explicit build command',
  );

  if (buildValue.startsWith("[")) {
    return [...buildValue.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) =>
      JSON.parse(`"${match[1]}"`),
    );
  }

  if (buildValue.startsWith('"')) {
    return JSON.parse(buildValue).trim().split(/\s+/);
  }

  assert.fail(
    'Production deployment configuration ".replit" build command must be a string or string array',
  );
}

function splitShellCommand(command, configurationPath) {
  assert.equal(
    typeof command,
    "string",
    `Production deployment configuration "${configurationPath}" must define a string build command`,
  );
  return command.trim().split(/\s+/);
}

function readProductionDeploymentBuildCommands(
  configurationPath,
  configuration,
) {
  const configurationName = configurationPath.split("/").at(-1);

  if (configurationName === ".replit") {
    return [readReplitDeploymentBuildCommand(configuration)];
  }

  if (configurationName === "vercel.json") {
    const parsedConfiguration = JSON.parse(configuration);
    return [
      splitShellCommand(parsedConfiguration.buildCommand, configurationPath),
    ];
  }

  if (configurationName === "netlify.toml") {
    const commands = [
      ...configuration.matchAll(
        /^\[(build|context\.production)\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/gm,
      ),
    ]
      .map(
        (section) =>
          section[2].match(/^\s*command\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/m)?.[1],
      )
      .filter((command) => command !== undefined)
      .map((command) =>
        splitShellCommand(JSON.parse(`"${command}"`), configurationPath),
      );
    assert.ok(
      commands.length > 0,
      `Production deployment configuration "${configurationPath}" must define a build or production-context command`,
    );
    return commands;
  }

  if (configurationName === "railway.json") {
    const parsedConfiguration = JSON.parse(configuration);
    return [
      splitShellCommand(
        parsedConfiguration.build?.buildCommand,
        configurationPath,
      ),
    ];
  }

  if (configurationName === "railway.toml") {
    const buildSection = configuration.match(
      /^\[build\]\s*$([\s\S]*?)(?=^\[|$(?![\s\S]))/m,
    )?.[1];
    const command = buildSection?.match(
      /^\s*buildCommand\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/m,
    )?.[1];
    return [
      splitShellCommand(
        command === undefined ? undefined : JSON.parse(`"${command}"`),
        configurationPath,
      ),
    ];
  }

  if (
    configurationName === "render.yaml" ||
    configurationName === "render.yml"
  ) {
    const parsedConfiguration = parse(configuration);
    const buildCommands = parsedConfiguration?.services
      ?.filter((service) => service?.buildCommand !== undefined)
      .map((service) =>
        splitShellCommand(service.buildCommand, configurationPath),
      );
    assert.ok(
      buildCommands?.length > 0,
      `Production deployment configuration "${configurationPath}" must define at least one service build command`,
    );
    return buildCommands;
  }

  assert.fail(
    `Unsupported production deployment configuration: ${configurationPath}`,
  );
}

function assertProductionDeploymentConfigurationsUseProtectedScripts(
  deploymentConfigurations,
  productionDeploymentConfigurations,
  scripts,
  productionScriptNames,
) {
  const detectedConfigurationPaths = Object.keys(
    deploymentConfigurations,
  ).sort();
  const registeredConfigurationPaths = [
    ...productionDeploymentConfigurations,
  ].sort();
  assert.deepEqual(
    registeredConfigurationPaths,
    detectedConfigurationPaths,
    `releaseGate.productionDeploymentConfigurations must list every detected supported production deployment configuration; detected: ${detectedConfigurationPaths.join(", ") || "none"}`,
  );

  for (const configurationPath of productionDeploymentConfigurations) {
    const configuration = deploymentConfigurations[configurationPath];
    assert.equal(
      typeof configuration,
      "string",
      `Missing production deployment configuration: ${configurationPath}`,
    );

    const commands = readProductionDeploymentBuildCommands(
      configurationPath,
      configuration,
    );
    for (const command of commands) {
      assert.deepEqual(
        command.slice(0, 2),
        ["pnpm", "run"],
        `Production deployment command in "${configurationPath}" must resolve through a package script`,
      );

      const scriptName = command[2];
      assert.ok(
        scriptName && scripts[scriptName],
        `Production deployment command in "${configurationPath}" must resolve to an existing package script`,
      );
      assert.ok(
        matchesProductionScriptName(scriptName, productionScriptNames),
        `Production deployment command in "${configurationPath}" resolves to unprotected script "${scriptName}"`,
      );
    }
  }
}

function assertBlockingReleaseChecks(workflow) {
  const parsedWorkflow = parse(workflow);
  const checkRoutesJob = parsedWorkflow?.jobs?.["check-routes"];
  assert.ok(
    checkRoutesJob && typeof checkRoutesJob === "object",
    'Release workflow must define the required "check-routes" job',
  );
  assert.equal(
    checkRoutesJob["continue-on-error"] ?? false,
    false,
    'Release workflow "check-routes" job must remain blocking',
  );
  assert.ok(
    Array.isArray(checkRoutesJob.steps),
    'Release workflow "check-routes" job must define steps',
  );

  for (const { command, message } of REQUIRED_WORKFLOW_COMMANDS) {
    const matchingStep = checkRoutesJob.steps.find(
      (step) => step?.run === command,
    );

    assert.ok(
      matchingStep,
      `${message}; it must be a step in the "check-routes" job`,
    );
    assert.equal(
      matchingStep["continue-on-error"] ?? false,
      false,
      `Release workflow command must remain blocking in the "check-routes" job: ${command}`,
    );
  }
}

test("check:release includes every required release check", async () => {
  const scripts = await readPackageScripts();
  const releaseChecks = scripts["check:release"]
    ?.split("&&")
    .map((command) => command.trim());

  assert.ok(releaseChecks, 'Missing required package script "check:release"');

  for (const requiredCheck of REQUIRED_RELEASE_CHECKS) {
    assert.ok(
      releaseChecks.includes(requiredCheck),
      `Missing required release check: ${requiredCheck}`,
    );
  }
});

test("production build entry points invoke the standard release gate", async () => {
  const { scripts, productionScriptNames } = await readPackageConfiguration();
  assertProductionScriptsUseReleaseGate(scripts, productionScriptNames);
});

test("production deployment entry points resolve to protected package scripts", async () => {
  const { productionDeploymentConfigurations, productionScriptNames, scripts } =
    await readPackageConfiguration();
  const deploymentConfigurations =
    await readProductionDeploymentConfigurations();

  assertProductionDeploymentConfigurationsUseProtectedScripts(
    deploymentConfigurations,
    productionDeploymentConfigurations,
    scripts,
    productionScriptNames,
  );
});

test("an unprotected production deployment command is rejected", async () => {
  const { productionDeploymentConfigurations, productionScriptNames, scripts } =
    await readPackageConfiguration();
  const replitConfiguration = await readFile(
    new URL("../.replit", import.meta.url),
    "utf8",
  );
  const unprotectedConfiguration = replitConfiguration.replace(
    'build = ["pnpm", "run", "build"]',
    'build = ["pnpm", "run", "deploy:production"]',
  );

  assert.throws(
    () =>
      assertProductionDeploymentConfigurationsUseProtectedScripts(
        { ".replit": unprotectedConfiguration },
        productionDeploymentConfigurations,
        { ...scripts, "deploy:production": "pnpm -r run build" },
        productionScriptNames,
      ),
    /resolves to unprotected script "deploy:production"/,
  );
});

test("an unregistered alternative-host configuration is rejected", async () => {
  const { productionDeploymentConfigurations, productionScriptNames, scripts } =
    await readPackageConfiguration();
  const deploymentConfigurations =
    await readProductionDeploymentConfigurations();

  assert.throws(
    () =>
      assertProductionDeploymentConfigurationsUseProtectedScripts(
        {
          ...deploymentConfigurations,
          "artifacts/alternative-host/vercel.json": JSON.stringify({
            buildCommand: "pnpm run build",
          }),
        },
        productionDeploymentConfigurations,
        scripts,
        productionScriptNames,
      ),
    /must list every detected supported production deployment configuration.*vercel\.json/,
  );
});

test("a Netlify production override cannot bypass a protected default build command", async () => {
  const { productionDeploymentConfigurations, productionScriptNames, scripts } =
    await readPackageConfiguration();
  const deploymentConfigurations =
    await readProductionDeploymentConfigurations();
  const configurationPath = "artifacts/alternative-host/netlify.toml";
  const netlifyConfiguration = `
[build]
command = "pnpm run build"

[context.production]
command = "pnpm run deploy:production"
`;

  assert.throws(
    () =>
      assertProductionDeploymentConfigurationsUseProtectedScripts(
        {
          ...deploymentConfigurations,
          [configurationPath]: netlifyConfiguration,
        },
        [...productionDeploymentConfigurations, configurationPath],
        { ...scripts, "deploy:production": "pnpm -r run build" },
        productionScriptNames,
      ),
    /netlify\.toml" resolves to unprotected script "deploy:production"/,
  );
});

test("a Railway TOML build command cannot bypass the release gate", async () => {
  const { productionDeploymentConfigurations, productionScriptNames, scripts } =
    await readPackageConfiguration();
  const deploymentConfigurations =
    await readProductionDeploymentConfigurations();
  const configurationPath = "railway.toml";

  assert.throws(
    () =>
      assertProductionDeploymentConfigurationsUseProtectedScripts(
        {
          ...deploymentConfigurations,
          [configurationPath]: `
[build]
buildCommand = "pnpm run deploy:production"
`,
        },
        [...productionDeploymentConfigurations, configurationPath],
        { ...scripts, "deploy:production": "pnpm -r run build" },
        productionScriptNames,
      ),
    /railway\.toml" resolves to unprotected script "deploy:production"/,
  );
});

test("every build entry point in a registered alternative-host configuration is checked", async () => {
  const { productionDeploymentConfigurations, productionScriptNames, scripts } =
    await readPackageConfiguration();
  const deploymentConfigurations =
    await readProductionDeploymentConfigurations();
  const renderConfiguration = `
services:
  - type: web
    buildCommand: pnpm run build
  - type: worker
    buildCommand: pnpm run deploy:worker
`;

  assert.throws(
    () =>
      assertProductionDeploymentConfigurationsUseProtectedScripts(
        { ...deploymentConfigurations, "render.yaml": renderConfiguration },
        [...productionDeploymentConfigurations, "render.yaml"],
        { ...scripts, "deploy:worker": "pnpm -r run build" },
        productionScriptNames,
      ),
    /"render\.yaml" resolves to unprotected script "deploy:worker"/,
  );
});

test("a new production build script cannot bypass the standard release gate", async () => {
  const { scripts, productionScriptNames } = await readPackageConfiguration();

  assert.throws(
    () =>
      assertProductionScriptsUseReleaseGate(
        { ...scripts, "build:ios:archive": "bash scripts/archive-ios.sh" },
        productionScriptNames,
      ),
    /script "build:ios:archive" must run the release gate before any production command/,
  );
});

test("a new packaging script cannot bypass the standard release gate", async () => {
  const { scripts, productionScriptNames } = await readPackageConfiguration();

  assert.throws(
    () =>
      assertProductionScriptsUseReleaseGate(
        { ...scripts, "package:desktop": "bash scripts/package-desktop.sh" },
        productionScriptNames,
      ),
    /script "package:desktop" must run the release gate before any production command/,
  );
});

test("a production script cannot run its build before the standard release gate", async () => {
  const { scripts, productionScriptNames } = await readPackageConfiguration();

  assert.throws(
    () =>
      assertProductionScriptsUseReleaseGate(
        {
          ...scripts,
          build: "pnpm -r --if-present run build && pnpm run check:release",
        },
        productionScriptNames,
      ),
    /script "build" must run the release gate before any production command/,
  );
});

test("release workflow invokes the release contract and standard validation", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  assertBlockingReleaseChecks(workflow);
});

test("release workflow rejects a non-blocking required check", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const nonBlockingWorkflow = workflow.replace(
    "        run: pnpm run check:release\n",
    "        run: pnpm run check:release\n        continue-on-error: true\n",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(nonBlockingWorkflow),
    /must remain blocking.*pnpm run check:release/,
  );
});

test("release workflow rejects job-level continue-on-error", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const nonBlockingWorkflow = workflow.replace(
    "    name: Route coverage & stale exemptions\n",
    "    name: Route coverage & stale exemptions\n    continue-on-error: true\n",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(nonBlockingWorkflow),
    /"check-routes" job must remain blocking/,
  );
});

test("release workflow rejects expression-valued job-level continue-on-error", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const nonBlockingWorkflow = workflow.replace(
    "    name: Route coverage & stale exemptions\n",
    "    name: Route coverage & stale exemptions\n    continue-on-error: ${{ true }}\n",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(nonBlockingWorkflow),
    /"check-routes" job must remain blocking/,
  );
});

test("release workflow rejects an expression-valued continue-on-error", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const nonBlockingWorkflow = workflow.replace(
    "        run: pnpm run check:release\n",
    "        run: pnpm run check:release\n        continue-on-error: ${{ true }}\n",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(nonBlockingWorkflow),
    /must remain blocking.*pnpm run check:release/,
  );
});

test("ignored contract step is rerun by the blocking standard validation", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const ignoredContractWorkflow = workflow.replace(
    "        run: pnpm run check:release-contract\n",
    "        run: pnpm run check:release-contract\n        continue-on-error: true\n",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(ignoredContractWorkflow),
    /must remain blocking.*pnpm run check:release-contract/,
  );

  const scripts = await readPackageScripts();
  const standardReleaseChecks = scripts["check:release"]
    ?.split("&&")
    .map((command) => command.trim());
  assert.ok(
    standardReleaseChecks?.includes("pnpm run check:release-contract"),
    "Blocking standard release validation must rerun the workflow contract",
  );
});

test("release workflow rejects sequence-leading continue-on-error", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const nonBlockingWorkflow = workflow.replace(
    "      - name: Run release validation\n        run: pnpm run check:release\n",
    "      - continue-on-error: true\n        name: Run release validation\n        run: pnpm run check:release\n",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(nonBlockingWorkflow),
    /must remain blocking.*pnpm run check:release/,
  );
});

test("release workflow rejects a required check moved to another job", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const movedWorkflow = workflow.replace(
    "      - name: Run release validation\n        run: pnpm run check:release\n",
    "",
  ).concat(`
  release-only:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm run check:release
`);

  assert.throws(
    () => assertBlockingReleaseChecks(movedWorkflow),
    /must be a step in the "check-routes" job/,
  );
});

test("release workflow rejects a nested check-routes key", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/check-routes.yml", import.meta.url),
    "utf8",
  );
  const nestedWorkflow = workflow.replace(
    /^jobs:\n  check-routes:/m,
    "jobs:\n  wrapper:\n    check-routes:",
  );

  assert.throws(
    () => assertBlockingReleaseChecks(nestedWorkflow),
    /must define the required "check-routes" job/,
  );
});
