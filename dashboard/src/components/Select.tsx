interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function Select({
  label,
  value,
  options,
  onChange,
  placeholder = "Select...",
}: SelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-discord-dark border border-discord-border rounded-lg px-3 py-2 text-sm text-discord-text focus:outline-none focus:ring-2 focus:ring-discord-blurple/50 focus:border-discord-blurple"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
