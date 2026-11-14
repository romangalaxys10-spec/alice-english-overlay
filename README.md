# Alice AI: English Overlay & Native macOS App

Experience Yandex Alice AI in complete English. Available both as a pure native macOS desktop application and as a lightweight browser extension for Chrome, Brave, Arc, and Edge.

Alice AI (alice.yandex.ru) is a powerful, free conversational AI developed by Yandex. It includes advanced reasoning, image generation, math problem solving, and shopping deal search. Alice offers full anonymous access without requiring an account or credit card. However, its native interface and responses are primarily in Russian.

This project bridges that gap by providing a real-time English interface, automatic English replies, an adaptive intelligence mode bar, starter prompts, and clean ad-free styling.

---

## Key Features

- **Native macOS Desktop Application**: Built with Swift and WebKit. Launches instantly with under 600 KB total app bundle footprint, using a fraction of the memory of Electron wrappers.
- **Chrome / Chromium Browser Extension**: Fully compliant with Manifest V3. Runs seamlessly on Chrome, Brave, Arc, Edge, and Opera.
- **Real-Time Dynamic UI Translation**: Translates Russian buttons, placeholders, menus, and system prompts into clean English via a MutationObserver and curated dictionary.
- **Auto-English Prompt Injection**: Automatically prepends English response instructions to outbound queries so Alice replies in English.
- **Integrated Machine Translation Proxy**: Adds an "EN" translate button underneath Alice's replies. Uses native networking and Google Translate with automatic fallback to MyMemory to translate any residual Russian text, bypassing web Content Security Policy limitations.
- **Floating Intelligence Mode Bar**: Quick switching between Alice modes:
  - **Auto**: Balanced everyday intelligence.
  - **Expert**: Deep reasoning and complex problem analysis.
  - **Draw**: Image generation and creative visuals.
  - **Deals**: Product pricing and shopping search.
  - **Math**: Step-by-step math solver.
- **Adaptive Responsive Design**: The UI dynamically scales from full screen down to a 480px companion sidebar. The mode bar automatically centers over the input container and collapses to compact icon pills on smaller viewports.
- **Ad & Upsell Blocker**: Cleans up promotional banners, mobile app install prompts, and login popups, keeping the focus entirely on your conversation.
- **Context Carry**: Optionally summarizes your previous discussion and carries context into fresh chats.
- **macOS Window Presets**: Smooth animated resizing shortcuts for split-screen workflows.

---

## macOS Native App

The native macOS application is located in the `Alice-macOS` folder.

### Window Management Shortcuts

| Shortcut | Description |
| :--- | :--- |
| `Cmd + Opt + 1` | Compact window (680 × 720) |
| `Cmd + Opt + 2` | Standard window (1024 × 780) |
| `Cmd + Opt + 3` | Wide window (1280 × 860) |
| `Cmd + Opt + 4` | Companion sidebar (520 × Screen Height, docks right) |
| `Cmd + Opt + C` | Center window on current monitor |
| `Cmd + N` | Start a new chat |
| `Cmd + R` | Reload page |
| `Cmd + Shift + R` | Force reload from network |
| `Cmd + [` / `Cmd + ]` | Back / Forward in browsing history |
| `Cmd + ,` | Open Preferences dialog |
| `Cmd + +` / `Cmd + -` | Zoom in / Zoom out |
| `Cmd + 0` | Reset zoom to 100% |

### Building from Source

To compile the macOS app locally:

```bash
cd Alice-macOS
chmod +x build.sh
./build.sh
```

This compiles all Swift sources with optimizations targeting macOS 12.0+, packages `Alice.app`, bundles required runtime resources, and applies an ad-hoc codesign.

You can then launch the app:

```bash
open Alice.app
```

Or move it to your system Applications folder:

```bash
cp -R Alice.app /Applications/
```

---

## Browser Extension (Chrome, Brave, Arc, Edge)

Install the extension directly in developer mode:

1. Clone or download this repository.
2. Open your browser extension manager:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the root directory of this repository (where `manifest.json` is located).
5. Navigate to [alice.yandex.ru](https://alice.yandex.ru) to experience Alice in English.

---

## Settings & Preferences

Click the gear icon in the mode bar (or press `Cmd + ,` in the macOS app) to toggle features:

- **Reply in English (auto)**: Silently injects an instruction for Alice to respond in English.
- **'EN' translate button**: Displays a quick translation button under assistant messages.
- **English prompt chips**: Shows quick starter prompt cards on the welcome screen.
- **Hide ads & login upsells**: Blocks login nag screens and promotional elements.
- **Carry context to new chats**: Preserves key topic context when starting a new session.
- **Show mode bar**: Toggles the floating mode selector bar.

---

## Technical Architecture

- **Extension Framework**: Chrome Extension Manifest V3 with non-persistent background service worker for translation proxying.
- **Native Host**: Swift 6, AppKit, and WebKit (WKWebView).
- **Session Persistence**: Utilizes `WKWebsiteDataStore.default()` to retain anonymous cookies and optional Yandex ID authentication across restarts.
- **Security & Privacy**: Communicates exclusively with official Yandex endpoints (`alice.yandex.ru`), Google Translate, and MyMemory. No user analytics, telemetry, or personal chat history is collected or transmitted to third-party servers.

---

## License

MIT License. See the [LICENSE](LICENSE) file for details.
