import { useEffect, useState } from "react";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

interface HowToUseState {
  text: string | null;
  isLoading: boolean;
  error: string | null;
}

const FILENAME = "How to Use Your Online Course.docx";

export function useHowToUse(): HowToUseState {
  const [state, setState] = useState<HowToUseState>({
    text: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchContent() {
      try {
        const fileRef = ref(storage, FILENAME);
        const downloadUrl = await getDownloadURL(fileRef);

        const res = await fetch(`/api/how-to-use?url=${encodeURIComponent(downloadUrl)}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json() as { text?: string; error?: string };
        if (data.error) throw new Error(data.error);
        const text = data.text?.trim() ?? null;
        if (!cancelled) setState({ text, isLoading: false, error: null });
      } catch (err: unknown) {
        const msg = (err as { message?: string }).message ?? String(err);
        console.error("[useHowToUse] failed:", msg);
        if (!cancelled) setState({ text: null, isLoading: false, error: msg });
      }
    }

    fetchContent();
    return () => { cancelled = true; };
  }, []);

  return state;
}
