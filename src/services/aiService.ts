import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const functions = getFunctions(app, 'us-central1');

export type AIChatRole = 'user' | 'assistant';

export type AIChatImage = {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string;
};

export type AIChatMessage = {
  role: AIChatRole;
  content: string;
  images?: AIChatImage[];
};

export type AIChatResponse = {
  text: string;
  usage: { input_tokens: number; output_tokens: number };
};

export async function sendAIChatMessage(messages: AIChatMessage[]): Promise<AIChatResponse> {
  const aiChat = httpsCallable<{ messages: AIChatMessage[] }, AIChatResponse>(functions, 'aiChat');
  const result = await aiChat({ messages });
  return result.data;
}
