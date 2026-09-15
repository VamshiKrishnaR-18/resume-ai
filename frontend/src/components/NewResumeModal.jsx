import React from "react";
import SectionOrderList from "./SectionOrderList.jsx";
import TemplateGrid from "./TemplateGrid.jsx";

export default function SettingsPanel({
  settingsState,
  updateSetting,
  FONT_FAMILIES,
  PAGE_SIZES,
}) {
  if (!settingsState) return null;

  return (
    <div className="panel formatting-panel">
      <h2 style={{ fontSize: 15, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Section Order
      </h2>
      <SectionOrderList
        sections={settingsState.section_order}
        onChange={(order) => updateSetting({ section_order: order })}
      />

      <h2 className="subheading" style={{ fontSize: 15, textTransform: "uppercase" }}>
        Template
      </h2>
      <TemplateGrid
        value={settingsState.template}
        onChange={(template) => updateSetting({ template })}
      />

      <label className="field subheading">
        <span>Font Family</span>
        <select
          value={settingsState.font_family}
          onChange={(e) => updateSetting({ font_family: e.target.value })}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Font Size</span>
        <div className="font-size-row">
          <input
            type="range"
            min={9}
            max={14}
            value={settingsState.font_size}
            onChange={(e) => updateSetting({ font_size: Number(e.target.value) })}
          />
          <span className="muted">{settingsState.font_size}pt</span>
        </div>
      </label>

      <label className="field">
        <span>Page Size</span>
        <select
          value={settingsState.page_size}
          onChange={(e) => updateSetting({ page_size: e.target.value })}
        >
          {PAGE_SIZES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
    </div>
  );
}