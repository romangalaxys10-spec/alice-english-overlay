import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMainMenu()
        MainWindowController.shared.ensureOptimalSize()
        MainWindowController.shared.showWindow(nil)
        MainWindowController.shared.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        MainWindowController.shared.showWindow(nil)
        MainWindowController.shared.window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    private func setupMainMenu() {
        let mainMenu = NSMenu()

        // 1. Application Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let appName = "Alice AI"
        appMenu.addItem(withTitle: "About \(appName)", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())

        let prefItem = NSMenuItem(title: "Preferences…", action: #selector(openPreferences), keyEquivalent: ",")
        appMenu.addItem(prefItem)
        appMenu.addItem(NSMenuItem.separator())

        let servicesItem = NSMenuItem(title: "Services", action: nil, keyEquivalent: "")
        let servicesMenu = NSMenu()
        servicesItem.submenu = servicesMenu
        NSApp.servicesMenu = servicesMenu
        appMenu.addItem(servicesItem)
        appMenu.addItem(NSMenuItem.separator())

        appMenu.addItem(withTitle: "Hide \(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // 2. File Menu
        let fileMenuItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenuItem.submenu = fileMenu
        mainMenu.addItem(fileMenuItem)

        fileMenu.addItem(withTitle: "New Chat", action: #selector(newChat), keyEquivalent: "n")
        let resetSessionItem = NSMenuItem(title: "Reset Anonymous Session", action: #selector(resetAnonymousSession), keyEquivalent: "r")
        resetSessionItem.keyEquivalentModifierMask = [.command, .shift]
        fileMenu.addItem(resetSessionItem)
        fileMenu.addItem(NSMenuItem.separator())
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        // 3. Edit Menu (Vital for Copy, Cut, Paste inside WKWebView)
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        editMenu.addItem(withTitle: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z")
        let redoItem = NSMenuItem(title: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "z")
        redoItem.keyEquivalentModifierMask = [.command, .shift]
        editMenu.addItem(redoItem)
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // 4. View Menu
        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        viewMenu.addItem(withTitle: "Reload Page", action: #selector(reloadPage), keyEquivalent: "r")
        let forceReload = NSMenuItem(title: "Force Reload", action: #selector(forceReloadPage), keyEquivalent: "r")
        forceReload.keyEquivalentModifierMask = [.command, .shift]
        viewMenu.addItem(forceReload)
        viewMenu.addItem(NSMenuItem.separator())

        viewMenu.addItem(withTitle: "Actual Size", action: #selector(resetZoom), keyEquivalent: "0")
        viewMenu.addItem(withTitle: "Zoom In", action: #selector(zoomIn), keyEquivalent: "+")
        let zoomInEquals = NSMenuItem(title: "Zoom In", action: #selector(zoomIn), keyEquivalent: "=")
        zoomInEquals.isHidden = true
        viewMenu.addItem(zoomInEquals)
        viewMenu.addItem(withTitle: "Zoom Out", action: #selector(zoomOut), keyEquivalent: "-")
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(withTitle: "Toggle Terminal & Harness", action: #selector(toggleWorkbench), keyEquivalent: "j")
        viewMenu.addItem(withTitle: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")

        // 5. Harness & Agent Menu (ZCode & DeepSeek DSH)
        let harnessMenuItem = NSMenuItem()
        let harnessMenu = NSMenu(title: "Harness")
        harnessMenuItem.submenu = harnessMenu
        mainMenu.addItem(harnessMenuItem)

        let loopItem = NSMenuItem(title: "Open Autonomous Loop Studio", action: #selector(openLoopTab), keyEquivalent: "l")
        loopItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(loopItem)

        let loopModalItem = NSMenuItem(title: "Launch Autonomous Loop Modal...", action: #selector(openLoopModalAction), keyEquivalent: "l")
        loopModalItem.keyEquivalentModifierMask = [.command, .shift]
        harnessMenu.addItem(loopModalItem)

        let termItem = NSMenuItem(title: "Toggle Terminal Drawer", action: #selector(openTerminalTab), keyEquivalent: "t")
        termItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(termItem)

        let vibeItem = NSMenuItem(title: "Open Vibe Coder & Harness", action: #selector(openVibeTab), keyEquivalent: "k")
        vibeItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(vibeItem)

        let skillsItem = NSMenuItem(title: "Open Agent Skills Studio", action: #selector(openSkillsTab), keyEquivalent: "s")
        skillsItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(skillsItem)

        let gitItem = NSMenuItem(title: "GitHub Real-Time Sync", action: #selector(openGitSyncTab), keyEquivalent: "g")
        gitItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(gitItem)

        let testItem = NSMenuItem(title: "Dispatch Code Block Query", action: #selector(dispatchCodeQuery), keyEquivalent: "b")
        testItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(testItem)

        let permItem = NSMenuItem(title: "Toggle Local Permissions Menu", action: #selector(togglePermissionsMenuAction), keyEquivalent: "p")
        permItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(permItem)

        harnessMenu.addItem(NSMenuItem.separator())
        let finderItem = NSMenuItem(title: "Open Workspace in Finder", action: #selector(openWorkspaceFinder), keyEquivalent: "o")
        finderItem.keyEquivalentModifierMask = [.command, .control]
        harnessMenu.addItem(finderItem)

        // 6. History Menu
        let historyMenuItem = NSMenuItem()
        let historyMenu = NSMenu(title: "History")
        historyMenuItem.submenu = historyMenu
        mainMenu.addItem(historyMenuItem)

        historyMenu.addItem(withTitle: "Back", action: #selector(goBack), keyEquivalent: "[")
        historyMenu.addItem(withTitle: "Forward", action: #selector(goForward), keyEquivalent: "]")

        // 6. Window Menu
        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        let sizeSubmenuItem = NSMenuItem(title: "Window Size", action: nil, keyEquivalent: "")
        let sizeSubmenu = NSMenu(title: "Window Size")
        sizeSubmenuItem.submenu = sizeSubmenu
        windowMenu.addItem(sizeSubmenuItem)

        let compactItem = NSMenuItem(title: "Compact (680 × 720)", action: #selector(resizeCompact), keyEquivalent: "1")
        compactItem.keyEquivalentModifierMask = [.command, .option]
        sizeSubmenu.addItem(compactItem)

        let standardItem = NSMenuItem(title: "Standard (1024 × 780)", action: #selector(resizeStandard), keyEquivalent: "2")
        standardItem.keyEquivalentModifierMask = [.command, .option]
        sizeSubmenu.addItem(standardItem)

        let wideItem = NSMenuItem(title: "Wide (1280 × 860)", action: #selector(resizeWide), keyEquivalent: "3")
        wideItem.keyEquivalentModifierMask = [.command, .option]
        sizeSubmenu.addItem(wideItem)

        let companionItem = NSMenuItem(title: "Companion Sidebar (520 × Screen)", action: #selector(resizeCompanion), keyEquivalent: "4")
        companionItem.keyEquivalentModifierMask = [.command, .option]
        sizeSubmenu.addItem(companionItem)

        sizeSubmenu.addItem(NSMenuItem.separator())
        let centerItem = NSMenuItem(title: "Center on Screen", action: #selector(centerWindow), keyEquivalent: "c")
        centerItem.keyEquivalentModifierMask = [.command, .option]
        sizeSubmenu.addItem(centerItem)

        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(NSMenuItem.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")

        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    @objc private func resizeCompact() {
        MainWindowController.shared.resizeCompact()
    }

    @objc private func resizeStandard() {
        MainWindowController.shared.resizeStandard()
    }

    @objc private func resizeWide() {
        MainWindowController.shared.resizeWide()
    }

    @objc private func resizeCompanion() {
        MainWindowController.shared.resizeCompanion()
    }

    @objc private func centerWindow() {
        MainWindowController.shared.centerWindow()
    }

    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Alice AI (macOS Native)"
        alert.informativeText = "Version 1.0.0\n\nFull English Experience for Yandex Alice:\n• Native AppKit & WebKit integration\n• Machine translation proxy for English replies\n• Persistent cookies, logins & sessions\n• English prompt starter chips & mode switcher\n• Ad and upsell blocker"
        alert.icon = NSApp.applicationIconImage
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    @objc private func openPreferences() {
        MainWindowController.shared.preferencesClicked()
    }

    @objc private func newChat() {
        MainWindowController.shared.newChatClicked()
    }

    @objc private func resetAnonymousSession() {
        MainWindowController.shared.webViewController.resetAnonymousSession()
    }

    @objc private func reloadPage() {
        MainWindowController.shared.reloadClicked()
    }

    @objc private func forceReloadPage() {
        MainWindowController.shared.webViewController.loadInitialPage()
    }

    @objc private func goBack() {
        MainWindowController.shared.backClicked()
    }

    @objc private func goForward() {
        MainWindowController.shared.forwardClicked()
    }

    @objc private func zoomIn() {
        MainWindowController.shared.zoomIn()
    }

    @objc private func zoomOut() {
        MainWindowController.shared.zoomOut()
    }

    @objc private func resetZoom() {
        MainWindowController.shared.resetZoom()
    }

    @objc private func toggleWorkbench() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceToggleWorkbench && window.__aliceToggleWorkbench();", completionHandler: nil)
    }

    @objc private func openLoopTab() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceToggleWorkbench && window.__aliceToggleWorkbench('loop');", completionHandler: nil)
    }

    @objc private func openLoopModalAction() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceOpenLoopModal && window.__aliceOpenLoopModal();", completionHandler: nil)
    }

    @objc private func openTerminalTab() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceToggleWorkbench && window.__aliceToggleWorkbench('terminal');", completionHandler: nil)
    }

    @objc private func openVibeTab() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceToggleWorkbench && window.__aliceToggleWorkbench('vibe');", completionHandler: nil)
    }

    @objc private func openSkillsTab() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceToggleWorkbench && window.__aliceToggleWorkbench('skills');", completionHandler: nil)
    }

    @objc private func openGitSyncTab() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceToggleWorkbench && window.__aliceToggleWorkbench('git');", completionHandler: nil)
    }

    @objc private func dispatchCodeQuery() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("window.__aliceTriggerVibeTask && window.__aliceTriggerVibeTask('Show a short bash code snippet to check disk space');", completionHandler: nil)
    }

    @objc private func togglePermissionsMenuAction() {
        MainWindowController.shared.webViewController.webView.evaluateJavaScript("""
        (function() {
            var pill = document.querySelector('.alice-enx-perm-pill') || document.querySelector('.alice-enx-perm-btn');
            if (pill) {
                pill.click();
            } else if (window.__aliceTogglePermissionsMenu) {
                window.__aliceTogglePermissionsMenu();
            }
        })();
        """, completionHandler: nil)
    }

    @objc private func openWorkspaceFinder() {
        let url = URL(fileURLWithPath: HarnessService.shared.workspacePath)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }
}
