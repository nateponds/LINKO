import { useId } from "react";

function SearchField({
  value,
  onChange,
  onSubmit,
  onClear,
  label = "Search",
  placeholder = "Search",
  id,
  disabled = false,
  className = "",
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  function submit(event) {
    event.preventDefault();
    onSubmit?.(value);
  }

  function clear() {
    if (onClear) onClear();
    else onChange?.("");
  }

  return (
    <form className={`list-search ${className}`.trim()} role="search" onSubmit={submit}>
      <label htmlFor={inputId}>{label}</label>
      <div className="list-search__input-wrap">
        <input
          id={inputId}
          type="search"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        />
        {value && (
          <button type="button" onClick={clear} disabled={disabled} aria-label={`Clear ${label.toLowerCase()}`}>
            Clear
          </button>
        )}
        <button type="submit" disabled={disabled}>Search</button>
      </div>
    </form>
  );
}

export default SearchField;
