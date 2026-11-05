import { useId, useState } from "react";
import { ChevronRight } from "lucide-react";
import "./ExpandableTableRow.css";

export default function ExpandableTableRow({ label, cells, children }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  function toggleFromRow(event) {
    if (event.target.closest("a, button, input, select, textarea, summary")) return;
    if (window.getSelection()?.toString()) return;
    setExpanded((value) => !value);
  }

  return (
    <>
      <tr className="expandable-row" onClick={toggleFromRow} data-expanded={expanded}>
        {cells.map((cell, index) => index === 0 ? (
          <th key={cell.key} scope="row" className={cell.className} data-column={cell.key}>
            <button
              type="button"
              className="expandable-row-toggle"
              aria-label={label}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronRight size={14} aria-hidden="true" />
              {cell.content}
            </button>
          </th>
        ) : (
          <td key={cell.key} className={cell.className} data-column={cell.key}>{cell.content}</td>
        ))}
      </tr>
      <tr className="expandable-row-panel" hidden={!expanded} id={panelId}>
        <td colSpan={cells.length}>{expanded && children}</td>
      </tr>
    </>
  );
}
