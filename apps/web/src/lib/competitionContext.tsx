import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Several pages (settings, results, judges, candidates) operate on "the current
 * competition". We keep the choice in one place and persist it so a refresh does
 * not reset the admin's context.
 */
const STORAGE_KEY = "tahkeem.selectedCompetition";

interface CompetitionContextValue {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const CompetitionContext = createContext<CompetitionContextValue | null>(null);

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Keep other tabs in sync.
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSelectedIdState(event.newValue);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const value = useMemo<CompetitionContextValue>(
    () => ({ selectedId, setSelectedId }),
    [selectedId, setSelectedId],
  );

  return (
    <CompetitionContext.Provider value={value}>
      {children}
    </CompetitionContext.Provider>
  );
}

export function useSelectedCompetition(): CompetitionContextValue {
  const ctx = useContext(CompetitionContext);
  if (!ctx) {
    throw new Error(
      "useSelectedCompetition must be used within a CompetitionProvider",
    );
  }
  return ctx;
}
