const completionAudio = new Audio("/audio/ding.wav");
completionAudio.volume = 0.5;
completionAudio.load();

export function playCompletionDing() {
  try {
    completionAudio.currentTime = 0;
    completionAudio.play().catch(() => {
      // Audio can be unavailable or blocked by the browser.
    });
  } catch {
    // Audio is optional feedback and must not interrupt a completed save.
  }
}