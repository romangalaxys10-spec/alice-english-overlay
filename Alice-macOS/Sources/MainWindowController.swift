import Cocoa
import WebKit

final class MainWindowController: NSWindowController {
    static let shared = MainWindowController()

    let webViewController = WebViewController()

    init() {
        let screen = NSScreen.main
        let visible = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let defaultWidth: CGFloat = min(1200, max(1060, visible.width * 0.78))
        let defaultHeight: CGFloat = min(840, max(760, visible.height * 0.84))
        let originX = visible.midX - defaultWidth / 2
        let originY = visible.midY - defaultHeight / 2

        let window = NSWindow(
            contentRect: NSRect(x: originX, y: originY, width: defaultWidth, height: defaultHeight),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.minSize = NSSize(width: 580, height: 500)
        window.title = "Alice AI"
        window.titleVisibility = .visible
        window.setFrameAutosaveName("AliceMainWindowFrame_v4")
        window.isReleasedWhenClosed = false

        super.init(window: window)

        window.contentViewController = webViewController
    }

    func ensureOptimalSize() {
        guard let window = self.window, let screen = window.screen ?? NSScreen.main else { return }
        let visible = screen.visibleFrame
        if window.frame.width < 960 || window.frame.height < 720 {
            let targetW = min(1200, max(1060, visible.width * 0.78))
            let targetH = min(840, max(760, visible.height * 0.84))
            let targetRect = NSRect(
                x: visible.midX - targetW / 2,
                y: visible.midY - targetH / 2,
                width: targetW,
                height: targetH
            )
            window.setFrame(targetRect, display: true, animate: false)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func updateNavigationButtons() {
        // Handled via menu items & gestures
    }

    // MARK: - Window Resizing Presets
    func resizeTo(width: CGFloat, height: CGFloat, center: Bool = false, dockRight: Bool = false) {
        guard let window = self.window, let screen = window.screen ?? NSScreen.main else { return }
        let visible = screen.visibleFrame
        let w = min(width, visible.width)
        let h = min(height, visible.height)

        var newOrigin = window.frame.origin
        if dockRight {
            newOrigin = CGPoint(x: visible.maxX - w, y: visible.minY)
        } else if center {
            newOrigin = CGPoint(x: visible.midX - w / 2, y: visible.midY - h / 2)
        } else {
            let currentTop = window.frame.maxY
            newOrigin.y = max(visible.minY, currentTop - h)
            if newOrigin.x + w > visible.maxX {
                newOrigin.x = max(visible.minX, visible.maxX - w)
            }
        }

        let targetRect = CGRect(x: newOrigin.x, y: newOrigin.y, width: w, height: h)
        window.setFrame(targetRect, display: true, animate: true)
    }

    @objc func resizeCompact() {
        resizeTo(width: 680, height: 720)
    }

    @objc func resizeStandard() {
        resizeTo(width: 1024, height: 780)
    }

    @objc func resizeWide() {
        resizeTo(width: 1280, height: 860)
    }

    @objc func resizeCompanion() {
        guard let screen = self.window?.screen ?? NSScreen.main else { return }
        let h = screen.visibleFrame.height
        resizeTo(width: 520, height: h, dockRight: true)
    }

    @objc func centerWindow() {
        guard let window = self.window else { return }
        resizeTo(width: window.frame.width, height: window.frame.height, center: true)
    }

    // MARK: - Actions
    @objc func backClicked() {
        webViewController.goBack()
    }

    @objc func forwardClicked() {
        webViewController.goForward()
    }

    @objc func reloadClicked() {
        webViewController.reload()
    }

    @objc func newChatClicked() {
        webViewController.newChat()
    }

    @objc func preferencesClicked() {
        PreferencesWindowController.shared.showWindow(nil)
        PreferencesWindowController.shared.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func zoomIn() {
        webViewController.webView.pageZoom += 0.1
    }

    func zoomOut() {
        if webViewController.webView.pageZoom > 0.4 {
            webViewController.webView.pageZoom -= 0.1
        }
    }

    func resetZoom() {
        webViewController.webView.pageZoom = 1.0
    }
}
