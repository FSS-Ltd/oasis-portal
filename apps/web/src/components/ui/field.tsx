import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}

export function Field({ label, error, hint, required = false, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {required ? <span className="field__required">Required</span> : null}
      </span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    return <input className="input" {...props} ref={ref} />;
  },
);

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectInput(props, ref) {
    return <select className="input" {...props} ref={ref} />;
  },
);
