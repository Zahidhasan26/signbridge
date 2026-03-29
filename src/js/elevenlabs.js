/**
 * SignBridge — ElevenLabs TTS Integration
 * Natural voice output with Web Speech API fallback
 * Supports male/female voice switching
 */

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const MODEL_ID = 'eleven_turbo_v2_5';

const VOICES = {
  male: 'wWWn96OtTHu1sn8SRGEr',
  female: 'DODLEQrClDo8wCz460ld',
};

let currentVoice = 'female'; // default
let audioQueue = [];
let isPlaying = false;

/**
 * Toggle between male and female voice
 * Returns the new voice name
 */
export function toggleVoice() {
  currentVoice = currentVoice === 'female' ? 'male' : 'female';
  return currentVoice;
}

/**
 * Get current voice name
 */
export function getCurrentVoice() {
  return currentVoice;
}

/**
 * Speak a word using ElevenLabs API
 */
export async function speakWord(word) {
  if (!word) return;

  if (!API_KEY) {
    fallbackSpeak(word);
    return;
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICES[currentVoice]}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: word,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      console.warn('ElevenLabs API error, falling back to Web Speech');
      fallbackSpeak(word);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = () => {
      URL.revokeObjectURL(url);
      isPlaying = false;
      playNext();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      isPlaying = false;
      fallbackSpeak(word);
      playNext();
    };

    audioQueue.push(audio);
    playNext();
  } catch (err) {
    console.warn('ElevenLabs fetch failed:', err);
    fallbackSpeak(word);
  }
}

/**
 * Speak the full transcript using ElevenLabs
 */
export async function speakFull(text) {
  if (!text) return;

  if (!API_KEY) {
    fallbackSpeak(text);
    return;
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICES[currentVoice]}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      fallbackSpeak(text);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  } catch (err) {
    fallbackSpeak(text);
  }
}

function playNext() {
  if (isPlaying || audioQueue.length === 0) return;
  isPlaying = true;
  const audio = audioQueue.shift();
  audio.play().catch(() => {
    isPlaying = false;
    playNext();
  });
}

function fallbackSpeak(text) {
  if (!window.speechSynthesis) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.9;
  utt.pitch = 1;
  speechSynthesis.speak(utt);
}