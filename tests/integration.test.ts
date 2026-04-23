import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import {
  AuthStorage,
  createAgentSession,
  createEventBus,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type LoadExtensionsResult,
  type ResourceLoader,
} from "@mariozechner/pi-coding-agent";
import {
  createExtensionRuntime,
  loadExtensionFromFactory,
} from "../node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/loader.js";
import effortExtension from "../index.ts";

const reasoningModel: Model<any> = {
  id: "minimax/minimax-m2.7",
  name: "MiniMax M2.7",
  api: "openai-completions",
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 196608,
  maxTokens: 4096,
};

function createResourceLoader(extensionsResult: LoadExtensionsResult): ResourceLoader {
  return {
    getExtensions: () => extensionsResult,
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => undefined,
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

test("runtime command changes session thinking level", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-effort-runtime-"));
  const agentDir = join(tempRoot, "agent");
  const cwd = join(tempRoot, "cwd");
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    const runtime = createExtensionRuntime();
    const eventBus = createEventBus();
    const extension = await loadExtensionFromFactory(effortExtension, cwd, eventBus, runtime, "<pi-effort-test>");
    const extensionsResult: LoadExtensionsResult = { extensions: [extension], errors: [], runtime };
    const resourceLoader = createResourceLoader(extensionsResult);

    const settingsManager = SettingsManager.create(cwd, agentDir);
    settingsManager.applyOverrides({ defaultThinkingLevel: "medium" });

    const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
    const modelRegistry = ModelRegistry.create(authStorage, join(agentDir, "models.json"));
    const sessionManager = SessionManager.inMemory();

    const { session } = await createAgentSession({
      cwd,
      agentDir,
      model: reasoningModel,
      thinkingLevel: "medium",
      settingsManager,
      authStorage,
      modelRegistry,
      sessionManager,
      resourceLoader,
    });

    await session.prompt("/effort high");

    assert.equal(session.thinkingLevel, "high");
    assert.equal(settingsManager.getDefaultThinkingLevel(), "high");
  } finally {
    if (previousAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    }
  }
});

test("runtime default command writes temporary agent settings file", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-effort-runtime-"));
  const agentDir = join(tempRoot, "agent");
  const cwd = join(tempRoot, "cwd");
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    const runtime = createExtensionRuntime();
    const eventBus = createEventBus();
    const extension = await loadExtensionFromFactory(effortExtension, cwd, eventBus, runtime, "<pi-effort-test>");
    const extensionsResult: LoadExtensionsResult = { extensions: [extension], errors: [], runtime };
    const resourceLoader = createResourceLoader(extensionsResult);

    const settingsManager = SettingsManager.create(cwd, agentDir);
    settingsManager.applyOverrides({ defaultThinkingLevel: "medium" });

    const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
    const modelRegistry = ModelRegistry.create(authStorage, join(agentDir, "models.json"));
    const sessionManager = SessionManager.inMemory();

    const { session } = await createAgentSession({
      cwd,
      agentDir,
      model: reasoningModel,
      thinkingLevel: "medium",
      settingsManager,
      authStorage,
      modelRegistry,
      sessionManager,
      resourceLoader,
    });

    await session.prompt("/effort default high");

    const persisted = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf-8"));
    assert.equal(persisted.defaultThinkingLevel, "high");
  } finally {
    if (previousAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    }
  }
});

test("new sessions inherit defaultThinkingLevel from Pi settings without extension startup logic", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pi-effort-runtime-"));
  const agentDir = join(tempRoot, "agent");
  const cwd = join(tempRoot, "cwd");
  mkdirSync(agentDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    const runtime = createExtensionRuntime();
    const eventBus = createEventBus();
    const extension = await loadExtensionFromFactory(effortExtension, cwd, eventBus, runtime, "<pi-effort-test>");
    const extensionsResult: LoadExtensionsResult = { extensions: [extension], errors: [], runtime };
    const resourceLoader = createResourceLoader(extensionsResult);

    const settingsManager = SettingsManager.create(cwd, agentDir);
    settingsManager.applyOverrides({ defaultThinkingLevel: "high" });

    const authStorage = AuthStorage.create(join(agentDir, "auth.json"));
    const modelRegistry = ModelRegistry.create(authStorage, join(agentDir, "models.json"));
    const sessionManager = SessionManager.inMemory();

    const { session } = await createAgentSession({
      cwd,
      agentDir,
      model: reasoningModel,
      settingsManager,
      authStorage,
      modelRegistry,
      sessionManager,
      resourceLoader,
    });

    assert.equal(session.thinkingLevel, "high");
  } finally {
    if (previousAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    }
  }
});
