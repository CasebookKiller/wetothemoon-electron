export const TextSetting: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  description?: string;
  disabled?: boolean;
}> = ({ label, value, placeholder, onChange, description, disabled }) => (
  <div>
    <label className={`block ${disabled ? 'text-100': 'text-700'} font-medium mb-2`}>{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-2 border-round border-1 surface-border"
      disabled={disabled}
    />
    {description && <small className={`${disabled?'text-100':'text-400'}`}>{description}</small>}
  </div>
);
