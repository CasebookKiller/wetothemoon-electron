export const RangeSetting: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  description?: string;
  disabled?: boolean;
}> = ({ label, value, min, max, step = 0.1, onChange, description, disabled }) => (
  <div>
    <label className={`block ${disabled ? 'text-100': 'text-700'} font-medium mb-2`}>{label}: {value.toFixed(2)}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
      disabled={disabled}
    />
    {description && <small className={`${disabled?'text-100':'text-400'}`}>{description}</small>}
  </div>
);
