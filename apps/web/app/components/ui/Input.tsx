'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, hint, error, leading, trailing, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[var(--ef-gray-600)] mb-1.5"
          >
            {label}
          </label>
        ) : null}
        <div className="relative flex items-center">
          {leading ? (
            <span className="absolute left-3 text-sm text-[var(--ef-muted)] pointer-events-none select-none">
              {leading}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={`ef-input ${leading ? '!pl-12' : ''} ${trailing ? '!pr-10' : ''} ${
              error ? '!border-[var(--ef-danger)] focus:!shadow-[0_0_0_3px_var(--ef-danger-muted)]' : ''
            } ${className}`}
            aria-invalid={!!error}
            {...props}
          />
          {trailing ? (
            <span className="absolute right-3 text-[var(--ef-muted)] pointer-events-none">
              {trailing}
            </span>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-[var(--ef-danger)]">
            {error}
          </p>
        ) : hint ? (
          <p className="mt-1.5 text-xs text-[var(--ef-muted)]">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
