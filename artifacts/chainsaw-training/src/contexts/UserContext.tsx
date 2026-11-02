import React, { createContext, useContext, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { IS_DEMO, DEMO_ACTIVATION_CODE, DEMO_DEVICE_ID } from "../lib/demo";
import {
  learnerIdentity,
  accessStorageKey,
  accountSwitchDecision,
  persistVerifiedAccess,
  readVerifiedAccess,
  type AccessStatus,
} from "../lib/accessPolicy";
import {
  activateStoredLearnerSession,
  clearLearnerSession,
  getLearnerAuthHeaders,
  hasAccountDeletionTombstone,
  mirrorStoredSession,
  retryAccountDeletionCleanup,
  type LearnerSession,
  readBrowserSession,
  readStoredSession,
  saveDeviceSession,
  saveLearnerSession,
  suspendLearnerSession,
} from "../lib/sessionStorage";
import { setAppHeadersGetter } from "@workspace/api-client-react";
import { retryPendingVideoCompletions } from "../lib/pendingVideoCompletions";
import { startApplePurchaseReconciliation } from "../lib/appleStore";

setAppHeadersGetter(getLearnerAuthHeaders);

interface UserContextType {
  activationCode: string | null;
  deviceId: string | null;
  fullName: string | null;
  email: string | null;
  userId: number | null;
  enrollmentId: number | null;
  accessExpiresAt: string | null;
  courseCompletedAt: string | null;
  accessStatus: AccessStatus;
  allModulesUnlocked: boolean;
  assignedTo: string | null;
  subscription: {
    status: string;
    paidThroughAt: string | null;
    cancelAtPeriodEnd: boolean;
  };
  bondedLearner: LearnerSession | null;
  setSession: (data: { activationCode: string; fullName: string; email: string; userId: number; enrollmentId?: number | null }) => Promise<void>;
  setAccessInfo: (data: {
    accessExpiresAt: string | null;
    courseCompletedAt: string | null;
    accessStatus: AccessStatus;
    allModulesUnlocked?: boolean;
    assignedTo?: string | null;
    enrollmentId?: number | null;
    subscription?: UserContextType["subscription"];
  }) => void;
  suspendSession: () => Promise<void>;
  resumeSession: () => Promise<LearnerSession>;
  clearSession: (options?: { forgetDevice?: boolean }) => Promise<void>;
  clearRejectedSession: () => Promise<void>;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const deletionPending = !IS_DEMO && hasAccountDeletionTombstone();
  const browserSession = IS_DEMO || deletionPending ? null : readBrowserSession();
  const initialBrowserLearner = browserSession?.status === "suspended" ? undefined : browserSession?.learner;
  const initialActivationCode = IS_DEMO ? DEMO_ACTIVATION_CODE : initialBrowserLearner?.activationCode ?? null;
  const initialUserId = IS_DEMO ? 0 : initialBrowserLearner?.userId ?? null;
  const initialEnrollmentId = IS_DEMO ? null : initialBrowserLearner?.enrollmentId ?? null;
  const initialAccess = IS_DEMO
    ? { accessExpiresAt: null, accessStatus: "active" as const }
    : readVerifiedAccess(localStorage, learnerIdentity(initialActivationCode, initialUserId));

  const [activationCode, setActivationCode] = useState<string | null>(initialActivationCode);
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    if (IS_DEMO) return DEMO_DEVICE_ID;
    if (deletionPending) return null;
    const stored = browserSession?.deviceId ?? null;
    const resolved = stored ?? uuidv4();
    if (!stored) void saveDeviceSession(resolved);
    return resolved;
  });
  const [fullName, setFullName] = useState<string | null>(
    IS_DEMO ? "Demo User" : initialBrowserLearner?.fullName ?? null,
  );
  const [email, setEmail] = useState<string | null>(
    IS_DEMO ? "demo@chainsawcourses.com" : initialBrowserLearner?.email ?? null,
  );
  const [userId, setUserId] = useState<number | null>(initialUserId);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(initialEnrollmentId);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(initialAccess?.accessExpiresAt ?? null);
  const [courseCompletedAt, setCourseCompletedAt] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(initialAccess?.accessStatus ?? "unknown");
  const [allModulesUnlocked, setAllModulesUnlocked] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<UserContextType["subscription"]>({
    status: "inactive",
    paidThroughAt: null,
    cancelAtPeriodEnd: false,
  });
  const [bondedLearner, setBondedLearner] = useState<LearnerSession | null>(
    browserSession?.status === "suspended" ? browserSession.learner ?? null : null,
  );
  useEffect(() => {
    if (!activationCode || userId === null || IS_DEMO) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void startApplePurchaseReconciliation().then(cleanup => {
      if (disposed) cleanup(); else stop = cleanup;
    }).catch(() => {});
    return () => { disposed = true; stop?.(); };
  }, [activationCode, userId, deviceId]);
  useEffect(() => {
    if (IS_DEMO) return;
    if (hasAccountDeletionTombstone()) {
      void retryAccountDeletionCleanup().catch(() => {});
      return;
    }
    // The browser session is canonical. This is deliberately post-render and
    // best-effort so a missing, slow, or broken native bridge cannot block the
    // installed app.
    void mirrorStoredSession().catch(() => {});
  }, []);

  useEffect(() => {
    if (!activationCode || !deviceId || userId === null || enrollmentId === null) return;
    const identity = { activationCode, deviceId, userId, enrollmentId };
    const retry = () => {
      void retryPendingVideoCompletions(identity);
    };
    retry();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [activationCode, deviceId, userId, enrollmentId]);

  const setSession = IS_DEMO
    ? async (_data: { activationCode: string; fullName: string; email: string; userId: number }) => {}
     : async (data: { activationCode: string; fullName: string; email: string; userId: number; enrollmentId?: number | null }) => {
        const normalizedCode = data.activationCode.trim().toUpperCase();
        const normalizedName = data.fullName.trim();
        const normalizedEmail = data.email.trim().toLowerCase();
        if (!deviceId) throw new Error("Device session is unavailable");
        await saveLearnerSession(deviceId, {
          activationCode: normalizedCode,
          fullName: normalizedName,
          email: normalizedEmail,
          userId: data.userId,
           enrollmentId: data.enrollmentId ?? null,
        });
        setActivationCode(normalizedCode);
        setFullName(normalizedName);
        setEmail(normalizedEmail);
        setUserId(data.userId);
        setEnrollmentId(data.enrollmentId ?? null);
        const nextIdentity = learnerIdentity(normalizedCode, data.userId);
        const persistedAccess = accountSwitchDecision(
          localStorage,
          learnerIdentity(activationCode, userId),
          nextIdentity,
        ).access;
        setAccessExpiresAt(persistedAccess.accessExpiresAt);
        setCourseCompletedAt(null);
        setAccessStatus(persistedAccess.accessStatus);
        setAllModulesUnlocked(false);
        setAssignedTo(null);
         setSubscription({
           status: "inactive",
           paidThroughAt: null,
           cancelAtPeriodEnd: false,
         });
        setBondedLearner(null);
      };

  const suspendSession = IS_DEMO
    ? async () => {}
    : async () => {
        if (!activationCode || !fullName || !email || userId === null) {
          throw new Error("Bonded learner session is unavailable");
        }
        // Logout is a local privacy screen, not an account/device reset. The
        // encrypted bonded session remains intact so a consumed licence is
        // never requested again.
        const learner = { activationCode, fullName, email, userId, enrollmentId };
        if (!deviceId) throw new Error("Device session is unavailable");
        await suspendLearnerSession(deviceId, learner);
        setBondedLearner(learner);
        setActivationCode(null);
        setFullName(null);
        setEmail(null);
        setUserId(null);
        setEnrollmentId(null);
        setAccessExpiresAt(null);
        setCourseCompletedAt(null);
        setAccessStatus("unknown");
        setAllModulesUnlocked(false);
        setAssignedTo(null);
         setSubscription({
           status: "inactive",
           paidThroughAt: null,
           cancelAtPeriodEnd: false,
         });
      };

  const resumeSession = IS_DEMO
    ? async () => ({
        activationCode: DEMO_ACTIVATION_CODE,
        fullName: "Demo User",
        email: "demo@chainsawcourses.com",
        userId: 0,
        enrollmentId: null,
      })
    : async () => {
        const stored = await readStoredSession();
        if (!stored?.learner || !deviceId || stored.deviceId !== deviceId) {
          throw new Error("Bonded learner session is unavailable");
        }
        const learner = stored.learner;
        await activateStoredLearnerSession();
        setActivationCode(learner.activationCode);
        setFullName(learner.fullName);
        setEmail(learner.email);
        setUserId(learner.userId);
        setEnrollmentId(learner.enrollmentId ?? null);
        setBondedLearner(null);
        const access = readVerifiedAccess(localStorage, learnerIdentity(learner.activationCode, learner.userId));
        setAccessExpiresAt(access?.accessExpiresAt ?? null);
        setAccessStatus(access?.accessStatus ?? "unknown");
        return learner;
      };

  const setAccessInfo = (data: {
    accessExpiresAt: string | null;
    courseCompletedAt: string | null;
    accessStatus: AccessStatus;
    allModulesUnlocked?: boolean;
    assignedTo?: string | null;
    enrollmentId?: number | null;
    subscription?: UserContextType["subscription"];
  }) => {
    setAccessExpiresAt(data.accessExpiresAt);
    setCourseCompletedAt(data.courseCompletedAt);
    if (data.enrollmentId !== undefined) setEnrollmentId(data.enrollmentId ?? null);
    setAccessStatus(data.accessStatus);
    if (data.allModulesUnlocked !== undefined) setAllModulesUnlocked(data.allModulesUnlocked);
    if (data.assignedTo !== undefined) setAssignedTo(data.assignedTo ?? null);
    if (data.subscription !== undefined) setSubscription(data.subscription);
    persistVerifiedAccess(localStorage, learnerIdentity(activationCode, userId), {
      accessExpiresAt: data.accessExpiresAt,
      accessStatus: data.accessStatus,
    });
    // /auth/me is the server authority for the current cycle. Persist its
    // confirmed enrolment atomically with the learner identity so a refresh
    // cannot resume a stale client-selected cycle.
    if (data.enrollmentId !== undefined && deviceId && activationCode && fullName && email && userId !== null) {
      void saveLearnerSession(deviceId, {
        activationCode,
        fullName,
        email,
        userId,
        enrollmentId: data.enrollmentId ?? null,
      }).catch(() => {});
    }
  };

  const clearSession = IS_DEMO
    ? async (_options?: { forgetDevice?: boolean }) => {}
    : async (options?: { forgetDevice?: boolean }) => {
        try {
          if (!deviceId) throw new Error("Device session is unavailable");
          await clearLearnerSession(deviceId, options?.forgetDevice);
        } finally {
          // Account deletion sets a durable tombstone before this call. Even
          // if native cleanup is unavailable, never leave React authenticated
          // after the server has accepted deletion.
          setActivationCode(null);
          if (options?.forgetDevice) setDeviceId(null);
          setFullName(null);
          setEmail(null);
          setUserId(null);
          setEnrollmentId(null);
          setAccessExpiresAt(null);
          setCourseCompletedAt(null);
          setAccessStatus("unknown");
          setAllModulesUnlocked(false);
          setAssignedTo(null);
           setSubscription({
             status: "inactive",
             paidThroughAt: null,
             cancelAtPeriodEnd: false,
           });
          setBondedLearner(null);
        }
      };

  const clearRejectedSession = IS_DEMO
    ? async () => {}
    : async () => {
        const rejectedIdentity = learnerIdentity(activationCode, userId);
        if (rejectedIdentity) localStorage.removeItem(accessStorageKey(rejectedIdentity));
        if (deviceId) await saveDeviceSession(deviceId);
        setActivationCode(null);
        setFullName(null);
        setEmail(null);
        setUserId(null);
        setEnrollmentId(null);
        setAccessExpiresAt(null);
        setCourseCompletedAt(null);
        setAccessStatus("unknown");
        setAllModulesUnlocked(false);
        setAssignedTo(null);
         setSubscription({
           status: "inactive",
           paidThroughAt: null,
           cancelAtPeriodEnd: false,
         });
        setBondedLearner(null);
      };

  useEffect(() => {
    if (!import.meta.env.DEV || import.meta.env.VITE_BROWSER_LIFECYCLE_TEST !== "true") return;
    const switchLearner = (event: Event) => {
      const detail = (event as CustomEvent<{
        activationCode: string;
        fullName: string;
        email: string;
        userId: number;
      }>).detail;
      void setSession(detail);
    };
    const suspendLearner = () => {
      void suspendSession();
    };
    window.addEventListener("chainsaw:test-switch-learner", switchLearner);
    window.addEventListener("chainsaw:test-suspend-learner", suspendLearner);
    document.documentElement.setAttribute("data-lifecycle-test-ready", "true");
    return () => {
      window.removeEventListener("chainsaw:test-switch-learner", switchLearner);
      window.removeEventListener("chainsaw:test-suspend-learner", suspendLearner);
      document.documentElement.removeAttribute("data-lifecycle-test-ready");
    };
  }, [setSession, suspendSession]);

  return (
    <UserContext.Provider value={{
      activationCode,
      deviceId,
      fullName,
      email,
      userId,
      enrollmentId,
      accessExpiresAt,
      courseCompletedAt,
      accessStatus,
      allModulesUnlocked,
      assignedTo,
      subscription,
      bondedLearner,
      setSession,
      setAccessInfo,
      suspendSession,
      resumeSession,
      clearSession,
      clearRejectedSession,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUserSession = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserSession must be used within UserProvider");
  return ctx;
};