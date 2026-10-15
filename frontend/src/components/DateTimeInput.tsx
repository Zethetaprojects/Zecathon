import React from 'react';

type DateTimeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Themed `datetime-local` field. Clicking anywhere on it opens the browser's
 * date & time picker, not just the small calendar icon.
 */
export default function DateTimeInput({ className = '', onClick, ...props }: DateTimeInputProps) {
  const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
    onClick?.(e);
    try {
      // showPicker is missing in older browsers and throws in some contexts
      // (e.g. cross-origin iframes); the field still works by typing then.
      e.currentTarget.showPicker?.();
    } catch {
      // ignore
    }
  };

  return (
    <input
      {...props}
      type="datetime-local"
      onClick={openPicker}
      className={`w-full rounded px-4 py-3 neon-input cursor-pointer ${className}`}
    />
  );
}
