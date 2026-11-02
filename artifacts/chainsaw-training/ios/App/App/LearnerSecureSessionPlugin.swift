import Capacitor
import Foundation
import Security

@objc(LearnerSecureSessionPlugin)
public class LearnerSecureSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LearnerSecureSessionPlugin"
    public let jsName = "LearnerSecureSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeLegacy", returnType: CAPPluginReturnPromise)
    ]

    private let cryptoQueue = DispatchQueue(
        label: "com.chainsawcourses.learner-secure-session",
        qos: .utility
    )
    private let keychainService = "com.chainsawcourses.app.learner-session"

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"),
              !key.isEmpty,
              let value = call.getObject("value"),
              JSONSerialization.isValidJSONObject(value) else {
            call.reject("A session key and value are required")
            return
        }

        cryptoQueue.async { [weak self] in
            guard let self else { return }
            do {
                let data = try JSONSerialization.data(withJSONObject: value)
                let query: [String: Any] = [
                    kSecClass as String: kSecClassGenericPassword,
                    kSecAttrService as String: self.keychainService,
                    kSecAttrAccount as String: key
                ]
                let attributes: [String: Any] = [
                    kSecValueData as String: data,
                    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                ]
                let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
                if updateStatus == errSecItemNotFound {
                    var item = query
                    item.merge(attributes) { _, replacement in replacement }
                    let addStatus = SecItemAdd(item as CFDictionary, nil)
                    guard addStatus == errSecSuccess else {
                        throw NSError(domain: NSOSStatusErrorDomain, code: Int(addStatus))
                    }
                } else if updateStatus != errSecSuccess {
                    throw NSError(domain: NSOSStatusErrorDomain, code: Int(updateStatus))
                }
                call.resolve()
            } catch {
                call.reject("Could not store learner session", error.localizedDescription)
            }
        }
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("A session key is required")
            return
        }

        cryptoQueue.async { [weak self] in
            guard let self else { return }
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: self.keychainService,
                kSecAttrAccount as String: key,
                kSecReturnData as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]
            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            if status == errSecItemNotFound {
                call.resolve(["value": NSNull()])
                return
            }
            guard status == errSecSuccess,
                  let data = result as? Data else {
                call.reject("Could not read learner session")
                return
            }
            do {
                let value = try JSONSerialization.jsonObject(with: data)
                call.resolve(["value": value])
            } catch {
                call.reject("Stored learner session is invalid", error.localizedDescription)
            }
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("A session key is required")
            return
        }

        cryptoQueue.async { [weak self] in
            guard let self else { return }
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: self.keychainService,
                kSecAttrAccount as String: key
            ]
            let status = SecItemDelete(query as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                call.reject("Could not remove learner session")
                return
            }
            call.resolve()
        }
    }

    @objc func removeLegacy(_ call: CAPPluginCall) {
        cryptoQueue.async { [weak self] in
            guard let self else { return }
            let legacyAccount = "capacitor-storage_learnerSession"
            let serviceQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: Bundle.main.bundleIdentifier ?? self.keychainService,
                kSecAttrAccount as String: legacyAccount
            ]
            let accountQuery: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrAccount as String: legacyAccount
            ]
            let serviceStatus = SecItemDelete(serviceQuery as CFDictionary)
            guard serviceStatus == errSecSuccess || serviceStatus == errSecItemNotFound else {
                call.reject("Could not remove legacy learner session")
                return
            }
            let accountStatus = SecItemDelete(accountQuery as CFDictionary)
            guard accountStatus == errSecSuccess || accountStatus == errSecItemNotFound else {
                call.reject("Could not remove legacy learner session")
                return
            }
            var remaining: AnyObject?
            let verificationQuery = accountQuery.merging([
                kSecReturnAttributes as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]) { _, replacement in replacement }
            let readStatus = SecItemCopyMatching(verificationQuery as CFDictionary, &remaining)
            guard readStatus == errSecItemNotFound else {
                call.reject("Legacy learner session removal could not be verified")
                return
            }
            call.resolve()
        }
    }
}