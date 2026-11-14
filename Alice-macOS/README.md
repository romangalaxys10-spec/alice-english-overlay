# Alice AI — Native macOS App

A lightweight, high-performance native macOS desktop application for **Alice AI** with integrated **English Overlay**, machine-translation proxy, adaptive responsive UI, and macOS window management.

---

## Highlights

- **Pure Native Swift & AppKit/WebKit**: Instant cold start, ~580 KB total footprint (compared to ~250 MB for Electron), minimal memory consumption.
- **Embedded English Overlay**: Bundles the full dictionary translation, prompt starter chips, adaptive mode bar, and upsell hider directly into the web runtime.
- **Native Translation Bridge**: Routes assistant reply translations through native `URLSession` to Google Translate (`gtx`) with automatic MyMemory fallback, bypassing web Content Security Policy (CSP) limitations.
- **Fully Adaptive Responsive UI**:
  - Automatically adapts from full screen down to a 480px compact companion sidebar.
  - Centered mode bar that dynamically tracks the input container regardless of sidebar width.
  - Breakpoints for mode pills (collapses smoothly to compact text or clean icons on narrow screens).
  - 2x2 grid of prompt cards that prevents layout overflow on shorter windows.
- **macOS Window Presets**: Smooth animated resizing shortcuts for split-screen multitasking.
- **Persistent Storage**: Retains Yandex ID logins, session cookies, and anonymous local state across restarts via `WKWebsiteDataStore.default()`.
- **macOS System Integration**:
  - Full Menu Bar (File, Edit, View, History, Window, Help)
  - Standard clipboard shortcuts (`Cmd + C`, `Cmd + V`, `Cmd + X`, `Cmd + A`, `Cmd + Z`)
  - Zoom controls (`Cmd + +`, `Cmd + -`, `Cmd + 0`)
  - Native file upload sheets for image analysis and math problem solving
  - Microphone access support for voice input and dictation
  - AppIcon with high-res Retina assets

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd + Opt + 1` | **Compact Window** (680 × 720) |
| `Cmd + Opt + 2` | **Standard Window** (1024 × 780) |
| `Cmd + Opt + 3` | **Wide Window** (1280 × 860) |
| `Cmd + Opt + 4` | **Companion Sidebar** (520 × Screen Height, docks right) |
| `Cmd + Opt + C` | **Center Window** on current screen |
| `Cmd + N` | Start a new chat |
| `Cmd + R` | Reload current page |
| `Cmd + Shift + R` | Force reload from server |
| `Cmd + [` | Go Back in history |
| `Cmd + ]` | Go Forward in history |
| `Cmd + ,` | Open Preferences |
| `Cmd + +` / `Cmd + =` | Zoom in |
| `Cmd + -` | Zoom out |
| `Cmd + 0` | Reset zoom to 100% |
| `Cmd + W` | Close window |
| `Cmd + Q` | Quit application |

---

## Build Instructions

To recompile or package the application at any time:

```bash
cd Alice-macOS
./build.sh
```

The script:
1. Compiles all Swift sources using `swiftc -O` targeting macOS 12.0+.
2. Assembles the `Alice.app` bundle in the repository root.
3. Copies all necessary runtime scripts (`content.js`, `bridge.js`), icons, and `Info.plist`.
4. Applies ad-hoc codesigning (`codesign --sign -`) so macOS Gatekeeper allows immediate launch.

---

## Installation

Move `Alice.app` to your `/Applications` folder:

```bash
cp -R Alice.app /Applications/
```

Or open it directly from the workspace:

```bash
open Alice.app
```
