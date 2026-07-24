import { useUserSession } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

const SUBSCRIPTION_URL = "https://chainsawcourses.com/subscribe";
const ORANGE = "#e27226";

export default function AccessExpired() {
  const { activationCode, fullName, courseCompletedAt, clearSession } = useUserSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!activationCode) navigate("/");
  }, [activationCode, navigate]);

  const hasCertificate = !!courseCompletedAt;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#f9f9f9" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 text-center" style={{ background: ORANGE }}>
          <img src="/logo.png" alt="Chainsaw Courses" className="h-12 mx-auto mb-3" />
          <h1 className="text-white text-xl font-bold">Chainsaw Courses</h1>
        </div>

        {/* Body */}
        <div className="px-8 py-7 text-center space-y-5">
          <div>
            <div className="text-4xl mb-3">⏰</div>
            <h2 className="text-2xl font-bold text-gray-900">Your access period has ended</h2>
            {fullName && (
              <p className="text-gray-500 mt-1 text-sm">Hi {fullName.split(" ")[0]}</p>
            )}
          </div>

          {hasCertificate ? (
            <div className="rounded-xl p-4 text-left space-y-2" style={{ background: "#fff7f0", border: `1px solid ${ORANGE}` }}>
              <p className="font-semibold text-sm" style={{ color: ORANGE }}>✓ Your IIRSM certificate is still valid</p>
              <p className="text-sm text-gray-600">
                Your 3-month post-certificate window has now closed. Subscribe to keep access to your training
                materials, tools, and certificate record.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-4 text-left" style={{ background: "#fff7f0", border: `1px solid ${ORANGE}` }}>
              <p className="text-sm text-gray-600">
                Your 3-month access window has ended before course completion. Subscribe to continue
                your training from where you left off — all your progress is saved.
              </p>
            </div>
          )}

          <div className="rounded-xl p-4 text-left space-y-3" style={{ background: "#f5f5f5" }}>
            <p className="font-semibold text-sm text-gray-900">What you get with a subscription:</p>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li>✓ Full access to all 34 training modules</li>
              <li>✓ Module quizzes and mock examination</li>
              <li>✓ AI Chainsaw Manual Examiner</li>
              <li>✓ Inspection Checklist & Risk Assessment tools</li>
              <li>✓ Biosecurity Map & Chain Identification Chart</li>
              <li>✓ Overleaf Chainsaw Manual reference</li>
              <li>✓ Your IIRSM certificate record</li>
            </ul>
          </div>

          <div className="space-y-3 pt-1">
            <a
              href={SUBSCRIPTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 rounded-xl text-white font-bold text-lg shadow transition-opacity hover:opacity-90"
              style={{ background: ORANGE }}
            >
              Subscribe — £2.99 / month
            </a>
            <p className="text-xs text-gray-400">Cancel any time. Your progress and certificate are always saved.</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 mb-2">Questions? Email <a href="mailto:info@chainsawcourses.com" className="underline">info@chainsawcourses.com</a></p>
            <button
              onClick={clearSession}
              className="text-xs text-gray-400 underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
