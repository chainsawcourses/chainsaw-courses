import { useEffect, useState } from "react";
import { Link } from "wouter";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows|macintosh|linux/i.test(ua)) return "desktop";
  return "unknown";
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function Install() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [standalone, setStandalone] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isInStandaloneMode());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowSteps(true);
    }
  }

  const features = [
    { icon: "🎬", text: "7 sequential video training modules" },
    { icon: "✅", text: "Per-module quizzes with instant feedback" },
    { icon: "🤖", text: "AI mock examiner for exam practice" },
    { icon: "📋", text: "Inspection checklists & risk assessments" },
    { icon: "🏆", text: "Digital certificate on completion" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header band */}
      <div className="bg-[#e27226] h-1.5 w-full" />

      <div className="flex-1 flex flex-col items-center px-4 py-8 max-w-md mx-auto w-full">

        {/* App icon + identity */}
        <div className="mt-4 mb-6 flex flex-col items-center">
          <div className="w-28 h-28 rounded-[22px] shadow-xl overflow-hidden border border-gray-100 mb-4">
            <img src="/icon-512.png" alt="Chainsaw Courses" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Chainsaw Courses</h1>
          <p className="text-[#e27226] font-semibold text-sm mt-0.5 text-center">
            IIRSM-Approved Professional Training
          </p>
          <div className="flex items-center gap-1 mt-2">
            {[1,2,3,4,5].map(n => (
              <svg key={n} className="w-4 h-4 text-[#e27226]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="text-xs text-gray-500 ml-1">IIRSM Approved</span>
          </div>
        </div>

        {/* Already installed / opened from home screen */}
        {standalone ? (
          <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-green-800">App already installed!</p>
            <p className="text-sm text-green-700 mt-1">You're opening this from your home screen. You're all set.</p>
            <Link href="/">
              <button className="mt-4 w-full bg-[#e27226] hover:bg-[#c9621f] text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                Continue to Registration →
              </button>
            </Link>
          </div>
        ) : installed ? (
          <div className="w-full bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 text-center">
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-semibold text-green-800">App installed successfully!</p>
            <p className="text-sm text-green-700 mt-1">Find <strong>Chainsaw Courses</strong> on your home screen and tap it to begin.</p>
            <Link href="/">
              <button className="mt-4 w-full bg-[#e27226] hover:bg-[#c9621f] text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                Continue to Registration →
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Install button */}
            {platform === "ios" || platform === "android" || platform === "unknown" ? (
              <button
                onClick={handleInstallClick}
                className="w-full bg-[#e27226] hover:bg-[#c9621f] text-white font-bold py-4 px-6 rounded-xl text-lg shadow-md transition-colors mb-3"
              >
                {deferredPrompt ? "Install App" : "How to Install →"}
              </button>
            ) : (
              /* Desktop — just direct them to use their phone */
              <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-sm text-amber-800 text-center">
                <p>📱 Open this link on your <strong>mobile phone</strong> to install the app on your home screen.</p>
              </div>
            )}

            <Link href="/">
              <button className="w-full border border-gray-300 text-gray-600 hover:bg-gray-100 font-medium py-3 px-6 rounded-xl transition-colors mb-6 text-sm">
                Skip — go straight to registration
              </button>
            </Link>

            {/* iOS step-by-step instructions */}
            {showSteps && platform === "ios" && (
              <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 text-center">Add to your iPhone home screen</h3>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">1</span>
                    <div>
                      <p className="text-sm text-gray-700">Tap the <strong>Share</strong> button at the bottom of your browser</p>
                      <div className="mt-1.5 inline-flex items-center gap-1 bg-gray-100 rounded-lg px-3 py-1.5">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700">Share</span>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">2</span>
                    <div>
                      <p className="text-sm text-gray-700">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                      <div className="mt-1.5 inline-flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs font-medium text-gray-700">Add to Home Screen</span>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">3</span>
                    <p className="text-sm text-gray-700">Tap <strong>"Add"</strong> in the top right corner</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">4</span>
                    <p className="text-sm text-gray-700">Open <strong>Chainsaw Courses</strong> from your home screen and complete your registration</p>
                  </li>
                </ol>
                <Link href="/">
                  <button className="mt-5 w-full bg-[#e27226] hover:bg-[#c9621f] text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                    Continue to Registration →
                  </button>
                </Link>
              </div>
            )}

            {/* Android manual instructions (no deferredPrompt) */}
            {showSteps && (platform === "android" || platform === "unknown") && !deferredPrompt && (
              <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 text-center">Add to your Android home screen</h3>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">1</span>
                    <div>
                      <p className="text-sm text-gray-700">Tap the <strong>menu</strong> button in Chrome</p>
                      <div className="mt-1.5 inline-flex items-center gap-1 bg-gray-100 rounded-lg px-3 py-1.5">
                        <span className="text-gray-700 font-bold text-base leading-none">⋮</span>
                        <span className="text-xs font-medium text-gray-700">Menu</span>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">2</span>
                    <p className="text-sm text-gray-700">Tap <strong>"Add to Home screen"</strong></p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">3</span>
                    <p className="text-sm text-gray-700">Tap <strong>"Add"</strong> to confirm</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e27226] text-white text-sm font-bold flex items-center justify-center">4</span>
                    <p className="text-sm text-gray-700">Open <strong>Chainsaw Courses</strong> from your home screen and complete your registration</p>
                  </li>
                </ol>
                <Link href="/">
                  <button className="mt-5 w-full bg-[#e27226] hover:bg-[#c9621f] text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                    Continue to Registration →
                  </button>
                </Link>
              </div>
            )}
          </>
        )}

        {/* Feature list */}
        <div className="w-full bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h2 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">What's included</h2>
          <ul className="space-y-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="text-xl w-7 text-center flex-shrink-0">{f.icon}</span>
                <span className="text-sm text-gray-700">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Trust badges */}
        <div className="w-full bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-8">
          <div className="flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-[#e27226]">IIRSM</p>
              <p className="text-xs text-gray-500 mt-0.5">Approved</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-[#e27226]">7</p>
              <p className="text-xs text-gray-500 mt-0.5">Modules</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-[#e27226]">£198</p>
              <p className="text-xs text-gray-500 mt-0.5">One-time</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center pb-6">
          By installing you agree to our{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>
          {" · "}
          <Link href="/legal" className="underline">Terms</Link>
        </p>
      </div>
    </div>
  );
}
