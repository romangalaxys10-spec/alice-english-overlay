import Cocoa
import WebKit

final class PreferencesWindowController: NSWindowController {
    static let shared = PreferencesWindowController()

    struct PreferenceKeys {
        static let enReplies = "enReplies"
        static let translateBtn = "translateBtn"
        static let chips = "chips"
        static let hideUpsell = "hideUpsell"
        static let carryContext = "carryContext"
        static let modeBar = "modeBar"
    }

    private var checkboxes: [String: NSButton] = [:]

    init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 380),
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

    static var currentSettings: [String: Bool] {
        let defaults = UserDefaults.standard
        return [
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
        container.spacing = 14
        container.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(container)

        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 24),
            container.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            container.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28)
        ])

        // Title
        let headerLabel = NSTextField(labelWithString: "English Overlay Configuration")
        headerLabel.font = NSFont.systemFont(ofSize: 15, weight: .semibold)
        headerLabel.textColor = .labelColor
        container.addArrangedSubview(headerLabel)

        let subLabel = NSTextField(labelWithString: "Customize translation rules, UI enhancements, and ad blocking.")
        subLabel.font = NSFont.systemFont(ofSize: 12, weight: .regular)
        subLabel.textColor = .secondaryLabelColor
        container.addArrangedSubview(subLabel)

        let separator1 = NSBox()
        separator1.boxType = .separator
        container.addArrangedSubview(separator1)
        separator1.widthAnchor.constraint(equalTo: container.widthAnchor).isActive = true

        let options: [(key: String, title: String)] = [
            (PreferenceKeys.enReplies, "Reply in English automatically (inject instruction)"),
            (PreferenceKeys.translateBtn, "Show 'EN' translation button on assistant replies"),
            (PreferenceKeys.chips, "Display English starter prompt cards"),
            (PreferenceKeys.hideUpsell, "Hide ads, promotional banners, and login upsells"),
            (PreferenceKeys.carryContext, "Carry chat summary context forward into new chats"),
            (PreferenceKeys.modeBar, "Show floating mode switcher bar (Auto, Expert, Draw, Math)")
        ]

        let current = Self.currentSettings
        for opt in options {
            let checkbox = NSButton(checkboxWithTitle: opt.title, target: self, action: #selector(preferenceToggled(_:)))
            checkbox.identifier = NSUserInterfaceItemIdentifier(opt.key)
            checkbox.state = (current[opt.key] ?? true) ? .on : .off
            checkbox.font = NSFont.systemFont(ofSize: 13)
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
