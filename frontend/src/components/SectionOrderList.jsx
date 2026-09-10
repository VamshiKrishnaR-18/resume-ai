import { useState } from "react";

export default function SectionOrderList({ sections, onChange }) {
  const [dragIndex, setDragIndex] = useState(null);

  function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function handleDrop(dropIndex) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
    setDragIndex(null);
  }

  return (
    <ul className="section-order-list">
      {sections.map((name, index) => (
        <li
          key={name}
          draggable
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(index)}
        >
          <span className="drag-handle" title="Drag to reorder">
            ⠿
          </span>
          <span className="section-number">{index + 1}</span>
          <span className="section-name">{name}</span>
          <span className="section-arrows">
            <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </button>
            <button
              type="button"
              disabled={index === sections.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
