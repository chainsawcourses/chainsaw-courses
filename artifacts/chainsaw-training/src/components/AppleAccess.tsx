import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Mail, RotateCcw, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserSession } from "../contexts/UserContext";
import { getMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { appleStore, hasAppleStoreBridge, type AppleStoreProduct, type AppleStoreTransaction } from "../lib/appleStore";
import type { ApplePurchaseConfig, ApplePurchaseIntent } from "@workspace/api-client-react";

type Purpose = "purchase" | "signin";
type Step = "home" | "details" | "code";
type Notice = { tone: "info" | "warn" | "error" | "ok"; title: string; body: string } | null;

function errorText(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string; error?: string } })?.data;
  const raw = data?.message || data?.error || (err instanceof Error ? err.message : "");
  return raw ? raw.replace(/^Request failed(?: \(\d+\))?:\s*/i, "") : fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AppleAccess({ hasBondedLearner, renewal = false }: { hasBondedLearner: boolean; renewal?: boolean }) {
  const [, setLocation] = useLocation();
  const { deviceId, setSession, setAccessInfo, fullName: sessionName, email: sessionEmail } = useUserSession();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ApplePurchaseConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [product, setProduct] = useState<AppleStoreProduct | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "buy" | "restore" | "request" | "complete">(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [tx, setTx] = useState<AppleStoreTransaction | null>(null);
  const [intent, setIntent] = useState<ApplePurchaseIntent | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("signin");
  const [step, setStep] = useState<Step>("home");
  const [fullName, setFullName] = useState(renewal ? sessionName ?? "" : "");
  const [email, setEmail] = useState(renewal ? sessionEmail ?? "" : "");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string; message: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const bridge = hasAppleStoreBridge();
  const lockIdentity = renewal && !!sessionName && !!sessionEmail;
  const blockBuy = hasBondedLearner && !renewal;

  function adoptTransaction(t: AppleStoreTransaction, i: ApplePurchaseIntent | null) {
    setTx(t);
    if (i) setIntent(i);
    setPurpose("purchase");
    setStep((s) => (s === "code" ? s : "details"));
    setNotice({ tone: "ok", title: "Apple purchase received", body: "Now confirm who the course is for. Your access is not active until your email is verified." });
  }

  useEffect(() => {
    let alive = true;
    let listener: { remove(): Promise<void> } | null = null;
    (async () => {
      try {
        const c = await appleStore.config();
        if (!alive) return;
        setConfig(c);
        if (c.enabled && bridge) {
          try {
            const p = await appleStore.product(c.productId);
            if (alive) setProduct(p);
          } catch (e) {
            if (alive) setProductError(errorText(e, "The course could not be loaded from the App Store."));
          }
          try {
            const saved = await appleStore.savedIntent();
            const open = await appleStore.unfinished(c.productId);
            if (!alive) return;
            if (open[0]) adoptTransaction(open[0], saved);
            else if (saved) {
              setIntent(saved);
              setNotice({ tone: "info", title: "Purchase awaiting approval", body: "A previous purchase is waiting for Apple approval (for example Ask to Buy). This screen will update when Apple confirms it. Please do not buy again." });
            }
          } catch (e) {
            if (alive) setNotice({ tone: "error", title: "Saved purchase check failed", body: errorText(e, "Please contact support; do not buy again.") });
          }
          listener = await appleStore.observe(async (t) => {
            const saved = await appleStore.savedIntent().catch(() => null);
            if (alive) adoptTransaction(t, saved);
          });
        }
      } catch (e) {
        if (alive) setConfigError(errorText(e, "Purchase settings could not be loaded."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; void listener?.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { headingRef.current?.focus(); }, [step]);

  const purchaseAvailable = !!config?.enabled && bridge && !!product && !configError;
  const awaitingApproval = !tx && !!intent && notice?.title === "Purchase awaiting approval";

  async function handleBuy() {
    if (!deviceId || busy || !purchaseAvailable || blockBuy) return;
    setBusy("buy");
    setNotice(null);
    try {
      const r = await appleStore.buy(deviceId);
      if (r.state === "purchased" && r.transaction) {
        adoptTransaction(r.transaction, r.intent);
      } else if (r.state === "pending") {
        if (r.intent) setIntent(r.intent);
        setNotice({ tone: "info", title: "Purchase awaiting approval", body: "Apple has not completed this payment yet (for example Ask to Buy). Keep the app open or return later; access starts only once Apple confirms it. Please do not buy again." });
      } else {
        setNotice({ tone: "warn", title: "Purchase cancelled", body: "No payment was taken. You can try again whenever you are ready." });
      }
    } catch (e) {
      setNotice({ tone: "error", title: "Purchase not completed", body: errorText(e, "The App Store could not complete the purchase. If you were charged, use Restore purchase rather than buying again.") });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (!config || busy) return;
    setBusy("restore");
    setNotice(null);
    try {
      const list = await appleStore.restore(config.productId);
      if (list[0]) {
        const saved = await appleStore.savedIntent().catch(() => null);
        adoptTransaction(list[0], saved);
        setNotice({ tone: "ok", title: "Apple purchase found", body: "Your most recent course purchase was found. Verify your email to link it to your learner record." });
      } else {
        setNotice({ tone: "info", title: "No Apple purchase found", body: "This Apple Account has no course purchase. If you bought through our website, use existing customer sign-in instead." });
      }
    } catch (e) {
      setNotice({ tone: "error", title: "Restore failed", body: errorText(e, "Apple purchase history could not be checked. Please try again.") });
    } finally {
      setBusy(null);
    }
  }

  function startSignIn() {
    setPurpose("signin");
    setFieldError(null);
    setStep("details");
  }

  async function requestCode() {
    if (!deviceId || busy) return;
    const name = fullName.trim();
    const mail = email.trim();
    if (name.length < 2) return setFieldError("Enter your full name.");
    if (!EMAIL_RE.test(mail)) return setFieldError("Enter a valid email address.");
    setFieldError(null);
    setBusy("request");
    try {
      const c = await appleStore.requestIdentity({ deviceId, email: mail, fullName: name });
      setChallenge(c);
      setCode("");
      setStep("code");
    } catch (e) {
      setFieldError(errorText(e, "The verification code could not be sent. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  async function completeCode() {
    if (!deviceId || !challenge || busy) return;
    if (!/^\d{6}$/.test(code)) return setFieldError("Enter the six-digit code from your email.");
    setFieldError(null);
    setBusy("complete");
    const useTx = purpose === "purchase" ? tx : null;
    try {
      const res = await appleStore.completeIdentity({
        challengeId: challenge.challengeId,
        code,
        deviceId,
        ...(useTx ? { signedTransaction: useTx.signedTransaction } : {}),
        ...(useTx && intent ? { intentId: intent.id, intentSecret: intent.secret } : {}),
      });
      try {
        await setSession({
          activationCode: res.activationCode,
          fullName: res.fullName,
          email: res.email,
          userId: res.userId,
          enrollmentId: res.enrollmentId ?? null,
        });
      } catch {
        setFieldError("Your account was verified, but this device could not save the session. Please try again; your purchase is kept safe and you will not be charged again.");
        setBusy(null);
        return;
      }
      // A refresher keeps the same credentials, so refresh access explicitly
      // before the route gate sees the previous expired course.
      const me = await getMe({ headers: { activationcode: res.activationCode, deviceid: deviceId, userid: String(res.userId) } });
      setAccessInfo({
        accessExpiresAt: me.accessExpiresAt ?? null,
        courseCompletedAt: me.courseCompletedAt ?? null,
        accessStatus: me.accessStatus === "expired" ? "expired" : "active",
        allModulesUnlocked: me.allModulesUnlocked ?? false,
        assignedTo: me.assignedTo ?? null,
        enrollmentId: me.enrollmentId ?? null,
        subscription: me.subscription ?? undefined,
      });
      // Identity/enrolment transitions must not paint the previous course's
      // cached progress, questions or certificate summary.
      queryClient.clear();
      if (useTx) {
        // Finish only after the server accepted it and the session is persisted.
        await appleStore.finish(useTx.transactionId).catch(() => {});
      }
      setLocation(res.waiverRequired ? "/waiver" : "/training");
    } catch (e) {
      setFieldError(errorText(e, "Verification failed. Check the code and try again."));
      setBusy(null);
    }
  }

  const noticeStyles: Record<NonNullable<Notice>["tone"], string> = {
    info: "border-sky-700/30 bg-sky-50 text-sky-950",
    warn: "border-amber-600/40 bg-amber-50 text-amber-950",
    error: "border-destructive/40 bg-destructive/5 text-destructive",
    ok: "border-emerald-700/30 bg-emerald-50 text-emerald-950",
  };
  const NoticeIcon = notice?.tone === "ok" ? CheckCircle2 : notice?.tone === "info" ? Clock : AlertTriangle;

  const labelCls = "font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="min-w-0 space-y-4" data-testid="apple-access">
      {notice && (
        <div role="status" aria-live="polite" className={`flex gap-3 rounded border p-3 text-sm ${noticeStyles[notice.tone]}`} data-testid={`notice-${notice.tone}`}>
          <NoticeIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">{notice.title}</p>
            <p className="mt-0.5 leading-snug">{notice.body}</p>
          </div>
        </div>
      )}

      {step === "home" && (
        <>
          <section aria-labelledby="buy-heading" className="rounded border border-border bg-background/70 p-4">
            <h2 ref={headingRef} tabIndex={-1} id="buy-heading" className="font-mono text-sm font-bold uppercase tracking-widest text-primary outline-none">
              {renewal ? "Refresher course" : "New learner"}
            </h2>
            {renewal && (
              <p className="mt-1 text-sm text-muted-foreground">
                Buy a new six-month course term, starting from the date Apple confirms your purchase. Your previous training records and certificates are kept separately.
              </p>
            )}
            {loading ? (
              <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading course from the App Store">
                <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-12 w-full animate-pulse rounded bg-muted" />
              </div>
            ) : blockBuy ? (
              <p className="mt-2 text-sm text-muted-foreground">
                You already have a learner account on this device. Use Continue above to return to your course.
              </p>
            ) : configError ? (
              <p className="mt-2 text-sm text-destructive" data-testid="text-config-error">{configError} Existing customers can still sign in below.</p>
            ) : !config?.enabled ? (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="text-purchase-disabled">{config?.message || "In-app purchase is not available at the moment."} Existing customers can still sign in below.</p>
            ) : !bridge ? (
              <p className="mt-2 text-sm text-muted-foreground" data-testid="text-no-bridge">Purchasing needs the latest version of this app from the App Store. Existing customers can still sign in below.</p>
            ) : !product ? (
              <p className="mt-2 text-sm text-destructive" data-testid="text-product-error">{productError || "The course is not available from the App Store right now."}</p>
            ) : (
              <>
                <p className="mt-2 text-base font-bold leading-tight" data-testid="text-product-name">{product.displayName}</p>
                {product.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}
                <ul className="mt-3 space-y-1 text-sm">
                  <li>Six months of access from the date Apple confirms your purchase.</li>
                  <li>One-off payment. It does not renew automatically.</li>
                </ul>
                <Button
                  type="button"
                  className="mt-4 h-12 w-full font-mono text-sm font-bold tracking-widest sm:h-14"
                  disabled={!!busy || awaitingApproval || !deviceId}
                  onClick={handleBuy}
                  data-testid="button-buy"
                >
                  {busy === "buy" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ShoppingBag className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {busy === "buy" ? "CONTACTING APP STORE..." : `BUY FOR ${product.displayPrice}`}
                </Button>
              </>
            )}
            {!loading && config?.enabled && bridge && (
              <Button type="button" variant="ghost" className="mt-2 w-full font-mono text-xs font-bold uppercase tracking-widest" disabled={!!busy} onClick={handleRestore} data-testid="button-restore">
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                {busy === "restore" ? "Checking Apple purchases..." : "Restore Apple purchase"}
              </Button>
            )}
          </section>

          {!renewal && <section aria-labelledby="signin-heading" className="rounded border border-border bg-background/70 p-4">
            <h2 id="signin-heading" className="font-mono text-sm font-bold uppercase tracking-widest text-primary">Existing customer</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Already bought the course from our website or on another device? Sign in with your email. No new purchase is needed.
            </p>
            <Button type="button" variant="outline" className="mt-3 h-11 w-full font-mono text-xs font-bold uppercase tracking-widest sm:h-12" disabled={!!busy} onClick={startSignIn} data-testid="button-existing-signin">
              <UserRound className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign in with email
            </Button>
          </section>}
        </>
      )}

      {step === "details" && (
        <form onSubmit={(e) => { e.preventDefault(); void requestCode(); }} className="space-y-4" noValidate>
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="font-mono text-sm font-bold uppercase tracking-widest text-primary outline-none">
              {purpose === "purchase" && lockIdentity ? "Confirm your learner account" : purpose === "purchase" ? "Who is this course for?" : "Existing customer sign-in"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {purpose === "purchase" && lockIdentity
                ? "The refresher course is added to your existing learner account. We will email you a six-digit code to confirm it is you."
                : purpose === "purchase"
                ? "Enter the learner's details. If you already have a learner record with this email, the purchase is added to it."
                : "Use the name and email from your original purchase. We will email you a six-digit code."}
            </p>
          </div>
          <div>
            <label htmlFor="apple-fullname" className={labelCls}>Full legal name</label>
            <Input id="apple-fullname" autoComplete="name" autoCapitalize="words" value={fullName} readOnly={lockIdentity} onChange={(e) => setFullName(e.target.value)} maxLength={160} className="mt-2 h-11 bg-secondary/50" data-testid="input-fullname" />
          </div>
          <div>
            <label htmlFor="apple-email" className={labelCls}>Email address</label>
            <Input id="apple-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} readOnly={lockIdentity} onChange={(e) => setEmail(e.target.value)} maxLength={254} className="mt-2 h-11 bg-secondary/50" data-testid="input-email" />
          </div>
          {fieldError && <p role="alert" className="text-sm font-medium text-destructive" data-testid="text-field-error">{fieldError}</p>}
          <Button type="submit" className="h-12 w-full font-mono text-sm font-bold tracking-widest" disabled={!!busy || !deviceId} data-testid="button-send-code">
            <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy === "request" ? "SENDING..." : "EMAIL ME A CODE"}
          </Button>
          {purpose === "signin" && (
            <Button type="button" variant="ghost" className="w-full font-mono text-xs font-bold uppercase tracking-widest" disabled={!!busy} onClick={() => { setFieldError(null); setStep("home"); }} data-testid="button-back">
              Back
            </Button>
          )}
          {purpose === "purchase" && (
            <p className="text-xs text-muted-foreground">Your Apple purchase is kept safely on this device until verification completes. You will not be charged again.</p>
          )}
        </form>
      )}

      {step === "code" && challenge && (
        <form onSubmit={(e) => { e.preventDefault(); void completeCode(); }} className="space-y-4" noValidate>
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="font-mono text-sm font-bold uppercase tracking-widest text-primary outline-none">Check your email</h2>
            <p className="mt-1 break-words text-sm text-muted-foreground" data-testid="text-challenge-message">{challenge.message}</p>
          </div>
          <div className="flex gap-2 rounded border border-amber-600/40 bg-amber-50 p-3 text-sm text-amber-950">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>Verifying moves this learner's course access to this device. Any other device signed in as this learner will lose access.</p>
          </div>
          <div>
            <label htmlFor="apple-code" className={labelCls}>Six-digit code</label>
            <Input id="apple-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-2 h-12 bg-secondary/50 text-center font-mono text-xl tracking-[0.5em]" data-testid="input-code" />
          </div>
          {fieldError && <p role="alert" className="text-sm font-medium text-destructive" data-testid="text-field-error">{fieldError}</p>}
          <Button type="submit" className="h-12 w-full font-mono text-sm font-bold tracking-widest" disabled={!!busy || code.length !== 6} data-testid="button-verify">
            {busy === "complete" ? "VERIFYING..." : "VERIFY AND CONTINUE"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => { setFieldError(null); setStep("details"); }} data-testid="button-change-details">Change details</Button>
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => void requestCode()} data-testid="button-resend">Resend code</Button>
          </div>
        </form>
      )}

      <div className="space-y-2 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        <p>This is a theory-only online course. It is not a formal NPTC or Lantra qualification and does not replace practical training or assessment.</p>
        <p>
          <Link href="/privacy" className="font-semibold text-primary underline-offset-2 hover:underline" data-testid="link-privacy">Privacy policy</Link>
          {" · "}
          <Link href="/legal" className="font-semibold text-primary underline-offset-2 hover:underline" data-testid="link-terms">Terms and legal</Link>
        </p>
      </div>
    </div>
  );
}
