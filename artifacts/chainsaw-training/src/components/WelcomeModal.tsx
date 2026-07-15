import { useState, useEffect } from "react";
import { useUserSession } from "../contexts/UserContext";

const BASE = import.meta.env.BASE_URL as string;

type Phase = "logo-in" | "expand" | "content" | "leaving";

const STEPS = [
  { emoji: "📹", text: "Work through the 7 training modules in order — each one unlocks after you watch the video and pass the quiz (80% to pass)." },
  { emoji: "🧠", text: "Use the AI Mock Test when you're ready to practise for the written exam." },
  { emoji: "📋", text: "The Inspection Checklist and Risk Assessment are standalone tools for your real-world use." },
  { emoji: "🗺️", text: "The Biosecurity Map and Chain Chart are available from the main menu anytime." },
];

export default function WelcomeModal() {
  const { userId } = useUserSession();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("logo-in");

  useEffect(() => {
    if (!userId) return;
    const key = `welcome_seen_${userId}`;
    if (localStorage.getItem(key)) return;

    setMounted(true);
    setPhase("logo-in");

    const t1 = setTimeout(() => setPhase("expand"), 1000);
    const t2 = setTimeout(() => setPhase("content"), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [userId]);

  const dismiss = () => {
    if (userId) localStorage.setItem(`welcome_seen_${userId}`, "1");
    setPhase("leaving");
    setTimeout(() => setMounted(false), 600);
  };

  if (!mounted) return null;

  const isCircle = phase === "logo-in" || phase === "expand";
  const logoVisible = phase === "logo-in" || phase === "expand";
  const showContent = phase === "content";
  const isLeaving = phase === "leaving";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: isLeaving ? 0 : 1,
        transition: "opacity 600ms ease",
      }}
    >
      {/* Card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: isCircle ? "50%" : "1.25rem",
          width: isCircle ? 164 : Math.min(440, typeof window !== "undefined" ? window.innerWidth - 32 : 440),
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 25px 60px -10px rgba(0,0,0,0.5)",
          transition: "width 750ms cubic-bezier(0.34,1.4,0.64,1), border-radius 750ms cubic-bezier(0.34,1.4,0.64,1)",
        }}
      >
        {/* Logo area — fixed 164px height while circular so we get a perfect circle */}
        <div
          style={{
            height: isCircle ? 164 : "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: isCircle ? 0 : 28,
            paddingBottom: isCircle ? 0 : 4,
            transition: "height 750ms cubic-bezier(0.34,1.4,0.64,1), padding 750ms ease",
          }}
        >
          <img
            src={`${BASE}logo.png`}
            alt="Chainsaw Courses"
            style={{
              width: isCircle ? 100 : 80,
              height: isCircle ? 100 : 80,
              objectFit: "contain",
              opacity: logoVisible ? 1 : 0,
              transform: logoVisible ? "scale(1)" : "scale(0.85)",
              transition: "opacity 700ms ease, transform 700ms ease, width 750ms ease, height 750ms ease",
              transitionDelay: phase === "logo-in" ? "100ms" : "0ms",
            }}
          />
        </div>

        {/* Welcome content */}
        <div
          style={{
            width: "100%",
            maxHeight: showContent ? 600 : 0,
            opacity: showContent ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 600ms ease, opacity 500ms ease",
            transitionDelay: showContent ? "120ms" : "0ms",
          }}
        >
          <div style={{ padding: "4px 24px 28px", textAlign: "center" }}>

            <h2
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "1.4rem",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.02em",
                color: "#b45309",
                margin: "0 0 4px",
              }}
            >
              Welcome!
            </h2>

            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.775rem",
                color: "#6b7280",
                lineHeight: 1.65,
                margin: "0 0 20px",
              }}
            >
              Thank you for purchasing the course. Here's a quick guide to help you get started.
            </p>

            <div style={{ textAlign: "left", marginBottom: 22 }}>
              {STEPS.map(({ emoji, text }) => (
                <div
                  key={emoji}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 11 }}
                >
                  <span style={{ fontSize: "0.95rem", flexShrink: 0, lineHeight: 1.6 }}>{emoji}</span>
                  <p
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "0.72rem",
                      color: "#111827",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={dismiss}
              style={{
                width: "100%",
                padding: "11px 0",
                background: "#b45309",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.85rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#92400e")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#b45309")}
            >
              <span style={{ fontSize: "1rem" }}>✓</span>
              I'm Ready!
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
