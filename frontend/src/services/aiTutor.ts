import apiClient from "services/httpClient";

type AiTutorMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiTutorOptions = {
  chatHistory?: AiTutorMessage[];
  temperature?: number;
};

export async function requestAiTutorResponse(
  prompt: string,
  options: AiTutorOptions = {}
): Promise<string> {
  const response = await apiClient.post("/proxy/openai/", {
    inputs: prompt,
    chatHistory: options.chatHistory ?? [],
    parameters: {
      temperature: options.temperature ?? 0.4,
    },
  });

  return String(response?.data?.response || "").trim();
}
