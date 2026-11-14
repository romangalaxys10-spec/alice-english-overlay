import Cocoa
import WebKit

final class PreferencesWindowController: NSWindowController, NSTextViewDelegate {
    static let shared = PreferencesWindowController()

    struct PreferenceKeys {
        static let targetLang = "targetLang"
        static let customInstructions = "customInstructions"
        static let enReplies = "enReplies"
        static let translateBtn = "translateBtn"
        static let chips = "chips"
        static let hideUpsell = "hideUpsell"
        static let carryContext = "carryContext"
        static let modeBar = "modeBar"
    }

    static let languageList: [(code: String, name: String)] = [
        ("en", "English"),
        ("es", "Spanish (Español)"),
        ("fr", "French (Français)"),
        ("de", "German (Deutsch)"),
        ("it", "Italian (Italiano)"),
        ("pt", "Portuguese (Português)"),
        ("zh", "Chinese (中文)"),
        ("ja", "Japanese (日本語)"),
        ("ko", "Korean (한국어)"),
        ("ar", "Arabic (العربية)"),
        ("tr", "Turkish (Türkçe)"),
        ("uk", "Ukrainian (Українська)"),
        ("ru", "Russian Original (Русский)")
    ]

    private var checkboxes: [String: NSButton] = [:]
    private var languagePopup: NSPopUpButton?
    private var instructionsTextView: NSTextView?

    init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 540),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Alice AI Preferences"
        window.center()
        window.isReleasedWhenClosed = false
        super.init(window: window)
        setupUI()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    static var currentSettings: [String: Any] {
        let defaults = UserDefaults.standard
        return [
            PreferenceKeys.targetLang: defaults.string(forKey: PreferenceKeys.targetLang) ?? "en",
            PreferenceKeys.customInstructions: defaults.string(forKey: PreferenceKeys.customInstructions) ?? "",
            PreferenceKeys.enReplies: defaults.object(forKey: PreferenceKeys.enReplies) as? Bool ?? true,
            PreferenceKeys.translateBtn: defaults.object(forKey: PreferenceKeys.translateBtn) as? Bool ?? true,
            PreferenceKeys.chips: defaults.object(forKey: PreferenceKeys.chips) as? Bool ?? true,
            PreferenceKeys.hideUpsell: defaults.object(forKey: PreferenceKeys.hideUpsell) as? Bool ?? true,
            PreferenceKeys.carryContext: defaults.object(forKey: PreferenceKeys.carryContext) as? Bool ?? true,
            PreferenceKeys.modeBar: defaults.object(forKey: PreferenceKeys.modeBar) as? Bool ?? true
        ]
    }

    private func setupUI() {
        guard let contentView = window?.contentView else { return }

        let container = NSStackView()
        container.orientation = .vertical
        container.alignment = .leading
        container.spacing = 12
        container.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(container)

        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 20),
            container.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 26),
            container.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -26)
        ])

        // Title
        let headerLabel = NSTextField(labelWithString: "Alice AI Settings & Preferences")
        headerLabel.font = NSFont.systemFont(ofSize: 15, weight: .semibold)
        headerLabel.textColor = .labelColor
        container.addArrangedSubview(headerLabel)

        let subLabel = NSTextField(labelWithString: "Configure target response language, custom persona instructions, and UI options.")
        subLabel.font = NSFont.systemFont(ofSize: 11.5, weight: .regular)
        subLabel.textColor = .secondaryLabelColor
        container.addArrangedSubview(subLabel)

        let separator1 = NSBox()
        separator1.boxType = .separator
        container.addArrangedSubview(separator1)
        separator1.widthAnchor.constraint(equalTo: container.widthAnchor).isActive = true

        // Language Selector Row
        let langRow = NSStackView()
        langRow.orientation = .horizontal
        langRow.spacing = 10
        langRow.alignment = .centerY

        let langLabel = NSTextField(labelWithString: "Response Language:")
        langLabel.font = NSFont.systemFont(ofSize: 12.5, weight: .medium)
        langRow.addArrangedSubview(langLabel)

        let popup = NSPopUpButton(frame: .zero, pullsDown: false)
        for it in Self.languageList {
            popup.addItem(withTitle: it.name)
            popup.lastItem?.representedObject = it.code
        }
        let currentLang = UserDefaults.standard.string(forKey: PreferenceKeys.targetLang) ?? "en"
        for (idx, it) in Self.languageList.enumerated() {
            if it.code == currentLang {
                popup.selectItem(at: idx)
                break
            }
        }
        popup.target = self
        popup.action = #selector(languageSelected(_:))
        self.languagePopup = popup
        langRow.addArrangedSubview(popup)
        container.addArrangedSubview(langRow)

        // Custom Instructions Section
        let customLabel = NSTextField(labelWithString: "Custom Instructions / Persona for Alice:")
        customLabel.font = NSFont.systemFont(ofSize: 12.5, weight: .medium)
        container.addArrangedSubview(customLabel)

        let scrollView = NSScrollView(frame: NSRect(x: 0, y: 0, width: 428, height: 74))
        scrollView.hasVerticalScroller = true
        scrollView.borderType = .bezelBorder
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        let textView = NSTextView(frame: NSRect(x: 0, y: 0, width: 428, height: 74))
        textView.minSize = NSSize(width: 0, height: 74)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.containerSize = NSSize(width: 428, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.font = NSFont.systemFont(ofSize: 12)
        textView.string = UserDefaults.standard.string(forKey: PreferenceKeys.customInstructions) ?? ""
        textView.delegate = self
        self.instructionsTextView = textView
        scrollView.documentView = textView

        container.addArrangedSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.widthAnchor.constraint(equalTo: container.widthAnchor),
            scrollView.heightAnchor.constraint(equalToConstant: 74)
        ])

        let options: [(key: String, title: String)] = [
            (PreferenceKeys.enReplies, "Force selected language on outbound queries"),
            (PreferenceKeys.translateBtn, "Show quick machine translation button on assistant replies"),
            (PreferenceKeys.chips, "Display starter prompt cards on welcome screen"),
            (PreferenceKeys.hideUpsell, "Hide ads, promotional banners, and login nag popups"),
            (PreferenceKeys.carryContext, "Carry chat summary context forward into new chats"),
            (PreferenceKeys.modeBar, "Show floating mode switcher and brainstorm bar")
        ]

        let current = Self.currentSettings
        for opt in options {
            let checkbox = NSButton(checkboxWithTitle: opt.title, target: self, action: #selector(preferenceToggled(_:)))
            checkbox.identifier = NSUserInterfaceItemIdentifier(opt.key)
            checkbox.state = (current[opt.key] as? Bool ?? true) ? .on : .off
            checkbox.font = NSFont.systemFont(ofSize: 12.5)
            checkboxes[opt.key] = checkbox
            container.addArrangedSubview(checkbox)
        }

        let separator2 = NSBox()
        separator2.boxType = .separator
        container.addArrangedSubview(separator2)
        separator2.widthAnchor.constraint(equalTo: container.widthAnchor).isActive = true

        // Bottom Actions Stack
        let actionStack = NSStackView()
        actionStack.orientation = .horizontal
        actionStack.spacing = 12
        actionStack.alignment = .centerY

        let clearBtn = NSButton(title: "Reset Cookies & Session", target: self, action: #selector(clearSessionClicked))
        clearBtn.bezelStyle = .rounded
        actionStack.addArrangedSubview(clearBtn)

        let reloadBtn = NSButton(title: "Reload Chat", target: self, action: #selector(reloadChatClicked))
        reloadBtn.bezelStyle = .rounded
        actionStack.addArrangedSubview(reloadBtn)

        container.addArrangedSubview(actionStack)
    }

    @objc private func languageSelected(_ sender: NSPopUpButton) {
        let code = sender.selectedItem?.representedObject as? String ?? "en"
        UserDefaults.standard.set(code, forKey: PreferenceKeys.targetLang)
        syncSettingsToWeb()
    }

    func textDidChange(_ notification: Notification) {
        guard let tv = notification.object as? NSTextView else { return }
        UserDefaults.standard.set(tv.string, forKey: PreferenceKeys.customInstructions)
        syncSettingsToWeb()
    }

    @objc private func preferenceToggled(_ sender: NSButton) {
        guard let key = sender.identifier?.rawValue else { return }
        let isOn = sender.state == .on
        UserDefaults.standard.set(isOn, forKey: key)
        syncSettingsToWeb()
    }

    private func syncSettingsToWeb() {
        let settings = Self.currentSettings
        guard let json = try? JSONSerialization.data(withJSONObject: settings, options: []),
              let jsonStr = String(data: json, encoding: .utf8) else { return }

        DispatchQueue.main.async {
            MainWindowController.shared.webViewController.applySettings(jsonStr: jsonStr)
        }
    }

    @objc private func clearSessionClicked() {
        let alert = NSAlert()
        alert.messageText = "Reset Session & Cookies?"
        alert.informativeText = "This will clear stored web data, resetting anonymous access and logging out of Yandex ID if signed in."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Reset")
        alert.addButton(withTitle: "Cancel")

        if alert.runModal() == .alertFirstButtonReturn {
            let store = WKWebsiteDataStore.default()
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            store.removeData(ofTypes: types, modifiedSince: Date.distantPast) {
                DispatchQueue.main.async {
                    MainWindowController.shared.webViewController.reload()
                }
            }
        }
    }

    @objc private func reloadChatClicked() {
        MainWindowController.shared.webViewController.reload()
    }
}
