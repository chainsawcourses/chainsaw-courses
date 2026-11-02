import Foundation
import Capacitor
import StoreKit
import Security

/// Native StoreKit 2 only. The backend independently verifies every transaction.
/// Never finish a purchase until the server has attached it to a learner.
@available(iOS 15.0, *)
@objc(AppleStorePlugin)
public class AppleStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppleStorePlugin"
    public let jsName = "AppleStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "history", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unfinished", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearIntent", returnType: CAPPluginReturnPromise)
    ]
    private var transactionTask: Task<Void, Never>?
    private let intentService = "com.overleafpublishers.chainsawcourses.storekit.intent"

    public override func load() {
        transactionTask = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard let self = self, case .verified(let transaction) = result else { continue }
                self.notifyListeners("transactionUpdated",
                    data: self.payload(transaction, jws: result.jwsRepresentation),
                    retainUntilConsumed: true)
            }
        }
    }
    deinit { transactionTask?.cancel() }

    private func payload(_ transaction: StoreKit.Transaction, jws: String) -> JSObject {
        var value: JSObject = ["transactionId": String(transaction.id), "signedTransaction": jws, "productId": transaction.productID]
        if let token = transaction.appAccountToken { value["appAccountToken"] = token.uuidString.lowercased() }
        return value
    }
    @objc func products(_ call: CAPPluginCall) {
        guard let id = call.getString("productId") else { call.reject("Missing product"); return }
        Task {
            do {
                let products = try await Product.products(for: [id])
                let values: [JSObject] = products.filter { $0.type == .nonRenewable }.map {
                    ["id": $0.id, "displayName": $0.displayName, "description": $0.description, "displayPrice": $0.displayPrice]
                }
                call.resolve(["products": values])
            } catch { call.reject("The App Store could not load this course. Please try again.") }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"),
              let rawToken = call.getString("appAccountToken"),
              let token = UUID(uuidString: rawToken) else { call.reject("Missing purchase identity"); return }
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [id]).first,
                      product.type == .nonRenewable else { call.reject("The course product is unavailable."); return }
                let result = try await product.purchase(options: [.appAccountToken(token)])
                switch result {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("Apple could not verify the purchase. Use Restore purchases; do not purchase again.")
                        return
                    }
                    call.resolve(["state": "purchased", "transaction": self.payload(transaction, jws: verification.jwsRepresentation)])
                case .pending: call.resolve(["state": "pending"])
                case .userCancelled: call.resolve(["state": "cancelled"])
                @unknown default: call.reject("Unknown purchase state. Use Restore purchases before trying again.")
                }
            } catch {
                call.reject("The purchase could not be completed. Use Restore purchases to check before buying again.")
            }
        }
    }
    private func transactions(_ call: CAPPluginCall, sync: Bool, onlyUnfinished: Bool) {
        guard let id = call.getString("productId") else { call.reject("Missing product"); return }
        Task {
            do {
                if sync { try await AppStore.sync() }
                var transactions: [(Date, JSObject)] = []
                if onlyUnfinished {
                    for await result in StoreKit.Transaction.unfinished {
                        if case .verified(let t) = result, t.productID == id {
                            transactions.append((t.purchaseDate, self.payload(t, jws: result.jwsRepresentation)))
                        }
                    }
                } else {
                    // Non-renewing purchases are restored from transaction
                    // history, not a permanent currentEntitlements grant.
                    for await result in StoreKit.Transaction.all {
                        if case .verified(let t) = result, t.productID == id {
                            transactions.append((t.purchaseDate, self.payload(t, jws: result.jwsRepresentation)))
                        }
                    }
                }
                call.resolve(["transactions": transactions.sorted { $0.0 > $1.0 }.map { $0.1 }])
            } catch { call.reject("Apple purchases could not be restored. Check your App Store account and try again.") }
        }
    }
    @objc func restore(_ call: CAPPluginCall) { transactions(call, sync: true, onlyUnfinished: false) }
    @objc func history(_ call: CAPPluginCall) { transactions(call, sync: false, onlyUnfinished: false) }
    @objc func unfinished(_ call: CAPPluginCall) { transactions(call, sync: false, onlyUnfinished: true) }
    @objc func finish(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId") else { call.reject("Missing transaction"); return }
        Task {
            for await result in StoreKit.Transaction.all {
                if case .verified(let transaction) = result, String(transaction.id) == id {
                    await transaction.finish()
                    call.resolve()
                    return
                }
            }
            call.reject("Transaction not found. It has not been finished.")
        }
    }
    private func keychainQuery() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: intentService,
         kSecAttrAccount as String: "pending"]
    }
    @objc func saveIntent(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8) else { call.reject("Invalid purchase identity"); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let query = self.keychainQuery()
            var values = query
            values[kSecValueData as String] = data
            values[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let status = SecItemAdd(values as CFDictionary, nil)
            let updated = status == errSecDuplicateItem
                ? SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary) : status
            guard updated == errSecSuccess else { call.reject("Could not securely save purchase identity. Purchase has not started."); return }
            call.resolve()
        }
    }
    @objc func readIntent(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            var query = self.keychainQuery()
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            if status == errSecItemNotFound { call.resolve(["value": ""]); return }
            guard status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
                call.reject("Could not read saved purchase identity. Do not purchase again; contact support.")
                return
            }
            call.resolve(["value": value])
        }
    }
    @objc func clearIntent(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            let status = SecItemDelete(self.keychainQuery() as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { call.reject("Could not clear saved purchase identity"); return }
            call.resolve()
        }
    }
}
