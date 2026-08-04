export function ToggleSetting({
  name,
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  name: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-setting">
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <input
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <i />
    </label>
  );
}
