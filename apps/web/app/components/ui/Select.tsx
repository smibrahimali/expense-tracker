'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, children, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-[var(--ef-gray-600)] mb-1.5"
          >
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={`ef-input cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23a89f96%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center] pr-8 ${
            error ? '!border-[var(--ef-danger)]' : ''
          } ${className}`}
          aria-invalid={!!error}
          {...props}
        >
          {children}
        </select>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs text-[var(--ef-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);
Select.displayName = 'Select';
