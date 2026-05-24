/**
 * Sukoon AI Agent service — calls the standalone agent server (hosted on Render).
 * Using HTTP + Firebase ID token auth avoids the Firebase Blaze plan requirement.
 */

import { isFirebaseConfigured, hasNativeFirebaseModules } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Agent server URL ──────────────────────────────────────────────────────────
// After deploying to Render, the URL will be https://sukoon-agent.onrender.com
// (matches the service name in render.yaml). Update if you use a custom domain.
const AGENT_SERVER_URL = __DEV__
  ? 'http://192.168.100.71:3000'          // local dev: your machine LAN IP
  : 'https://sukoon-agent.onrender.com';   // production Render URL
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'sukoon_agent_session_id';

async function getIdToken(): Promise<string | null> {
  if (!isFirebaseConfigured() || !hasNativeFirebaseModules()) return null;
  try {
    const authModule = await import('@react-native-firebase/auth');
    const user = authModule.default().currentUser;
    if (!user) return null;
    return user.getIdToken();
  } catch {
    return null;
  }
}

/** Returns a stable session ID for this app installation, persisted across restarts. */
export async function getOrCreateSessionId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(SESSION_KEY);
    if (existing) return existing;
  } catch {}

  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

  try {
    await AsyncStorage.setItem(SESSION_KEY, id);
  } catch {}

  return id;
}

/** Resets the session so the agent starts fresh (no conversation history). */
export async function resetSession(): Promise<string> {
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
  try {
    await AsyncStorage.setItem(SESSION_KEY, id);
  } catch {}
  return id;
}

export interface NavigateQuranCommand {
  action: 'navigate_quran';
  surah: number;
  ayah: number;
  surah_name: string;
  message: string;
}

export interface AgentResponse {
  reply: string;
  commands: NavigateQuranCommand[];
  session_id: string;
}

export class AgentUnavailableError extends Error {
  constructor() {
    super('AGENT_UNAVAILABLE');
  }
}

export class AgentRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentRateLimitError';
  }
}

export const AgentService = {
  async sendMessage(message: string, sessionId: string): Promise<AgentResponse> {
    const token = await getIdToken();
    if (!token) throw new AgentUnavailableError();

    let res: Response;
    try {
      res = await fetch(`${AGENT_SERVER_URL}/agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, sessionId }),
      });
    } catch (networkErr: any) {
      if (__DEV__) console.warn('[AgentService] Network error:', networkErr);
      throw new AgentUnavailableError();
    }

    if (res.status === 401) {
      throw new Error('Please sign in to use Sukoon AI.');
    }
    if (res.status === 429) {
      const body = await res.json().catch(() => ({})) as any;
      throw new AgentRateLimitError(
        body?.message || 'Daily message limit reached. Please come back tomorrow, InshaAllah.'
      );
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      throw new Error(body?.message || 'Something went wrong. Please try again.');
    }

    return res.json() as Promise<AgentResponse>;
  },

  getOrCreateSessionId,
  resetSession,
};

export default AgentService;
