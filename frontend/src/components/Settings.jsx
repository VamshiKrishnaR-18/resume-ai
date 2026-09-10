import { useEffect, useState } from "react";
import { api } from "../api.js";
import TemplateGrid from "./TemplateGrid.jsx";
import SectionOrderList from "./SectionOrderList.jsx";

const FONT_FAMILIES = ["Calibri", "Arial", "Georgia", "Garamond", "Helvetica", "Times New Roman"];
const PAGE_SIZES = ["A4", "Letter"];

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSettings().then(setSettings).catch((err) => setError(err.message));
  }, []);

  function update(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    try {
      const result = await api.updateSettings(settings);
      setSettings(result);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReset() {
    try {
      const result = await api.resetSettings();
      setSettings(result);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <div className="error-banner">{error}</div>;
  if (!settings) return <div className="muted">Loading settings...</div>;

  return (
    <div className="panel">
      <h2>Settings</h2>
      <p className="muted">Defaults applied to every new resume you generate and export.</p>

      <div className="settings-grid">
        <div>
          <h3 className="subheading" style={{ marginTop: 0 }}>
            Template
          </h3>
          <TemplateGrid value={settings.template} onChange={(template) => update({ template })} />

          <h3 className="subheading">Section Order</h3>
          <SectionOrderList
            sections={settings.section_order}
            onChange={(order) => update({ section_order: order })}
          />
        </div>

        <div>
          <label className="field">
            <span>Font Family</span>
            <select value={settings.font_family} onChange={(e) => update({ font_family: e.target.value })}>
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
                value={settings.font_size}
                onChange={(e) => update({ font_size: Number(e.target.value) })}
              />
              <span className="muted">{settings.font_size}pt</span>
            </div>
          </label>

          <div className="field-row">
            <label className="field">
              <span>Page Size</span>
              <select value={settings.page_size} onChange={(e) => update({ page_size: e.target.value })}>
                {PAGE_SIZES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Margin (mm)</span>
              <input
                type="number"
                min={5}
                max={30}
                value={settings.page_margin_mm}
                onChange={(e) => update({ page_margin_mm: Number(e.target.value) })}
              />
            </label>
          </div>

          <label className="field">
            <span>Line Height</span>
            <input
              type="number"
              step="0.1"
              min={1}
              max={2}
              value={settings.line_height}
              onChange={(e) => update({ line_height: Number(e.target.value) })}
            />
          </label>

          <label className="field">
            <span>Download Filename Pattern</span>
            <input
              value={settings.download_filename_pattern}
              onChange={(e) => update({ download_filename_pattern: e.target.value })}
            />
            <span className="field-hint">
              Use FirstName, Role, and CompanyName as placeholders.
            </span>
          </label>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave}>
          Save Settings
        </button>
        <button className="btn-secondary" onClick={handleReset}>
          Reset to Defaults
        </button>
      </div>
      {saved && <p className="success-text">Settings saved.</p>}
    </div>
  );
}
