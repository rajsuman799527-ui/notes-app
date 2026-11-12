import { useRef } from 'react';
import { cn } from '@project/components/lib/utils';

type Props = {
  value: string;
  onChange: (v: string) => void;
  masked?: boolean;
  size?: 'lg' | 'sm';
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function DigitBoxes({ value, onChange, masked, size = 'lg', disabled, autoFocus }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const box = size === 'lg' ? 'h-20 w-16 text-4xl rounded-[22px]' : 'h-11 w-10 text-xl rounded-[14px]';
  return (
    <div className={cn('relative flex gap-3', disabled && 'opacity-50')} onClick={() => ref.current?.focus()}>
      {[0, 1].map((i) => {
        const ch = value[i];
        const active = !disabled && value.length === i;
        return (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center bg-white font-semibold text-foreground transition-all',
              box,
              active ? 'ring-2 ring-primary/60 shadow-[0_6px_20px_rgba(30,107,255,0.15)]' : 'border border-[rgba(30,107,255,0.12)]',
            )}
          >
            {ch ? masked ? <span className="h-2.5 w-2.5 rounded-full bg-foreground" /> : ch : null}
          </div>
        );
      })}
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label="Page number"
        maxLength={2}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))}
        className="absolute inset-0 opacity-0"
      />
    </div>
  );
}
