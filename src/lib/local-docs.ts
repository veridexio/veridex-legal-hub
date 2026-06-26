import { useEffect, useState } from "react";

export type LocalDoc = {
  id: string;
  title: string;
  text: string;
  pages?: number;
  addedAt: number;
};

const KEY = "veridex.docs.v1";

function read(): LocalDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(docs: LocalDoc[]) {
  window.localStorage.setItem(KEY, JSON.stringify(docs));
  window.dispatchEvent(new Event("veridex:docs"));
}

export function useLocalDocs() {
  const [docs, setDocs] = useState<LocalDoc[]>(() => read());

  useEffect(() => {
    const sync = () => setDocs(read());
    window.addEventListener("veridex:docs", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("veridex:docs", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    docs,
    addDoc(doc: Omit<LocalDoc, "id" | "addedAt">) {
      const next: LocalDoc = {
        ...doc,
        id: crypto.randomUUID(),
        addedAt: Date.now(),
      };
      write([next, ...read()]);
      return next;
    },
    removeDoc(id: string) {
      write(read().filter((d) => d.id !== id));
    },
    clear() {
      write([]);
    },
  };
}

const CHAT_KEY = "veridex.chat.v1";

export function readChat<T = unknown>(): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function writeChat(messages: unknown[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
}

export function clearChat() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CHAT_KEY);
}