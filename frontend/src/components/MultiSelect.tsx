import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Clases para el botón disparador (replica el estilo del <select> que reemplaza). */
  className?: string;
  /** Alineación del panel desplegable respecto al disparador. */
  panelAlign?: 'left' | 'right';
}

/**
 * Selector de múltiples opciones con checkboxes en un popover.
 * Reemplaza a un <select> simple: el estado es un array de los valores marcados;
 * un array vacío significa "sin filtro" (todos).
 */
const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder = 'Seleccionar',
  className = '',
  panelAlign = 'left',
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter(v => v !== value));
    else onChange([...selected, value]);
  };

  const labelText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label ?? '1 seleccionado'
        : `${selected.length} seleccionados`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-slate-400' : 'text-slate-700'}`}>
          {labelText}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="Limpiar selección"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-64 max-h-72 overflow-auto bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 ${panelAlign === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Sin opciones</div>
          ) : (
            options.map(opt => {
              const isSel = selected.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors ${isSel ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSel ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}
                  >
                    {isSel && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
