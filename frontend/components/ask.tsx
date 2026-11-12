"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type Question = { title: string; action: string; danger?: boolean; field?: { label: string; value?: string; max: number } };
type Ask = (q: Question) => Promise<string | null>;

const AskContext = createContext<Ask>(() => Promise.resolve(null));

/** The app's confirm and prompt, in its own style: `await ask(...)` gives the text typed ("" with no field), or null if cancelled. */
export const useAsk = () => useContext(AskContext);

export function AskProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState<Question | null>(null);
  const answer = useRef<(value: string | null) => void>(null);
  const ask = useCallback<Ask>(
    (q) =>
      new Promise((resolve) => {
        answer.current = resolve;
        // After the menu that asked has closed, so it does not take the focus back.
        setTimeout(() => setQuestion(q));
      }),
    [],
  );
  const close = (value: string | null) => {
    answer.current?.(value);
    answer.current = null;
    setQuestion(null);
  };

  return (
    <AskContext.Provider value={ask}>
      {children}
      <Dialog open={!!question} onOpenChange={(open) => !open && close(null)}>
        {question && (
          <DialogContent title={question.title} closeLabel={t("common.close")} className="max-w-sm">
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const value = String(new FormData(e.currentTarget).get("value") ?? "").trim();
                if (!question.field || value) close(value);
              }}
            >
              {question.field && <Input name="value" required autoFocus maxLength={question.field.max} defaultValue={question.field.value} aria-label={question.field.label} placeholder={question.field.label} autoComplete="off" />}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => close(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant={question.danger ? "destructive" : "default"} autoFocus={!question.field}>
                  {question.action}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </AskContext.Provider>
  );
}
