import { readFile } from "node:fs/promises";

export type GroqMessageRole = "system" | "user" | "assistant";

export type GroqMessage = {
  role: GroqMessageRole;
  content: string;
};

export type GroqChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: { type: "json_object" | "text" };
};

type GroqChoice = {
  index: number;
  finish_reason: string | null;
  message: {
    role: GroqMessageRole;
    content: string;
  };
};

export type GroqChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

type FetchErrorLike = Error & {
  cause?: unknown;
  code?: string;
  errno?: string | number;
  syscall?: string;
  hostname?: string;
  address?: string;
  port?: number;
};

type FetchInitWithDispatcher = RequestInit & {
  dispatcher?: unknown;
};

function getGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY in environment.");
  }
  return apiKey;
}

function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function describeFetchFailure(error: unknown): {
  message: string;
  code?: string;
  errno?: string | number;
  syscall?: string;
  hostname?: string;
  address?: string;
  port?: number;
} {
  const asError = error as FetchErrorLike;
  const cause = asError?.cause as FetchErrorLike | undefined;

  return {
    message: asError?.message || "fetch failed",
    code: asError?.code || cause?.code,
    errno: asError?.errno || cause?.errno,
    syscall: asError?.syscall || cause?.syscall,
    hostname: asError?.hostname || cause?.hostname,
    address: asError?.address || cause?.address,
    port: asError?.port || cause?.port,
  };
}

function isCertificateError(details: ReturnType<typeof describeFetchFailure>): boolean {
  const combined = `${details.message} ${details.code ?? ""}`.toUpperCase();
  return (
    combined.includes("UNABLE_TO_GET_ISSUER_CERT_LOCALLY") ||
    combined.includes("SELF_SIGNED_CERT") ||
    combined.includes("CERT_HAS_EXPIRED") ||
    combined.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE")
  );
}

async function getOptionalGroqDispatcher(): Promise<unknown | undefined> {
  const caPath = process.env.GROQ_CA_CERT_PATH?.trim();
  if (!caPath) {
    return undefined;
  }

  const { Agent } = await import("undici");
  const ca = await readFile(caPath, "utf8");
  return new Agent({
    connect: {
      ca,
    },
  });
}

export async function requestGroqChatCompletion(
  messages: GroqMessage[],
  options: GroqChatOptions = {}
): Promise<GroqChatCompletionResponse> {
  if (messages.length === 0) {
    throw new Error("At least one message is required for Groq completion.");
  }

  const apiKey = getGroqApiKey();
  const dispatcher = await getOptionalGroqDispatcher();

  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model ?? DEFAULT_GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        response_format: options.responseFormat,
      }),
      dispatcher,
    } as FetchInitWithDispatcher);
  } catch (error) {
    const details = describeFetchFailure(error);
    const proxyConfigured = Boolean(
      process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.HTTP_PROXY ||
        process.env.http_proxy
    );

    const diagnosticParts = [
      details.code ? `code=${details.code}` : "",
      details.errno != null ? `errno=${String(details.errno)}` : "",
      details.syscall ? `syscall=${details.syscall}` : "",
      details.hostname ? `host=${details.hostname}` : "",
      details.port != null ? `port=${String(details.port)}` : "",
      `proxyConfigured=${String(proxyConfigured)}`,
      `customCaConfigured=${String(Boolean(process.env.GROQ_CA_CERT_PATH?.trim()))}`,
      `node=${process.version}`,
    ].filter(Boolean);

    const remediation = isCertificateError(details)
      ? " Certificate trust failed while connecting to Groq. If your network uses a custom/intercepting CA, set NODE_EXTRA_CA_CERTS or GROQ_CA_CERT_PATH to that PEM certificate bundle."
      : "";

    throw new Error(
      `Groq network request failed: ${details.message}${
        diagnosticParts.length ? ` [${diagnosticParts.join(", ")}]` : ""
      }${remediation}`
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${sanitizeText(errorText)}`);
  }

  const data = (await response.json()) as GroqChatCompletionResponse;
  if (!data.choices?.length || !data.choices[0].message?.content) {
    throw new Error("Groq returned an empty response.");
  }

  return data;
}

export async function getGroqTextResponse(
  userPrompt: string,
  options: GroqChatOptions & { systemPrompt?: string } = {}
): Promise<string> {
  if (!userPrompt.trim()) {
    throw new Error("userPrompt cannot be empty.");
  }

  const messages: GroqMessage[] = [];
  if (options.systemPrompt?.trim()) {
    messages.push({ role: "system", content: options.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: userPrompt.trim() });

  const completion = await requestGroqChatCompletion(messages, options);
  return completion.choices[0].message.content.trim();
}
