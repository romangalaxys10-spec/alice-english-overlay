import Foundation

final class TranslationService: @unchecked Sendable {
    static let shared = TranslationService()
    private let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 12.0
        config.timeoutIntervalForResource = 20.0
        self.session = URLSession(configuration: config)
    }

    func translate(text: String, targetLang: String = "en", completion: @escaping (Result<String, Error>) -> Void) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            completion(.success(""))
            return
        }
        let lang = targetLang.isEmpty ? "en" : targetLang

        translateGtx(text: trimmed, targetLang: lang) { [weak self] result in
            switch result {
            case .success(let translated):
                completion(.success(translated))
            case .failure:
                self?.translateMyMemory(text: trimmed, targetLang: lang, completion: completion)
            }
        }
    }

    private func translateGtx(text: String, targetLang: String, completion: @escaping (Result<String, Error>) -> Void) {
        guard var components = URLComponents(string: "https://translate.googleapis.com/translate_a/single") else {
            completion(.failure(NSError(domain: "AliceTranslate", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid base URL"])))
            return
        }

        components.queryItems = [
            URLQueryItem(name: "client", value: "gtx"),
            URLQueryItem(name: "sl", value: "auto"),
            URLQueryItem(name: "tl", value: targetLang),
            URLQueryItem(name: "dt", value: "t"),
            URLQueryItem(name: "q", value: text)
        ]

        guard let url = components.url else {
            completion(.failure(NSError(domain: "AliceTranslate", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid query URL"])))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", forHTTPHeaderField: "User-Agent")

        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [Any],
                  let segments = json.first as? [Any] else {
                completion(.failure(NSError(domain: "AliceTranslate", code: 500, userInfo: [NSLocalizedDescriptionKey: "Invalid GTX response format"])))
                return
            }

            var fullText = ""
            for seg in segments {
                if let parts = seg as? [Any], let textSegment = parts.first as? String {
                    fullText += textSegment
                }
            }

            if fullText.isEmpty {
                completion(.failure(NSError(domain: "AliceTranslate", code: 500, userInfo: [NSLocalizedDescriptionKey: "Empty translation returned"])))
            } else {
                completion(.success(fullText))
            }
        }.resume()
    }

    private func translateMyMemory(text: String, targetLang: String, completion: @escaping (Result<String, Error>) -> Void) {
        guard var components = URLComponents(string: "https://api.mymemory.translated.net/get") else {
            completion(.failure(NSError(domain: "AliceTranslate", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid base URL"])))
            return
        }

        components.queryItems = [
            URLQueryItem(name: "q", value: text),
            URLQueryItem(name: "langpair", value: "ru|\(targetLang)")
        ]

        guard let url = components.url else {
            completion(.failure(NSError(domain: "AliceTranslate", code: 400, userInfo: [NSLocalizedDescriptionKey: "Invalid query URL"])))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
                  let resData = json["responseData"] as? [String: Any],
                  let translated = resData["translatedText"] as? String,
                  !translated.localizedCaseInsensitiveContains("MYMEMORY WARNING") else {
                completion(.failure(NSError(domain: "AliceTranslate", code: 500, userInfo: [NSLocalizedDescriptionKey: "MyMemory error"])))
                return
            }

            completion(.success(translated))
        }.resume()
    }
}
