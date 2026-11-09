"use client";

import { useEffect, useRef } from "react";

import { Textarea } from "@/components/ui/input";

const DELAY = 600; // ms after the last keystroke

/** Saves shortly after typing stops, when leaving the field, and when the card closes. */
export function AutoDescription({ id, value, disabled, onTyping, onSave }: {
  id: string;
  value: string;
  disabled: boolean;
  onTyping: (typing: boolean) => void;
  onSave: (value: string) => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saved = useRef(value);
  const current = useRef(value);
  const flush = useRef(() => {});
  flush.current = () => {
    clearTimeout(timer.current);
    onTyping(false);
    if (current.current !== saved.current) {
      saved.current = current.current;
      onSave(current.current);
    }
  };
  useEffect(() => () => flush.current(), []);

  return (
    <Textarea
      id={id}
      defaultValue={value}
      disabled={disabled}
      maxLength={5000}
      rows={5}
      onChange={(e) => {
        current.current = e.target.value;
        onTyping(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => flush.current(), DELAY);
      }}
      onBlur={() => flush.current()}
    />
  );
}
