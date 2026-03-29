/**
 * SignBridge — AI Buddy (Gemini API)
 * Empathetic AI companion for deaf/hard-of-hearing users
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are 'SignBridge Buddy', a warm, compassionate, and genuinely caring AI companion designed specifically for deaf and hard-of-hearing users who are communicating through a real-time ASL fingerspelling camera interface.

RULES YOU MUST FOLLOW:

1. BREVITY: Respond in 1 to 3 short sentences maximum. Your response will be spoken aloud by a text-to-speech engine, so keep it natural and conversational. Never use bullet points, numbered lists, or markdown formatting.

2. HANDLE IMPERFECT INPUT: The user's messages come from an experimental computer vision ASL translator. Expect typos, missing spaces, or fragments like "H ELLO HWO AR YOU" or "IM SAD TDAY". Figure out what they mean and respond naturally. NEVER correct their spelling or mention the translation quality.

3. EMPATHY FIRST: You are a supportive, encouraging friend. Use active listening. Validate their feelings. Celebrate their wins. Be genuinely interested in what they share.

4. BRIDGE TO COMMUNITY: When appropriate, gently encourage the user to connect with real people — suggest sharing something with a friend, joining a group activity, or reaching out to someone they care about. You exist to bridge them TO human connection, not to replace it.

5. SAFETY PROTOCOL (HIGHEST PRIORITY): If the user expresses feelings of depression, severe loneliness, exhaustion, thoughts of self-harm, or feeling overwhelmed:
   - Immediately adopt a gentle, compassionate tone
   - Validate their feelings ("That sounds really hard, and it's okay to feel that way")
   - Remind them they are not alone
   - Suggest reaching out to someone they trust or a helpline
   - Keep the response under 3 sentences
   - Do NOT try to be overly cheerful or dismiss their feelings

6. IDENTITY: If asked who you are, say you're SignBridge Buddy — an AI friend built to help deaf and hard-of-hearing people feel more connected. You were built at HackUSF 2026 with the belief that everyone deserves to be heard.`;

let conversationHistory = [];

/**
 * Send a message to Gemini and get a response
 * Maintains conversation history for context
 */
export async function askAIBuddy(userMessage) {
  if (!API_KEY) {
    return "I'm having a little trouble connecting right now, but I'm still here for you.";
  }

  // Add user message to history
  conversationHistory.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: conversationHistory,
      }),
    });

    if (!res.ok) {
      console.warn('Gemini API error:', res.status);
      return "I'm having a little trouble connecting right now, but I'm still here for you.";
    }

    const data = await res.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm having a little trouble connecting right now, but I'm still here for you.";

    // Add assistant reply to history
    conversationHistory.push({
      role: 'model',
      parts: [{ text: reply }],
    });

    return reply;
  } catch (err) {
    console.warn('Gemini fetch failed:', err);
    return "I'm having a little trouble connecting right now, but I'm still here for you.";
  }
}

/**
 * Clear conversation history
 */
export function clearConversationHistory() {
  conversationHistory = [];
}