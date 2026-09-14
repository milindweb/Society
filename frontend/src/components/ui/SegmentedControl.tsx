/* SegmentedControl.tsx — design.md §87 */

interface SegmentedOption {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ options, value, onChange, className = '' }: SegmentedControlProps) {
  return (
    <div className={`hs-segmented ${className}`} role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.key}
          className={`hs-segmented__option ${value === opt.key ? 'hs-segmented__option--active' : ''}`}
          role="radio"
          aria-checked={value === opt.key}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
