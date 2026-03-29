Markdown
# SignBridge

**Real-time ASL translation meets an empathetic AI companion to bridge the gap in human connection.**

Built for the HackUSF 2026, SignBridge is a zero-latency, private ASL-to-text translator featuring an autonomous, voice-enabled AI Buddy designed to combat isolation in the deaf and hard-of-hearing community.

---

##  Features

* **Live Edge-Computed Translation:** Translates ASL fingerspelling (A-Z) and full phrase gestures ("Hello", "I Love You") into English text in real-time.
* **Dynamic Velocity Gestures:** Features a custom mathematical engine that tracks wrist history, allowing users to physically "swipe" their hand across the screen to backspace/delete.
* **Empathetic AI Buddy:** Powered by Gemini 2.5 Flash, the Buddy acts as a peer companion. It features a strict "Safety Protocol" that autonomously pivots to compassionate validation if the user expresses emotional distress.
* **Voice Output:** Integrates ElevenLabs to generate natural, human-sounding audio of the translated text, bridging the gap to the hearing world.
* **100% Private:** Computer vision runs entirely locally in the browser via WebAssembly. No camera data ever leaves the user's device.

## 🛠️ Technology Stack

* **Frontend:** Vanilla JavaScript, HTML5, CSS3
* **Computer Vision:** Google MediaPipe Hand Landmarker (Client-side WebAssembly)
* **LLM Engine:** Google Gemini 2.5 Flash API
* **Text-to-Speech:** ElevenLabs API

## How We Built It

Instead of relying on heavy, laggy cloud vision models, we built a **custom deterministic heuristic engine** in JavaScript. By calculating the 3D Euclidean distance and joint angles of the PIP, DIP, and MCP joints in real-time from MediaPipe's 21 hand landmarks, we classify ASL signs instantly and locally. 

This allowed us to achieve zero latency, perfectly setting up our Gemini and ElevenLabs APIs to handle the heavy lifting of natural conversation and empathy.



Built in USF, Tampa, Florida for HackUSF 2026.

