import type { Lead, Message, LeadExtraction, CreateLeadPayload } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const api = {
  listMessages: () => getJson<Message[]>("/api/messages"),
  getMessage: (messageId: string) => getJson<Message>(`/api/messages/${encodeURIComponent(messageId)}`),
  listLeads: () => getJson<Lead[]>("/api/leads"),
  extractLead: (messageId: string) => sendJson<LeadExtraction>("/api/ai/extract", "POST", { messageId }),
  createLead: (payload: CreateLeadPayload) => sendJson<Lead>("/api/leads", "POST", payload),
  updateLeadStatus: (leadId: string) => sendJson<Lead>(`/api/leads/${encodeURIComponent(leadId)}/status`, "PATCH", { status: "CONTACTED" }),
};
