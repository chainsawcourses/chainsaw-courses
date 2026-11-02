import { useUserSession } from "@/contexts/UserContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { formatCourseAccessStatus } from "@/lib/accessStatus";
import { isAppleNative } from "@/lib/appleStore";
import AppleAccess from "@/components/AppleAccess";

const ORANGE = "#e27226";

export default function AccessExpired() {
  const { activationCode, fullName, courseCompletedAt, accessExpiresAt } = useUserSession();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!activationCode) navigate("/");
  }, [activationCode, navigate]);

  const hasCertificate = !!courseCompletedAt;
  const endedStatus = formatCourseAccessStatus(accessExpiresAt, "expired");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "#f9f9f9" }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 text-center" style={{ background: ORANGE }}>
          <img src={`${import.meta.env.BASE_URL}logo.png?v=21`} alt="Chainsaw Courses" className="h-12 mx-auto mb-3" />
          <h1 className="text-white text-xl font-bold">Chainsaw Courses</h1>
        </div>

        {/* Body */}
        <div className="px-8 py-7 text-center space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Your access period has ended</h2>
            {endedStatus && (
              <p className="mt-2 text-sm font-semibold text-gray-700" aria-label={`${endedStatus.label} ${endedStatus.date}`}>
                {endedStatus.label}<br />
                <span className="text-base text-gray-900">{endedStatus.date}</span>
              </p>
            )}
            {fullName && (
              <p className="text-gray-500 mt-1 text-sm">Hi {fullName.split(" ")[0]}</p>
            )}
          </div>

          {hasCertificate ? (
            <div className="rounded-xl p-4 text-left space-y-2" style={{ background: "#fff7f0", border: `1px solid ${ORANGE}` }}>
              <p className="font-semibold text-sm" style={{ color: ORANGE }}>✓ Your IIRSM certificate is still valid</p>
              <p className="text-sm text-gray-600">
                Your course materials are no longer available. Your certificate and completed training record remain accessible.
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-4 text-left" style={{ background: "#fff7f0", border: `1px solid ${ORANGE}` }}>
              <p className="text-sm text-gray-600">
                Your course materials are no longer available. Your completed training activity remains recorded.
              </p>
            </div>
          )}

          {hasCertificate && (
            <button
              type="button"
              onClick={() => navigate("/certificate")}
              className="w-full rounded-xl py-3 font-bold text-white shadow transition-opacity hover:opacity-90"
              style={{ background: ORANGE }}
            >
              View certificate
            </button>
          )}

          {isAppleNative() && (
            <div className="border-t pt-4 text-left">
              <AppleAccess hasBondedLearner renewal />
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-xs text-gray-400">Questions? Email <a href="mailto:info@chainsawcourses.com" className="underline">info@chainsawcourses.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
