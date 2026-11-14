import Cocoa
import WebKit

final class WebViewController: NSViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private(set) var webView: WKWebView!
    private var progressIndicator: NSProgressIndicator!

    override func loadView() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let userContent = configuration.userContentController

        // Inject bridge.js
        if let bridgePath = Bundle.main.path(forResource: "bridge", ofType: "js"),
           let bridgeCode = try? String(contentsOfFile: bridgePath, encoding: .utf8) {
            let bridgeScript = WKUserScript(source: bridgeCode, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            userContent.addUserScript(bridgeScript)
        }

        // Inject content.js
        if let contentPath = Bundle.main.path(forResource: "content", ofType: "js"),
           let contentCode = try? String(contentsOfFile: contentPath, encoding: .utf8) {
            let contentScript = WKUserScript(source: contentCode, injectionTime: .atDocumentStart, forMainFrameOnly: false)
            userContent.addUserScript(contentScript)
        }

        userContent.add(self, name: "aliceBridge")

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false

        let root = NSView()
        root.addSubview(webView)

        progressIndicator = NSProgressIndicator()
        progressIndicator.style = .bar
        progressIndicator.isIndeterminate = false
        progressIndicator.minValue = 0.0
        progressIndicator.maxValue = 1.0
        progressIndicator.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(progressIndicator)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: root.topAnchor),
            webView.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: root.bottomAnchor),

            progressIndicator.topAnchor.constraint(equalTo: root.topAnchor),
            progressIndicator.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            progressIndicator.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            progressIndicator.heightAnchor.constraint(equalToConstant: 2)
        ])

        webView.addObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress), options: .new, context: nil)
        webView.addObserver(self, forKeyPath: #keyPath(WKWebView.canGoBack), options: .new, context: nil)
        webView.addObserver(self, forKeyPath: #keyPath(WKWebView.canGoForward), options: .new, context: nil)

        self.view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        loadInitialPage()
    }

    deinit {
        webView.removeObserver(self, forKeyPath: #keyPath(WKWebView.estimatedProgress))
        webView.removeObserver(self, forKeyPath: #keyPath(WKWebView.canGoBack))
        webView.removeObserver(self, forKeyPath: #keyPath(WKWebView.canGoForward))
    }

    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
        if keyPath == #keyPath(WKWebView.estimatedProgress) {
            let progress = webView.estimatedProgress
            progressIndicator.doubleValue = progress
            progressIndicator.isHidden = progress >= 1.0
        } else if keyPath == #keyPath(WKWebView.canGoBack) || keyPath == #keyPath(WKWebView.canGoForward) {
            MainWindowController.shared.updateNavigationButtons()
        } else {
            super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
        }
    }

    func loadInitialPage() {
        if let url = URL(string: "https://alice.yandex.ru/") {
            var request = URLRequest(url: url)
            request.cachePolicy = .useProtocolCachePolicy
            webView.load(request)
        }
    }

    func reload() {
        webView.reload()
    }

    func goBack() {
        if webView.canGoBack {
            webView.goBack()
        }
    }

    func goForward() {
        if webView.canGoForward {
            webView.goForward()
        }
    }

    func newChat() {
        webView.evaluateJavaScript("window.__aliceSetMode('newChat');") { [weak self] _, error in
            if error != nil {
                self?.loadInitialPage()
            }
        }
    }

    func setMode(_ mode: String) {
        webView.evaluateJavaScript("window.__aliceSetMode('\(mode)');", completionHandler: nil)
    }

    func applySettings(jsonStr: String) {
        webView.evaluateJavaScript("window.__aliceApplySettings(\(jsonStr));", completionHandler: nil)
    }

    // MARK: - WKScriptMessageHandler
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "aliceBridge",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        if type == "translate",
           let reqId = body["id"] as? String,
           let text = body["text"] as? String {
            let targetLang = body["targetLang"] as? String ?? "en"
            TranslationService.shared.translate(text: text, targetLang: targetLang) { [weak self] result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let translated):
                        if let encoded = try? JSONSerialization.data(withJSONObject: [translated], options: []),
                           let str = String(data: encoded, encoding: .utf8),
                           let jsonLiteral = str.dropFirst().dropLast().description as String? {
                            self?.webView.evaluateJavaScript("window.__aliceNativeCallback('\(reqId)', true, \(jsonLiteral), null);", completionHandler: nil)
                        } else {
                            self?.webView.evaluateJavaScript("window.__aliceNativeCallback('\(reqId)', true, \(String(reflecting: translated)), null);", completionHandler: nil)
                        }
                    case .failure(let err):
                        self?.webView.evaluateJavaScript("window.__aliceNativeCallback('\(reqId)', false, null, \(String(reflecting: err.localizedDescription)));", completionHandler: nil)
                    }
                }
            }
        }
    }

    // MARK: - WKNavigationDelegate
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        let host = url.host?.lowercased() ?? ""
        let isYandex = host.contains("yandex.") || host.contains("ya.ru") || host.contains("yastatic.net")
        let isGoogleTranslate = host.contains("translate.googleapis.com")

        if isYandex || isGoogleTranslate || host.isEmpty {
            decisionHandler(.allow)
        } else if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    // MARK: - WKUIDelegate (Popups, Uploads, Microphone, Dialogs)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            let host = url.host?.lowercased() ?? ""
            if host.contains("yandex.") || host.contains("ya.ru") {
                webView.load(navigationAction.request)
            } else {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseFiles = true
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.beginSheetModal(for: self.view.window ?? NSApp.mainWindow!) { response in
            if response == .OK {
                completionHandler(panel.urls)
            } else {
                completionHandler(nil)
            }
        }
    }

    @available(macOS 12.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = "Alice AI"
        alert.informativeText = message
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Alice AI"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }
}
