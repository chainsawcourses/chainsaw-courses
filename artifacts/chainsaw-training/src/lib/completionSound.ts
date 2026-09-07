const completionAudio = new Audio(`${import.meta.env.BASE_URL}audio/ding.wav`);
const COMPLETION_VOLUME = 0.5;
let completionAudioUnlocked = false;
completionAudio.volume = COMPLETION_VOLUME;
completionAudio.load();

/**
 * Mobile WebViews may block audio that starts after an async save request.
 * Start and immediately stop the same element during the save gesture so a
 * later successful-save playback is allowed on iOS and Android.
 */
export function primeCompletionDing() {
  if (completionAudioUnlocked) return;

  try {
    completionAudio.volume = 0;
    const playback = completionAudio.play();
    if (!playback) {
      completionAudio.volume = COMPLETION_VOLUME;
      return;
    }

    playback
      .then(() => {
        completionAudio.pause();
        completionAudio.currentTime = 0;
        completionAudio.volume = COMPLETION_VOLUME;
        completionAudioUnlocked = true;
      })
      .catch(() => {
        completionAudio.volume = COMPLETION_VOLUME;
      });
  } catch {
    completionAudio.volume = COMPLETION_VOLUME;
  }
}

export function playCompletionDing() {
  try {
    completionAudio.volume = COMPLETION_VOLUME;
    completionAudio.currentTime = 0;
    completionAudio.play().catch(() => {
      // Audio can be unavailable or blocked by the browser.
    });
  } catch {
    // Audio is optional feedback and must not interrupt a completed save.
  }
}