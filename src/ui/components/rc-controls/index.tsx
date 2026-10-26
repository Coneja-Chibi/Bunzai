/**
 * RoleCall's plain controls in one place: Input, Textarea, Select, Button, Chip, Checkbox and Tooltip, each a thin
 * wrapper that adds the shared class to native props (a caller's className is for layout only). The look lives in
 * styles.module.css, taken from RoleCall's wing fields (PresetPanel.tsx:2845, 3386), ui/button.tsx and ui/badge.tsx.
 * Importing this also loads the number-spinner reset, so every number field loses the browser's arrows.
 */
import { useId, type HTMLAttributes, type InputHTMLAttributes, type JSX, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import "./rc-reset.css";
import styles from "./styles.module.css";

const cx = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(" ");

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return <input {...rest} className={cx(styles.field, className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return <textarea {...rest} className={cx(styles.field, styles.area, className)} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return <select {...rest} className={cx(styles.field, className)} />;
}

export function Chip({ className, ...rest }: HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return <span {...rest} className={cx(styles.chip, className)} />;
}

export function Checkbox({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">): JSX.Element {
  return <input {...rest} type="checkbox" className={cx(styles.check, className)} />;
}

/** A hover and focus bubble over its child; the text is also the child's accessible description. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }): JSX.Element {
  const id = useId();
  return (
    <span className={styles.tipWrap} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={styles.tip}>{text}</span>
    </span>
  );
}
