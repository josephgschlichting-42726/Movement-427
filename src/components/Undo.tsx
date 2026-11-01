import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type UndoFn = () => void | Promise<void>;
interface Toast {
  id: number;
  message: string;
  undo: UndoFn;
}

const Ctx = createContext<(message: string, undo: UndoFn) => void>(() => {});

/** Every destructive tap offers Undo for ~6s (plan §3.5: nothing is ever locked). */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const offer = useCallback((message: string, undo: UndoFn) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, undo });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Ctx.Provider value={offer}>
      {children}
      {toast && (
        <div className="undo" role="status" key={toast.id}>
          <span>{toast.message}</span>
          <button
            onClick={async () => {
              clearTimeout(timer.current);
              setToast(null);
              await toast.undo();
            }}
          >
            Undo
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useUndo = () => useContext(Ctx);
