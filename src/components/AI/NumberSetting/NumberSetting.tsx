export const NumberSetting: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  description?: string;
  disabled?: boolean;
}> = ({ label, value, min, max, onChange, description, disabled }) => (
  <div>
    <label className={`block ${disabled ? 'text-100': 'text-700'} font-medium mb-2`}>{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full p-2 border-round border-1 surface-border"
      min={min}
      max={max}
      disabled={disabled}
    />
    {description && <small className={`${disabled?'text-100':'text-400'}`}>{description}</small>}
  </div>
);
