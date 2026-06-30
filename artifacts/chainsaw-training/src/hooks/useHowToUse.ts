import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";

interface HowToUseState {
  text: string | null;
  isLoading: boolean;
  error: string | null;
}

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
        const rootRef = ref(storage);
        const listing = await listAll(rootRef);

        const target = listing.items.find((item) => {
          const name = item.name.toLowerCase();
          return (
            name.includes("how") ||
            name.includes("use") ||
            name.includes("elearning") ||
            name.includes("e-learning") ||
            name.includes("guide") ||
            name.includes("course")
          );
        });

        if (!target) {
          if (!cancelled) setState({ text: null, isLoading: false, error: "File not found in storage" });
          return;
        }

        const url = await getDownloadURL(target);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!cancelled) setState({ text, isLoading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ text: null, isLoading: false, error: String(err) });
      }
    }

    fetchContent();
    return () => { cancelled = true; };
  }, []);

  return state;
}
