import apiClient from "./httpClient";

type AiTutorMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiTutorOptions = {
  chatHistory?: AiTutorMessage[];
  temperature?: number;
};

export type AiTutorLink = {
  text: string;
  path: string;
  icon?: string | null;
};

export type AiTutorPayload = {
  text: string;
  link: AiTutorLink | null;
  links: AiTutorLink[] | null;
};

export async function requestAiTutorResponse(
  prompt: string,
  options: AiTutorOptions = {},
): Promise<string> {
  const payload = await requestAiTutorPayload(prompt, options);
  return payload.text;
}

export async function requestAiTutorPayload(
  prompt: string,
  options: AiTutorOptions = {},
): Promise<AiTutorPayload> {
  const response = await apiClient.post("/proxy/openai/", {
    inputs: prompt,
    chatHistory: options.chatHistory ?? [],
    parameters: {
      temperature: options.temperature ?? 0.4,
    },
  });

  const data = response?.data ?? {};
  return {
    text: String(data.response || "").trim(),
    link: data.link ?? null,
    links: Array.isArray(data.links) ? data.links : null,
  };
}
