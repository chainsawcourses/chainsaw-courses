import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  getApplePurchaseConfig, createApplePurchaseIntent, requestAppleIdentity,
  completeAppleIdentity, syncApplePurchase,
  type ApplePurchaseIntent, type AppleIdentityInput, type AppleIdentityProof,
} from "@workspace/api-client-react";

export interface AppleStoreProduct { id: string; displayName: string; description: string; displayPrice: string }
export interface AppleStoreTransaction { transactionId: string; signedTransaction: string; appAccountToken?: string; productId?: string }
interface StoreKitPlugin {
  products(options: { productId: string }): Promise<{ products: AppleStoreProduct[] }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<{ state: "purchased" | "pending" | "cancelled"; transaction?: AppleStoreTransaction }>;
  restore(options: { productId: string }): Promise<{ transactions: AppleStoreTransaction[] }>;
  history(options: { productId: string }): Promise<{ transactions: AppleStoreTransaction[] }>;
  unfinished(options: { productId: string }): Promise<{ transactions: AppleStoreTransaction[] }>;
  finish(options: { transactionId: string }): Promise<void>;
  saveIntent(options: { value: string }): Promise<void>;
  readIntent(): Promise<{ value?: string } | null | undefined>;
  clearIntent(): Promise<void>;
  addListener(event: "transactionUpdated", listener: (transaction: AppleStoreTransaction) => void): Promise<{ remove(): Promise<void> }>;
}
const StoreKit = registerPlugin<StoreKitPlugin>("AppleStore");
export const isAppleNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
export const hasAppleStoreBridge = () => isAppleNative() && Capacitor.isPluginAvailable("AppleStore");
export const appleStore = {
  config: getApplePurchaseConfig,
  async product(productId: string) {
    if (!hasAppleStoreBridge()) throw new Error("Purchasing needs the updated iPhone/iPad app. Existing customers can still sign in below.");
    const { products } = await StoreKit.products({ productId });
    if (!products[0]) throw new Error("This course is not available from the App Store in your region yet.");
    return products[0];
  },
  async savedIntent(): Promise<ApplePurchaseIntent | null> {
    if (!hasAppleStoreBridge()) return null;
    const saved = await StoreKit.readIntent();
    const value = saved?.value;
    if (!value) return null;
    try { return JSON.parse(value) as ApplePurchaseIntent; }
    catch { throw new Error("The saved purchase could not be read. Please contact support; do not buy again."); }
  },
  async buy(deviceId: string) {
    const config = await getApplePurchaseConfig();
    if (!config.enabled) throw new Error(config.message);
    const old = await this.savedIntent();
    const pending = await StoreKit.unfinished({ productId: config.productId });
    if (pending.transactions.length) {
      return { state: "purchased" as const, transaction: pending.transactions[0], intent: old };
    }
    if (old) return { state: "pending" as const, intent: old };
    // Never replace an intent for an Ask to Buy/deferred transaction.
    const intent = old ?? await createApplePurchaseIntent({ deviceId });
    await StoreKit.saveIntent({ value: JSON.stringify(intent) });
    const result = await StoreKit.purchase({ productId: intent.productId, appAccountToken: intent.appAccountToken });
    if (result.state === "cancelled") await StoreKit.clearIntent();
    return { ...result, intent };
  },
  async restore(productId: string) {
    if (!hasAppleStoreBridge()) throw new Error("Restoring Apple purchases needs the updated iPhone/iPad app.");
    return (await StoreKit.restore({ productId })).transactions;
  },
  async unfinished(productId: string) {
    if (!hasAppleStoreBridge()) return [];
    return (await StoreKit.unfinished({ productId })).transactions;
  },
  requestIdentity: (input: AppleIdentityInput) => requestAppleIdentity(input),
  completeIdentity: (input: AppleIdentityProof) => completeAppleIdentity(input),
  async finish(transactionId: string) {
    await StoreKit.finish({ transactionId });
    const intent = await this.savedIntent();
    if (intent) {
      const history = await StoreKit.history({ productId: intent.productId });
      if (history.transactions.some(t => t.transactionId === transactionId && t.appAccountToken === intent.appAccountToken.toLowerCase())) await StoreKit.clearIntent();
    }
  },
  async observe(onTransaction: (transaction: AppleStoreTransaction) => void) {
    if (!hasAppleStoreBridge()) return { remove: async () => {} };
    const config = await getApplePurchaseConfig();
    return StoreKit.addListener("transactionUpdated", t => {
      if (t.productId === config.productId) onTransaction(t);
    });
  },
};
export async function clearApplePurchaseIdentity() {
  if (hasAppleStoreBridge()) await StoreKit.clearIntent();
}

export async function startApplePurchaseReconciliation() {
  if (!hasAppleStoreBridge()) return () => {};
  const config = await getApplePurchaseConfig();
  if (!config.enabled) return () => {};
  let stopped = false;
  const reconcile = async (t: AppleStoreTransaction) => {
    if (stopped) return;
    try {
      await syncApplePurchase({ signedTransaction: t.signedTransaction });
      await appleStore.finish(t.transactionId);
      window.dispatchEvent(new Event("chainsaw:purchase-updated"));
    } catch {
      // Leave unfinished transactions with StoreKit. Never grant locally or
      // finish an unclaimed purchase, and never retry by charging again.
    }
  };
  const listener = await StoreKit.addListener("transactionUpdated", t => { void reconcile(t); });
  const refresh = async () => {
    if (document.visibilityState === "hidden" || stopped) return;
    const recent = await StoreKit.history({ productId: config.productId });
    for (const t of recent.transactions) await reconcile(t);
  };
  const onReturn = () => { void refresh().catch(() => {}); };
  document.addEventListener("visibilitychange", onReturn);
  void refresh().catch(() => {});
  return () => { stopped = true; document.removeEventListener("visibilitychange", onReturn); void listener.remove(); };
}
