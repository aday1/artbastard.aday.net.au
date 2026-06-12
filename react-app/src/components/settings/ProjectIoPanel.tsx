import React, { useRef, useState } from 'react';
import { stringify as yamlStringify, parse as yamlParse } from 'yaml';
import { useStore } from '../../store';
import styles from './SettingsPanel.module.scss';

const SECTIONS = [
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'groups', label: 'Groups' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'acts', label: 'ACTS' },
  { id: 'bindings', label: 'MIDI bindings' },
  { id: 'config', label: 'Network & OSC' },
  { id: 'layout', label: 'Stage layout & masters' },
  { id: 'presets', label: 'Presets & favourites' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const PRESETS_KEY = 'artbastard-presets';
const CLIENT_ONLY: SectionId[] = ['presets'];

const readPresetsYaml = (): string => {
  const raw = localStorage.getItem(PRESETS_KEY);
  if (!raw) return yamlStringify({ presets: [], categories: [] }, { indent: 2, lineWidth: 0 });
  try {
    const parsed = JSON.parse(raw);
    const state = parsed?.state || parsed;
    return yamlStringify(
      { presets: state.presets || [], categories: state.categories || [] },
      { indent: 2, lineWidth: 0 }
    );
  } catch {
    return yamlStringify({ presets: [], categories: [] }, { indent: 2, lineWidth: 0 });
  }
};

const writePresetsYaml = (yamlText: string): number => {
  const parsed: any = yamlParse(yamlText);
  if (!parsed || typeof parsed !== 'object') throw new Error('invalid presets YAML');
  const presets = Array.isArray(parsed.presets) ? parsed.presets : [];
  const categories = Array.isArray(parsed.categories) ? parsed.categories : [];
  const existingRaw = localStorage.getItem(PRESETS_KEY);
  let envelope: any = { state: { presets, categories }, version: 0 };
  if (existingRaw) {
    try {
      const existing = JSON.parse(existingRaw);
      envelope = { ...existing, state: { ...(existing.state || {}), presets, categories } };
    } catch {
      // fall through to fresh envelope
    }
  }
  localStorage.setItem(PRESETS_KEY, JSON.stringify(envelope));
  return presets.length;
};

const ProjectIoPanel: React.FC = () => {
  const addNotification = useStore((s) => s.addNotification);
  const [busy, setBusy] = useState<SectionId | 'bundle' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<SectionId>('fixtures');

  const downloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (section: SectionId) => {
    setBusy(section);
    try {
      let text: string;
      if (CLIENT_ONLY.includes(section)) {
        text = readPresetsYaml();
      } else {
        const res = await fetch(`/api/project/export?section=${section}`);
        if (!res.ok) throw new Error(`export failed: ${res.status}`);
        text = await res.text();
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadText(`artbastard-${section}-${stamp}.yaml`, text);
      addNotification({ message: `Exported ${section}.yaml`, type: 'success' });
    } catch (err) {
      addNotification({ message: `Export failed: ${(err as Error).message}`, type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleExportBundle = async () => {
    setBusy('bundle');
    try {
      const res = await fetch('/api/project/export/bundle');
      if (!res.ok) throw new Error(`bundle export failed: ${res.status}`);
      const bundle = (await res.json()) as Record<string, string>;
      bundle.presets = readPresetsYaml();
      const stamp = new Date().toISOString().slice(0, 10);
      Object.entries(bundle).forEach(([section, text]) =>
        downloadText(`artbastard-${section}-${stamp}.yaml`, text)
      );
      const count = Object.keys(bundle).length;
      addNotification({ message: `Exported full project bundle (${count} files)`, type: 'success' });
    } catch (err) {
      addNotification({ message: `Bundle export failed: ${(err as Error).message}`, type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleImportClick = (section: SectionId) => {
    setImportTarget(section);
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;
    setBusy(importTarget);
    try {
      const yamlText = await file.text();
      let applied = 0;
      let warnings: string[] = [];
      if (CLIENT_ONLY.includes(importTarget)) {
        applied = writePresetsYaml(yamlText);
      } else {
        const res = await fetch('/api/project/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: importTarget, yamlText }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || `import failed: ${res.status}`);
        warnings = body?.warnings || [];
        applied = body?.applied ?? 0;
      }
      addNotification({
        message: `Imported ${applied} ${importTarget} entr${applied === 1 ? 'y' : 'ies'}${warnings.length ? ` (${warnings.length} warnings)` : ''}`,
        type: warnings.length ? 'warning' : 'success',
      });
      warnings.slice(0, 5).forEach((w) => addNotification({ message: w, type: 'warning' }));
      if (CLIENT_ONLY.includes(importTarget)) {
        addNotification({
          message: 'Reload the page to see imported presets in the UI.',
          type: 'info',
        });
      }
    } catch (err) {
      addNotification({ message: `Import failed: ${(err as Error).message}`, type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.stateManagement}>
      <h3>
        <i className="fas fa-file-code" style={{ marginRight: 8 }} />
        Project YAML round-trip
      </h3>
      <p className={styles.description}>
        Export your rig setup as hand-editable YAML files, one per concern. Edit in any
        text editor, commit to git, share with collaborators, then re-import losslessly.
      </p>

      <div className={styles.section}>
        <h4>Export</h4>
        <p className={styles.hint}>Downloads the current server-side state as YAML.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={styles.actionButton ?? ''}
              disabled={busy !== null}
              onClick={() => handleExport(s.id)}
            >
              {busy === s.id ? '…' : `Download ${s.id}.yaml`}
            </button>
          ))}
          <button
            className={styles.actionButton ?? ''}
            disabled={busy !== null}
            onClick={handleExportBundle}
            style={{ fontWeight: 600 }}
          >
            {busy === 'bundle' ? 'Bundling…' : 'Download all (full backup)'}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h4>Import</h4>
        <p className={styles.hint}>
          Picks a YAML file and replaces the matching section. Mismatches surface as
          warnings (e.g. group references a fixture id not in the current rig).
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={styles.actionButton ?? ''}
              disabled={busy !== null}
              onClick={() => handleImportClick(s.id)}
            >
              {busy === s.id ? '…' : `Import ${s.label} YAML`}
            </button>
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml,text/yaml"
          style={{ display: 'none' }}
          onChange={handleFileChosen}
        />
      </div>
    </div>
  );
};

export default ProjectIoPanel;
