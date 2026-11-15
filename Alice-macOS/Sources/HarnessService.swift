import Cocoa

final class HarnessService {
    static let shared = HarnessService()

    var workspacePath: String = {
        let defaultPath = "/Users/d/Downloads/alice-english-overlay-extension"
        if FileManager.default.fileExists(atPath: defaultPath) {
            return defaultPath
        }
        return FileManager.default.currentDirectoryPath
    }()

    func setWorkspace(path: String) -> Bool {
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: path, isDirectory: &isDir), isDir.boolValue {
            workspacePath = path
            return true
        }
        return false
    }

    func executeCommand(command: String, cwd: String?, completion: @escaping (Bool, String, String, Int32) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let workingDir = (cwd != nil && !cwd!.isEmpty) ? cwd! : self.workspacePath
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/bin/zsh")
            process.arguments = ["-l", "-c", command]
            process.currentDirectoryURL = URL(fileURLWithPath: workingDir)

            var env = ProcessInfo.processInfo.environment
            let home = env["HOME"] ?? "/Users/d"
            let customPaths = "/opt/homebrew/bin:/usr/local/bin:\(home)/.local/bin:\(home)/.cargo/bin:/usr/bin:/bin:/usr/sbin:/sbin"
            env["PATH"] = customPaths + (env["PATH"].map { ":" + $0 } ?? "")
            env["LANG"] = "en_US.UTF-8"
            env["LC_ALL"] = "en_US.UTF-8"
            env["TERM"] = "xterm-256color"
            process.environment = env

            let outPipe = Pipe()
            let errPipe = Pipe()
            process.standardOutput = outPipe
            process.standardError = errPipe

            do {
                try process.run()
                let group = DispatchGroup()
                group.enter()
                DispatchQueue.global().async {
                    process.waitUntilExit()
                    group.leave()
                }

                let result = group.wait(timeout: .now() + 60.0)
                if result == .timedOut {
                    process.terminate()
                    DispatchQueue.main.async {
                        completion(false, "", "Execution timed out after 60 seconds", -1)
                    }
                    return
                }

                let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
                let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
                let stdout = String(data: outData, encoding: .utf8) ?? ""
                let stderr = String(data: errData, encoding: .utf8) ?? ""
                let exitCode = process.terminationStatus

                DispatchQueue.main.async {
                    completion(exitCode == 0, stdout, stderr, exitCode)
                }
            } catch {
                DispatchQueue.main.async {
                    completion(false, "", error.localizedDescription, -1)
                }
            }
        }
    }

    func readFile(path: String, completion: @escaping (Bool, String, String?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let fullPath = path.hasPrefix("/") ? path : (self.workspacePath + "/" + path)
            do {
                let content = try String(contentsOfFile: fullPath, encoding: .utf8)
                DispatchQueue.main.async { completion(true, content, nil) }
            } catch {
                DispatchQueue.main.async { completion(false, "", error.localizedDescription) }
            }
        }
    }

    func writeFile(path: String, content: String, completion: @escaping (Bool, Int, String?) -> Void) {
        DispatchQueue.global(qos: .userInitiated).async {
            let fullPath = path.hasPrefix("/") ? path : (self.workspacePath + "/" + path)
            let url = URL(fileURLWithPath: fullPath)
            do {
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                guard let data = content.data(using: .utf8) else {
                    DispatchQueue.main.async { completion(false, 0, "Failed to encode UTF-8 data") }
                    return
                }
                try data.write(to: url, options: .atomic)
                DispatchQueue.main.async { completion(true, data.count, nil) }
            } catch {
                DispatchQueue.main.async { completion(false, 0, error.localizedDescription) }
            }
        }
    }

    func gitSync(commitMsg: String?, completion: @escaping (Bool, String) -> Void) {
        let msg = (commitMsg != nil && !commitMsg!.isEmpty) ? commitMsg! : "Alice Harness: real-time workspace sync"
        let safeMsg = msg.replacingOccurrences(of: "\"", with: "\\\"")
        let cmd = "git add -A && (git diff --cached --quiet || git commit -m \"\(safeMsg)\") && git push origin main"
        executeCommand(command: cmd, cwd: self.workspacePath) { success, stdout, stderr, _ in
            let combined = stdout + (stderr.isEmpty ? "" : "\n" + stderr)
            completion(success, combined.trimmingCharacters(in: .whitespacesAndNewlines))
        }
    }

    func computerUse(action: String, params: [String: Any], completion: @escaping (Bool, Any?, String?) -> Void) {
        DispatchQueue.main.async {
            switch action {
            case "copy":
                if let text = params["text"] as? String {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(text, forType: .string)
                    completion(true, "Copied to clipboard", nil)
                } else {
                    completion(false, nil, "Missing text parameter")
                }
            case "readClipboard":
                let text = NSPasteboard.general.string(forType: .string) ?? ""
                completion(true, text, nil)
            case "openApp":
                if let name = params["name"] as? String {
                    if let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: name) {
                        NSWorkspace.shared.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration()) { _, err in
                            let ok = err == nil
                            completion(ok, ok ? "Launched \(name)" : nil, err?.localizedDescription)
                        }
                    } else {
                        self.executeCommand(command: "open -a \"\(name)\"", cwd: nil) { ok, stdout, stderr, _ in
                            completion(ok, ok ? "Launched \(name)" : nil, ok ? nil : stderr)
                        }
                    }
                } else {
                    completion(false, nil, "Missing name parameter")
                }
            case "runAppleScript":
                if let scriptText = params["script"] as? String {
                    var errorDict: NSDictionary?
                    let script = NSAppleScript(source: scriptText)
                    let resultDesc = script?.executeAndReturnError(&errorDict)
                    if let err = errorDict {
                        let errMsg = (err[NSAppleScript.errorMessage] as? String) ?? "AppleScript error"
                        completion(false, nil, errMsg)
                    } else {
                        completion(true, resultDesc?.stringValue ?? "Executed AppleScript successfully", nil)
                    }
                } else {
                    completion(false, nil, "Missing script parameter")
                }
            case "notify":
                let title = (params["title"] as? String) ?? "Alice Agent"
                let message = (params["message"] as? String) ?? ""
                let escapedTitle = title.replacingOccurrences(of: "\"", with: "\\\"")
                let escapedMsg = message.replacingOccurrences(of: "\"", with: "\\\"")
                let appleScript = "display notification \"\(escapedMsg)\" with title \"\(escapedTitle)\""
                self.executeCommand(command: "osascript -e '\(appleScript)'", cwd: nil) { ok, stdout, stderr, _ in
                    completion(ok, "Notification displayed", ok ? nil : stderr)
                }
            case "screencapture":
                let outPath = (params["path"] as? String) ?? (self.workspacePath + "/screenshot_" + String(Int(Date().timeIntervalSince1970)) + ".png")
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
                process.arguments = ["-x", outPath]
                do {
                    try process.run()
                    process.waitUntilExit()
                    let ok = process.terminationStatus == 0
                    completion(ok, ["path": outPath], ok ? nil : "screencapture failed")
                } catch {
                    completion(false, nil, error.localizedDescription)
                }
            case "openUrl":
                if let str = params["url"] as? String, let url = URL(string: str) {
                    NSWorkspace.shared.open(url)
                    completion(true, "Opened \(str)", nil)
                } else {
                    completion(false, nil, "Invalid URL")
                }
            case "openFolder":
                let folder = (params["path"] as? String) ?? self.workspacePath
                let url = URL(fileURLWithPath: folder)
                NSWorkspace.shared.activateFileViewerSelecting([url])
                completion(true, "Opened in Finder", nil)
            case "getSystemInfo":
                let memBytes = ProcessInfo.processInfo.physicalMemory
                let memGB = Int(round(Double(memBytes) / (1024.0 * 1024.0 * 1024.0)))
                let osVer = ProcessInfo.processInfo.operatingSystemVersionString
                let cores = ProcessInfo.processInfo.processorCount
                var size: Int = 0
                sysctlbyname("hw.model", nil, &size, nil, 0)
                var model = [CChar](repeating: 0, count: size)
                sysctlbyname("hw.model", &model, &size, nil, 0)
                let modelStr = String(cString: model)

                let info: [String: Any] = [
                    "ramGB": memGB,
                    "ramBytes": memBytes,
                    "osVersion": osVer,
                    "cores": cores,
                    "model": modelStr,
                    "workspace": self.workspacePath
                ]
                completion(true, info, nil)
            case "getWorkspace":
                completion(true, ["path": self.workspacePath], nil)
            case "setWorkspace":
                if let path = params["path"] as? String {
                    let ok = self.setWorkspace(path: path)
                    completion(ok, ["path": self.workspacePath], ok ? nil : "Invalid directory path")
                } else {
                    completion(false, nil, "Missing path parameter")
                }
            case "saveLoopState":
                if let stateStr = params["state"] as? String {
                    self.writeFile(path: ".alice/loop_state.json", content: stateStr) { ok, bytes, err in
                        completion(ok, ["bytes": bytes], err)
                    }
                } else {
                    completion(false, nil, "Missing state parameter")
                }
            case "loadLoopState":
                self.readFile(path: ".alice/loop_state.json") { ok, content, err in
                    completion(ok, ["state": content], err)
                }
            case "appendProgress":
                if let text = params["text"] as? String {
                    let fullPath = self.workspacePath + "/.alice/progress.txt"
                    let url = URL(fileURLWithPath: fullPath)
                    do {
                        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                        if let fileHandle = try? FileHandle(forWritingTo: url) {
                            fileHandle.seekToEndOfFile()
                            if let data = text.data(using: .utf8) {
                                fileHandle.write(data)
                            }
                            try fileHandle.close()
                        } else {
                            try text.write(to: url, atomically: true, encoding: .utf8)
                        }
                        completion(true, "Appended to progress.txt", nil)
                    } catch {
                        completion(false, nil, error.localizedDescription)
                    }
                } else {
                    completion(false, nil, "Missing text parameter")
                }
            case "readProgress":
                self.readFile(path: ".alice/progress.txt") { ok, content, err in
                    completion(ok, ["progress": content], err)
                }
            case "savePRD":
                if let prdStr = params["prd"] as? String {
                    self.writeFile(path: ".alice/prd.json", content: prdStr) { ok, bytes, err in
                        completion(ok, ["bytes": bytes], err)
                    }
                } else {
                    completion(false, nil, "Missing prd parameter")
                }
            case "readPRD":
                self.readFile(path: ".alice/prd.json") { ok, content, err in
                    completion(ok, ["prd": content], err)
                }
            default:
                completion(false, nil, "Unknown computer action: \(action)")
            }
        }
    }
}
