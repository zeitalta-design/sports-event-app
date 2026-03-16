/**
 * LLM クライアント抽象層
 *
 * 環境変数に基づいて Gemini / OpenAI 互換 API を呼び出す。
 * golf-app の core/llm-client.js を移植。
 *
 * @module llm-client
 */

export function getLlmConfig() {
  return {
    enabled: process.env.LLM_ENABLED === "true",
    provider: process.env.LLM_PROVIDER || "gemini",
    apiKey: process.env.LLM_API_KEY || "",
    model:
      process.env.LLM_MODEL ||
      getDefaultModel(process.env.LLM_PROVIDER || "gemini"),
    timeoutMs:
      parseInt(process.env.LLM_TIMEOUT_MS || "60000", 10) || 60000,
    maxTokens:
      parseInt(process.env.LLM_MAX_TOKENS || "4096", 10) || 4096,
  };
}

function getDefaultModel(provider) {
  switch (provider) {
    case "gemini":
      return "gemini-2.0-flash";
    case "openai":
      return "gpt-4o-mini";
    default:
      return "gemini-2.0-flash";
  }
}

export function isLlmAvailable() {
  const cfg = getLlmConfig();
  return cfg.enabled && cfg.apiKey.length > 0;
}

/**
 * @param {{ systemPrompt: string, userPrompt: string }} params
 * @returns {{ text: string, usage: { inputTokens: number, outputTokens: number }, model: string, provider: string }}
 */
export async function callLlm({ systemPrompt, userPrompt }) {
  const cfg = getLlmConfig();

  if (!cfg.enabled) throw new Error("LLM is disabled (LLM_ENABLED != true)");
  if (!cfg.apiKey) throw new Error("LLM API key is not set (LLM_API_KEY)");

  const provider = cfg.provider;

  if (provider === "gemini") {
    return callGemini(cfg, systemPrompt, userPrompt);
  }
  if (provider === "openai") {
    return callOpenAI(cfg, systemPrompt, userPrompt);
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

async function callGemini(cfg, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.apiKey}`;

  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: cfg.maxTokens,
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata || {};

    return {
      text,
      usage: {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
      },
      model: cfg.model,
      provider: "gemini",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(cfg, systemPrompt, userPrompt) {
  const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const url = `${baseUrl}/chat/completions`;

  const body = {
    model: cfg.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: cfg.maxTokens,
    temperature: 0.3,
    response_format: { type: "json_object" },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenAI API ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};

    return {
      text,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      },
      model: cfg.model,
      provider: "openai",
    };
  } finally {
    clearTimeout(timeout);
  }
}
