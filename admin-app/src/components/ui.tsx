import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'accent' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: ReactNode; loading?: boolean; iconOnly?: boolean };
export function Button({ variant = 'default', size = 'md', icon, loading, iconOnly, children, className = '', disabled, ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' && variant, size === 'sm' && 'sm', iconOnly && 'icon', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, actions, children, footer, className = '', bodyClass = 'card-body' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; footer?: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={'card ' + className}>
      {(title || actions) && (
        <div className="card-head">
          <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children != null && <div className={bodyClass}>{children}</div>}
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}

export function Badge({ tone, children, dot }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'accent'; children: ReactNode; dot?: boolean }) {
  return <span className={'badge ' + (tone || '')}>{dot && <span className="dot" />}{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return <span className="row muted small" role="status"><span className="spinner" />{label}</span>;
}

export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden />;
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="icon-tile">{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode; title?: string }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return <div className={'notice ' + tone} role={tone === 'danger' ? 'alert' : 'status'}><Icon /><div className="stack-sm">{title && <b>{title}</b>}<div>{children}</div></div></div>;
}

export function Trend({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null || !Number.isFinite(value)) return <span className="trend flat" title="Pas de comparaison possible"><Minus />n/d</span>;
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.5;
  const cls = flat ? 'flat' : good ? 'up' : 'down';
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={'trend ' + cls}><Icon />{(value > 0 ? '+' : '') + value.toFixed(1).replace('.', ',')} %</span>;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="check">
      <span className="switch"><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} /><span /></span>
      <span>{label}</span>
    </label>
  );
}

export function Field({ label, hint, children, counter, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; counter?: { value: number; min?: number; max: number }; htmlFor?: string }) {
  let cls = 'counter';
  if (counter) {
    if (counter.value > counter.max) cls += ' bad';
    else if (counter.min && counter.value > 0 && counter.value < counter.min) cls += ' warn';
  }
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}{counter && <span className={cls}>{counter.value} / {counter.max}</span>}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode; icon?: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.icon}{o.label}</button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => <button key={t.value} role="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>{t.label}</button>)}
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}
function useFocusTrap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close]), [tabindex]');
    (first || el)?.focus();
    return () => { prev?.focus?.(); };
  }, [ref]);
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose); useFocusTrap(ref);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref} tabIndex={-1}>
        <div className="modal-head"><h2>{title}</h2><Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label="Fermer" data-close icon={<X />} /></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="card-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose); useFocusTrap(ref);
  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" ref={ref} tabIndex={-1}>
        <div className="modal-head"><h2>{title}</h2><Button variant="ghost" iconOnly size="sm" onClick={onClose} aria-label="Fermer" data-close icon={<X />} /></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="card-foot">{footer}</div>}
      </aside>
    </div>
  );
}

/* ---------- Notifications ---------- */
type Toast = { id: number; tone: 'success' | 'error' | 'info'; title: string; text?: string };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), t.tone === 'error' ? 9000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
          return (
            <div key={t.id} className={'toast ' + t.tone} role={t.tone === 'error' ? 'alert' : 'status'}>
              <Icon /><div className="grow"><b>{t.title}</b>{t.text && <span className="muted">{t.text}</span>}</div>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer" icon={<X />} onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} />
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Confirmation ---------- */
type ConfirmOpts = { title: string; text: ReactNode; confirm?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(false)} footer={<>
          <Button onClick={() => close(false)}>Annuler</Button>
          <Button variant={state.danger ? 'danger' : 'primary'} className={state.danger ? 'solid' : ''} onClick={() => close(true)}>{state.confirm || 'Confirmer'}</Button>
        </>}>
          <div className="muted">{state.text}</div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
