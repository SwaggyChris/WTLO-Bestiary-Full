import { useEffect, useMemo, useRef, useState } from 'react';
import ImageView from './components/ImageView.jsx';
import Modal from './components/Modal.jsx';
import Toasts from './components/Toasts.jsx';
import { DEFAULT_CATEGORIES, DEFAULT_ENTRIES, SPECIES_ORDER } from './data/bestiaryData.js';
import {
  getMonsterImage,
  hasMonsterImage,
  nextEntryId,
  normalizeImportedEntry,
  orderedSpecies,
  reconcileCategories,
} from './lib/bestiaryUtils.js';
import {
  createStorageBackup,
  deleteBestiaryImage,
  isProjectUploadedImage,
  loadBestiaryState,
  saveBestiaryState,
  uploadBestiaryImage,
} from './services/storageApi.js';

export default function App() {
  const [entries, setEntries] = useState(() => DEFAULT_ENTRIES);
  const [categories, setCategories] = useState(() => (
    reconcileCategories(DEFAULT_ENTRIES, DEFAULT_CATEGORIES)
  ));
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentView, setCurrentView] = useState('grid');
  const [search, setSearch] = useState('');
  const [filterHasImage, setFilterHasImage] = useState(false);
  const [filterHasTraits, setFilterHasTraits] = useState(false);
  const [filterHasDescription, setFilterHasDescription] = useState(false);
  const [sortValue, setSortValue] = useState('name');
  const [detailEntryId, setDetailEntryId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#c9a84c');
  const [toasts, setToasts] = useState([]);

  const importRef = useRef(null);
  const sidebarFileRef = useRef(null);
  const skipFirstFileSaveRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    loadBestiaryState(DEFAULT_ENTRIES, DEFAULT_CATEGORIES)
      .then((state) => {
        if (cancelled) return;
        setEntries(state.entries);
        setCategories(reconcileCategories(state.entries, state.categories));
        setStorageError('');
        setStorageReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setStorageError(error.message || 'Could not connect to project file storage.');
        setStorageReady(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady) return undefined;
    if (skipFirstFileSaveRef.current) {
      skipFirstFileSaveRef.current = false;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      saveBestiaryState(entries, categories).catch((error) => {
        console.error('Failed to save bestiary project files:', error);
        setStorageError(error.message || 'Failed to write the project storage files.');
        setStorageReady(false);
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [entries, categories, storageReady]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key !== 'Escape') return;
      setDetailEntryId(null);
      setEditor((current) => {
        if (
          current
          && current.imageData !== current.originalImageData
          && isProjectUploadedImage(current.imageData)
        ) {
          deleteBestiaryImage(current.imageData).catch(() => undefined);
        }
        return null;
      });
      setCategoryManagerOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const showToast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const dismissToast = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const categoryColor = (name) => (
    categories.find((category) => category.name === name)?.color || '#c9a84c'
  );

  const categoryNames = useMemo(() => orderedSpecies(entries), [entries]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    const query = search.toLowerCase().trim();

    if (query) {
      result = result.filter((entry) => (
        entry.name?.toLowerCase().includes(query)
        || entry.description?.toLowerCase().includes(query)
        || entry.species?.toLowerCase().includes(query)
        || entry.traits?.some((trait) => String(trait).toLowerCase().includes(query))
      ));
    }

    if (selectedCategory !== 'all') {
      result = result.filter((entry) => entry.species === selectedCategory);
    }

    if (filterHasImage) result = result.filter(hasMonsterImage);
    if (filterHasTraits) result = result.filter((entry) => entry.traits?.length > 0);
    if (filterHasDescription) result = result.filter((entry) => entry.description?.trim());

    switch (sortValue) {
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'category': {
        const order = new Map(SPECIES_ORDER.map((name, index) => [name, index]));
        result.sort((a, b) => {
          const aIndex = order.has(a.species) ? order.get(a.species) : 999;
          const bIndex = order.has(b.species) ? order.get(b.species) : 999;
          if (aIndex !== bIndex) return aIndex - bIndex;
          return a.name.localeCompare(b.name);
        });
        break;
      }
      case 'recent':
        result.sort((a, b) => {
          const aDate = a.createdAt ? Date.parse(a.createdAt) : Number(a.id) || 0;
          const bDate = b.createdAt ? Date.parse(b.createdAt) : Number(b.id) || 0;
          return bDate - aDate;
        });
        break;
      case 'danger':
        result.sort((a, b) => (b.danger || 0) - (a.danger || 0));
        break;
      case 'name':
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [entries, search, selectedCategory, filterHasImage, filterHasTraits, filterHasDescription, sortValue]);

  const detailEntry = entries.find((entry) => entry.id === detailEntryId) || null;

  const openAdd = (prefill = {}) => {
    setEditor({
      mode: 'add',
      id: null,
      name: prefill.name || '',
      species: prefill.species || '',
      description: prefill.description || '',
      traits: prefill.traits || '',
      habitat: prefill.habitat || '',
      rarity: prefill.rarity || 'Common',
      danger: prefill.danger || 3,
      health: prefill.health ?? 0,
      minLevel: prefill.minLevel ?? 1,
      maxLevel: prefill.maxLevel ?? 100,
      healthPerLevel: prefill.healthPerLevel ?? 0,
      minDmg: prefill.minDmg ?? 0,
      maxDmg: prefill.maxDmg ?? 0,
      effects: prefill.effects || '',
      imageData: prefill.imageData || null,
      originalImageData: null,
    });
  };

  const openEdit = (entry) => {
    setEditor({
      mode: 'edit',
      id: entry.id,
      name: entry.name || '',
      species: entry.species || '',
      description: entry.description || '',
      traits: (entry.traits || []).join(', '),
      habitat: entry.habitat || '',
      rarity: entry.rarity || 'Common',
      danger: entry.danger || 3,
      health: entry.health ?? 0,
      minLevel: entry.minLevel ?? 1,
      maxLevel: entry.maxLevel ?? 100,
      healthPerLevel: entry.healthPerLevel ?? 0,
      minDmg: entry.minDmg ?? 0,
      maxDmg: entry.maxDmg ?? 0,
      effects: entry.effects || '',
      imageData: entry.imageData || null,
      originalImageData: entry.imageData || null,
    });
  };

  const closeEditor = () => {
    setEditor((current) => {
      if (
        current
        && current.imageData !== current.originalImageData
        && isProjectUploadedImage(current.imageData)
      ) {
        deleteBestiaryImage(current.imageData).catch((error) => {
          console.error('Could not clean up unsaved image:', error);
        });
      }
      return null;
    });
  };

  const removeEditorImage = () => {
    setEditor((current) => {
      if (!current) return current;
      if (
        current.imageData
        && current.imageData !== current.originalImageData
        && isProjectUploadedImage(current.imageData)
      ) {
        deleteBestiaryImage(current.imageData).catch((error) => {
          console.error('Could not remove temporary image:', error);
        });
      }
      return { ...current, imageData: null };
    });
  };

  const saveEditor = () => {
    if (!editor) return;
    const previousEntry = editor.mode === 'edit'
      ? entries.find((entry) => entry.id === editor.id)
      : null;
    const name = editor.name.trim();
    const species = editor.species.trim();
    if (!name || !species) {
      showToast('Name and Species are required.', 'error');
      return;
    }

    const traits = editor.traits
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (editor.mode === 'edit') {
      setEntries((current) => current.map((entry) => (
        entry.id === editor.id
          ? {
              ...entry,
              name,
              species,
              description: editor.description.trim(),
              traits,
              habitat: editor.habitat.trim(),
              rarity: editor.rarity,
              danger: Number(editor.danger) || 3,
              health: Number(editor.health) || 0,
              minLevel: Number(editor.minLevel) || 1,
              maxLevel: Number(editor.maxLevel) || 1,
              healthPerLevel: Number(editor.healthPerLevel) || 0,
              minDmg: Number(editor.minDmg) || 0,
              maxDmg: Number(editor.maxDmg) || 0,
              effects: String(editor.effects || '').trim(),
              imageData: editor.imageData || null,
            }
          : entry
      )));
    } else {
      const id = nextEntryId(entries);
      setEntries((current) => [
        ...current,
        {
          id,
          name,
          species,
          kind: species,
          description: editor.description.trim(),
          traits,
          habitat: editor.habitat.trim(),
          rarity: editor.rarity,
          danger: Number(editor.danger) || 3,
          imageData: editor.imageData || null,
          createdAt: new Date().toISOString(),
          health: Number(editor.health) || 0,
          minLevel: Number(editor.minLevel) || 1,
          maxLevel: Number(editor.maxLevel) || 1,
          healthPerLevel: Number(editor.healthPerLevel) || 0,
          minDmg: Number(editor.minDmg) || 0,
          maxDmg: Number(editor.maxDmg) || 0,
          effects: String(editor.effects || '').trim(),
        },
      ]);
    }

    setCategories((current) => reconcileCategories(
      editor.mode === 'edit'
        ? entries.map((entry) => entry.id === editor.id ? { ...entry, species } : entry)
        : [...entries, { species }],
      current,
    ));
    if (
      previousEntry
      && previousEntry.imageData !== (editor.imageData || null)
      && isProjectUploadedImage(previousEntry.imageData)
    ) {
      deleteBestiaryImage(previousEntry.imageData).catch((error) => {
        console.error('Could not remove replaced image file:', error);
      });
    }

    setEditor(null);
    showToast('Entry saved to the project data file.', 'success');
  };

  const deleteEntry = (id) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    if (!window.confirm(`Delete "${entry.name}"?`)) return;

    const remaining = entries.filter((item) => item.id !== id);
    setEntries(remaining);
    if (selectedCategory !== 'all' && !remaining.some((item) => item.species === selectedCategory)) {
      setSelectedCategory('all');
    }
    if (detailEntryId === id) setDetailEntryId(null);
    if (editor?.id === id) setEditor(null);

    if (isProjectUploadedImage(entry.imageData)) {
      deleteBestiaryImage(entry.imageData).catch((error) => {
        console.error('Could not remove deleted entry image:', error);
      });
    }

    showToast('Entry deleted. The project data file was updated.', 'info');
  };

  const clearAllEntries = () => {
    if (!entries.length) return;
    if (!window.confirm('Delete ALL entries? This cannot be undone.')) return;

    const uploadedImages = [...new Set(
      entries
        .map((entry) => entry.imageData)
        .filter(isProjectUploadedImage),
    )];

    setEntries([]);
    setDetailEntryId(null);
    setEditor(null);
    setSelectedCategory('all');

    Promise.allSettled(uploadedImages.map((imagePath) => deleteBestiaryImage(imagePath)))
      .then((results) => {
        const failed = results.filter((result) => result.status === 'rejected').length;
        if (failed) console.warn(`${failed} image file(s) could not be removed.`);
      });

    showToast('All entries cleared. The empty state is saved in the project file.', 'info');
  };

  const exportJSON = () => {
    if (!entries.length) {
      showToast('No entries to export.', 'info');
      return;
    }

    const data = entries.map((entry) => ({
      ...entry,
      category: entry.species,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bestiary_export_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Export complete.', 'success');
  };

  const importJSONFile = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('Expected an array of entries.');

      let id = nextEntryId(entries);
      const imported = [];

      for (const item of parsed) {
        if (!item?.name || !(item.species || item.category)) continue;

        const normalized = normalizeImportedEntry(item, id++);
        if (typeof normalized.imageData === 'string' && normalized.imageData.startsWith('data:image/')) {
          const blob = await fetch(normalized.imageData).then((response) => response.blob());
          const extension = blob.type === 'image/png'
            ? 'png'
            : blob.type === 'image/webp'
              ? 'webp'
              : blob.type === 'image/gif'
                ? 'gif'
                : 'jpg';
          const imageFile = new File(
            [blob],
            `${normalized.name || 'imported-image'}.${extension}`,
            { type: blob.type || 'image/jpeg' },
          );
          const uploaded = await uploadBestiaryImage(imageFile);
          normalized.imageData = uploaded.path;
        }
        imported.push(normalized);
      }

      if (!imported.length) {
        showToast('No valid entries found in the JSON file.', 'error');
        return;
      }

      setEntries((current) => [...current, ...imported]);
      setCategories((current) => reconcileCategories([...entries, ...imported], current));
      showToast(`Imported ${imported.length} entries into project storage.`, 'success');
    } catch (error) {
      showToast(`Failed to import JSON: ${error.message}`, 'error');
    }
  };

  const imageFileToEditor = async (file) => {
    try {
      const uploaded = await uploadBestiaryImage(file);
      openAdd({
        name: file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
        species: 'Imported',
        imageData: uploaded.path,
      });
      showToast(`Image copied into project storage: ${file.name}`, 'success');
    } catch (error) {
      showToast(`Failed to save image: ${error.message}`, 'error');
    }
  };

  const handleFiles = (files) => {
    [...files].forEach((file) => {
      if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
        importJSONFile(file);
      } else if (file.type.startsWith('image/')) {
        imageFileToEditor(file);
      } else {
        showToast(`Unsupported file: ${file.name}`, 'error');
      }
    });
  };

  const backupProjectStorage = async () => {
    try {
      await createStorageBackup();
      showToast('Backup created in storage/backups.', 'success');
    } catch (error) {
      showToast(`Backup failed: ${error.message}`, 'error');
    }
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      showToast('Please enter a species name.', 'error');
      return;
    }
    if (categories.some((category) => category.name === name)) {
      showToast(`Species "${name}" already exists.`, 'error');
      return;
    }
    setCategories((current) => [...current, { name, color: newCategoryColor }]);
    setNewCategoryName('');
    showToast(`Species "${name}" added.`, 'success');
  };

  const removeCategory = (name) => {
    const count = entries.filter((entry) => entry.species === name).length;
    if (count) return;
    setCategories((current) => current.filter((category) => category.name !== name));
    if (selectedCategory === name) setSelectedCategory('all');
  };

  const managerCategories = useMemo(() => {
    const rank = new Map(SPECIES_ORDER.map((name, index) => [name, index]));
    return [...categories].sort((a, b) => {
      const aRank = rank.has(a.name) ? rank.get(a.name) : 999;
      const bRank = rank.has(b.name) ? rank.get(b.name) : 999;
      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  if (!storageReady) {
    return (
      <div className="storage-gate">
        <div className="storage-gate-card">
          <i className={`fas ${storageError ? 'fa-triangle-exclamation' : 'fa-hard-drive'}`} />
          <h1>{storageError ? 'Project storage unavailable' : 'Loading WTLO Bestiary'}</h1>
          <p>
            {storageError
              ? storageError
              : 'Connecting to the machine-local JSON database and image folder...'}
          </p>
          {storageError && (
            <p className="storage-gate-hint">Run the project with <code>npm run dev</code>, then reload this page. The Bestiary does not fall back to browser local storage.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="header-brand">
          <div
            className="brand-icon"
            title="Refresh the library"
            onClick={() => window.location.reload()}
          >
            <img src="/other%20assets/BossSkull.png" alt="Bestiary logo" />
          </div>
          <h1>WTLO Bestiary</h1>
        </div>
        <div className="header-actions">
          <span className="badge-count">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
          <span className={`badge-count ${storageReady ? '' : 'storage-offline'}`} title="Project file storage status">
            <i className={`fas ${storageReady ? 'fa-hard-drive' : 'fa-triangle-exclamation'}`} /> {storageReady ? 'File storage' : 'Storage unavailable'}
          </span>
          <button className="btn btn-gold btn-sm" onClick={() => openAdd()} type="button">
            <i className="fas fa-plus" /> <span>Add</span>
          </button>
          <button className="btn btn-sm" onClick={() => importRef.current?.click()} type="button" title="Import JSON">
            <i className="fas fa-file-import" />
          </button>
          <button className="btn btn-sm" onClick={exportJSON} type="button" title="Export JSON">
            <i className="fas fa-file-export" />
          </button>
          <button className="btn btn-sm" onClick={backupProjectStorage} type="button" title="Backup project storage">
            <i className="fas fa-box-archive" />
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importJSONFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="app-layout">
        <aside className="app-sidebar">
          <div className="sidebar-section">
            <div className="search-field">
              <span className="search-icon"><i className="fas fa-search" /></span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search monsters..."
              />
              <button
                className={`clear-search ${search ? '' : 'hidden'}`}
                onClick={() => setSearch('')}
                type="button"
              >
                <i className="fas fa-times-circle" />
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label"><span><i className="fas fa-book" style={{ marginRight: 6 }} />Library</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 12px' }}>
              Browse your collection
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">
              <span><i className="fas fa-tags" style={{ marginRight: 6 }} />Species</span>
              <button className="action-link" onClick={() => setCategoryManagerOpen(true)} type="button">
                <i className="fas fa-cog" /> Manage
              </button>
            </div>
            <ul className="category-list">
              <li
                className={selectedCategory === 'all' ? 'active' : ''}
                onClick={() => setSelectedCategory('all')}
              >
                <span className="cat-dot" style={{ background: 'var(--accent-gold)' }} />
                <span className="cat-name">All</span>
                <span className="cat-count">{entries.length}</span>
              </li>
              {categoryNames.map((name) => {
                const count = entries.filter((entry) => entry.species === name).length;
                return (
                  <li
                    key={name}
                    className={selectedCategory === name ? 'active' : ''}
                    onClick={() => setSelectedCategory(name)}
                  >
                    <span className="cat-dot" style={{ background: categoryColor(name) }} />
                    <span className="cat-name">{name}</span>
                    <span className="cat-count">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="sidebar-section">
            <div className="section-label"><span><i className="fas fa-sliders-h" style={{ marginRight: 6 }} />Filters</span></div>
            <div className="filter-group">
              <label className="filter-chip"><input type="checkbox" checked={filterHasImage} onChange={(e) => setFilterHasImage(e.target.checked)} /><span className="chip-label">Has Image</span></label>
              <label className="filter-chip"><input type="checkbox" checked={filterHasTraits} onChange={(e) => setFilterHasTraits(e.target.checked)} /><span className="chip-label">Has Traits</span></label>
              <label className="filter-chip"><input type="checkbox" checked={filterHasDescription} onChange={(e) => setFilterHasDescription(e.target.checked)} /><span className="chip-label">Has Description</span></label>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label"><span><i className="fas fa-arrow-up-wide-short" style={{ marginRight: 6 }} />Sort</span></div>
            <select className="sort-select" value={sortValue} onChange={(event) => setSortValue(event.target.value)}>
              <option value="name">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="category">Species</option>
              <option value="recent">Recently Added</option>
              <option value="danger">Danger Level</option>
            </select>
          </div>

          <div className="sidebar-section">
            <div className="section-label"><span><i className="fas fa-cloud-upload-alt" style={{ marginRight: 6 }} />Upload</span></div>
            <div
              className="upload-zone"
              onClick={() => sidebarFileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFiles(event.dataTransfer.files);
              }}
            >
              <div className="upload-icon"><i className="fas fa-image" /></div>
              <div className="upload-text">Drop image or JSON</div>
              <div className="upload-hint">.png · .jpg · .json</div>
              <input
                ref={sidebarFileRef}
                type="file"
                accept=".json,.png,.jpg,.jpeg,.gif,.webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) handleFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="content-toolbar">
            <div className="toolbar-info">Showing <strong>{filteredEntries.length}</strong> · <strong>{entries.length}</strong> total</div>
            <div className="toolbar-actions">
              <div className="view-toggle">
                <button className={currentView === 'grid' ? 'active' : ''} onClick={() => setCurrentView('grid')} title="Grid" type="button"><i className="fas fa-th" /></button>
                <button className={currentView === 'list' ? 'active' : ''} onClick={() => setCurrentView('list')} title="List" type="button"><i className="fas fa-list" /></button>
              </div>
              <button className="btn btn-sm btn-danger" onClick={clearAllEntries} type="button" title="Delete all"><i className="fas fa-trash" /></button>
            </div>
          </div>

          {filteredEntries.length ? (
            <div className={`entries-grid ${currentView === 'list' ? 'list-view' : ''}`}>
              {filteredEntries.map((entry) => (
                <article className="entry-card" key={entry.id} onClick={() => setDetailEntryId(entry.id)}>
                  <div className="card-media"><ImageView entry={entry} /></div>
                  <div className="card-body">
                    <div className="entry-name">{entry.name}</div>
                    <span className="entry-category">
                      <span className="cat-dot-sm" style={{ background: categoryColor(entry.species) }} />
                      {entry.species || 'Uncategorized'}
                    </span>
                    {entry.description && <div className="entry-description">{entry.description}</div>}
                    {entry.traits?.length > 0 && (
                      <div className="entry-traits">
                        {entry.traits.map((trait, index) => <span className="trait-pill" key={`${trait}-${index}`}>{trait}</span>)}
                      </div>
                    )}
                    <div className="entry-meta">
                      {entry.habitat && <span className="meta-item"><i className="fas fa-map-pin" /> {entry.habitat}</span>}
                      {entry.rarity && <span className="meta-item"><i className="fas fa-gem" /> {entry.rarity}</span>}
                      {entry.danger > 0 && <span className="meta-item">{'⭐'.repeat(Math.min(entry.danger, 5))}</span>}
                    </div>
                  </div>
                  <div className="card-footer">
                    <button className="btn btn-sm btn-primary" onClick={(event) => { event.stopPropagation(); openEdit(entry); }} type="button"><i className="fas fa-edit" /></button>
                    <button className="btn btn-sm btn-danger" onClick={(event) => { event.stopPropagation(); deleteEntry(entry.id); }} type="button"><i className="fas fa-trash" /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-scroll" /></div>
              <h3>{entries.length ? 'No matching monsters' : 'Your bestiary awaits'}</h3>
              <p>{entries.length ? 'Change the search or filters to see more entries.' : 'Add your first creature or import a JSON file. The empty state is preserved in the project data file after restart.'}</p>
              <div className="empty-actions">
                <button className="btn btn-gold" onClick={() => openAdd()} type="button"><i className="fas fa-plus" /> Add Entry</button>
                <button className="btn" onClick={() => importRef.current?.click()} type="button"><i className="fas fa-file-import" /> Import JSON</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <Modal open={Boolean(detailEntry)} onBackdrop={() => setDetailEntryId(null)}>
        {detailEntry && (
          <div className="modal detail-modal">
            <div className="modal-header">
              <h2>{detailEntry.name}</h2>
              <button className="close-btn" onClick={() => setDetailEntryId(null)} type="button">&times;</button>
            </div>
            <div className="modal-body">
              {getMonsterImage(detailEntry) && <ImageView entry={detailEntry} className="detail-image" placeholderClassName="hidden" />}
              <div className="detail-grid">
                <div className="detail-item"><span className="label">Species</span><span className="value">{detailEntry.species || '—'}</span></div>
                <div className="detail-item"><span className="label">Rarity</span><span className="value">{detailEntry.rarity || '—'}</span></div>
                <div className="detail-item"><span className="label">Danger Level</span><span className="value">{'⭐'.repeat(Math.min(detailEntry.danger || 0, 5)) || '—'}</span></div>
                <div className="detail-item"><span className="label">Habitat</span><span className="value">{detailEntry.habitat || '—'}</span></div>
                <div className="detail-item"><span className="label">Health</span><span className="value">{detailEntry.health}</span></div>
                <div className="detail-item"><span className="label">Health / Level</span><span className="value">{detailEntry.healthPerLevel ?? 0}</span></div>
                <div className="detail-item"><span className="label">Level Range</span><span className="value">{detailEntry.minLevel} – {detailEntry.maxLevel}</span></div>
                <div className="detail-item"><span className="label">Damage</span><span className="value">{detailEntry.minDmg} – {detailEntry.maxDmg}</span></div>
                {detailEntry.effects && <div className="detail-item" style={{ gridColumn: '1 / -1' }}><span className="label">Effects</span><span className="value">{detailEntry.effects}</span></div>}
              </div>
              {detailEntry.description && (
                <div style={{ marginTop: 8 }}>
                  <span className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)' }}>Description</span>
                  <div style={{ marginTop: 2, color: 'var(--text-secondary)' }}>{detailEntry.description}</div>
                </div>
              )}
              {detailEntry.traits?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span className="label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)' }}>Traits</span>
                  <div className="detail-traits">{detailEntry.traits.map((trait, index) => <span className="trait-pill" key={`${trait}-${index}`}>{trait}</span>)}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setDetailEntryId(null); openEdit(detailEntry); }} type="button"><i className="fas fa-edit" /> Edit</button>
              <button className="btn btn-gold" onClick={() => setDetailEntryId(null)} type="button">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editor)} onBackdrop={closeEditor}>
        {editor && (
          <div className="modal">
            <div className="modal-header">
              <h2>{editor.mode === 'edit' ? 'Edit Entry' : 'Add Entry'}</h2>
              <button className="close-btn" onClick={closeEditor} type="button">&times;</button>
            </div>
            <div className="modal-body">
              <form autoComplete="off" onSubmit={(event) => { event.preventDefault(); saveEditor(); }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name <span className="required">*</span></label>
                    <input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Frost Wyrm" required />
                  </div>
                  <div className="form-group">
                    <label>Species <span className="required">*</span></label>
                    <input value={editor.species} onChange={(e) => setEditor({ ...editor, species: e.target.value })} placeholder="e.g. Dragon" list="categoryDatalist" required />
                    <datalist id="categoryDatalist">
                      {categories.map((category) => <option value={category.name} key={category.name} />)}
                    </datalist>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Health</label>
                    <input type="number" min="0" step="any" value={editor.health} onChange={(e) => setEditor({ ...editor, health: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Health / Level</label>
                    <input type="number" min="0" step="any" value={editor.healthPerLevel} onChange={(e) => setEditor({ ...editor, healthPerLevel: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Min Level</label>
                    <input type="number" min="1" step="1" value={editor.minLevel} onChange={(e) => setEditor({ ...editor, minLevel: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Max Level</label>
                    <input type="number" min="1" step="1" value={editor.maxLevel} onChange={(e) => setEditor({ ...editor, maxLevel: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Min Damage</label>
                    <input type="number" min="0" step="any" value={editor.minDmg} onChange={(e) => setEditor({ ...editor, minDmg: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Max Damage</label>
                    <input type="number" min="0" step="any" value={editor.maxDmg} onChange={(e) => setEditor({ ...editor, maxDmg: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Effects</label>
                  <input value={editor.effects} onChange={(e) => setEditor({ ...editor, effects: e.target.value })} placeholder="e.g. Poison 3.0-7.0 (15.0%)" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} placeholder="Describe the creature..." rows="3" />
                </div>
                <div className="form-group">
                  <label>Traits</label>
                  <input value={editor.traits} onChange={(e) => setEditor({ ...editor, traits: e.target.value })} placeholder="e.g. Frost, Flying, Intelligent" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Habitat</label>
                    <input value={editor.habitat} onChange={(e) => setEditor({ ...editor, habitat: e.target.value })} placeholder="e.g. Frozen Mountains" />
                  </div>
                  <div className="form-group">
                    <label>Rarity</label>
                    <select value={editor.rarity} onChange={(e) => setEditor({ ...editor, rarity: e.target.value })}>
                      <option value="Common">Common</option>
                      <option value="Uncommon">Uncommon</option>
                      <option value="Rare">Rare</option>
                      <option value="Epic">Epic</option>
                      <option value="Legendary">Legendary</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Danger Level</label>
                    <select value={editor.danger} onChange={(e) => setEditor({ ...editor, danger: e.target.value })}>
                      <option value="1">1 · Minimal</option>
                      <option value="2">2 · Low</option>
                      <option value="3">3 · Moderate</option>
                      <option value="4">4 · High</option>
                      <option value="5">5 · Extreme</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <div className="file-wrapper">
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.gif,.webp"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          if (!file) return;

                          try {
                            const uploaded = await uploadBestiaryImage(file);
                            setEditor((current) => {
                              if (
                                current
                                && current.imageData !== current.originalImageData
                                && isProjectUploadedImage(current.imageData)
                              ) {
                                deleteBestiaryImage(current.imageData).catch(() => undefined);
                              }
                              return current ? { ...current, imageData: uploaded.path } : current;
                            });
                            showToast(`Image saved to project folder: ${file.name}`, 'success');
                          } catch (error) {
                            showToast(`Failed to save image: ${error.message}`, 'error');
                          }
                        }}
                      />
                      {getMonsterImage({ name: editor.name, imageData: editor.imageData }) && (
                        <img className="preview-thumb" src={getMonsterImage({ name: editor.name, imageData: editor.imageData })} alt="preview" />
                      )}
                      {editor.imageData && (
                        <button className="btn btn-sm btn-danger" onClick={removeEditorImage} type="button"><i className="fas fa-times" /></button>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeEditor} type="button">Cancel</button>
              <button className="btn btn-gold" onClick={saveEditor} type="button"><i className="fas fa-save" /> Save</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={categoryManagerOpen} onBackdrop={() => setCategoryManagerOpen(false)}>
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h2><i className="fas fa-tags" style={{ marginRight: 10, color: 'var(--accent-gold)' }} />Manage Species</h2>
            <button className="close-btn" onClick={() => setCategoryManagerOpen(false)} type="button">&times;</button>
          </div>
          <div className="modal-body">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Species with entries cannot be deleted.</div>
            <div className="category-manager-list">
              {managerCategories.map((category) => {
                const count = entries.filter((entry) => entry.species === category.name).length;
                return (
                  <div className="category-manager-item" key={category.name}>
                    <input
                      type="color"
                      className="cm-color"
                      value={category.color}
                      onChange={(event) => setCategories((current) => current.map((item) => item.name === category.name ? { ...item, color: event.target.value } : item))}
                      title="Change color"
                    />
                    <span className="cm-name">{category.name}</span>
                    <span className="cm-count">{count} {count === 1 ? 'entry' : 'entries'}</span>
                    <span className="cm-actions">
                      <button disabled={count > 0} onClick={() => removeCategory(category.name)} title={count > 0 ? 'Cannot delete — in use' : 'Delete'} type="button"><i className="fas fa-trash" /></button>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="category-manager-add">
              <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addCategory(); }} placeholder="New species name..." />
              <div className="color-picker-wrapper"><input type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} /></div>
              <button className="btn btn-gold btn-sm" onClick={addCategory} type="button"><i className="fas fa-plus" /></button>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}><i className="fas fa-info-circle" /> Colors and empty custom species are saved in the project data file too.</div>
          </div>
          <div className="modal-footer"><button className="btn btn-gold" onClick={() => setCategoryManagerOpen(false)} type="button">Done</button></div>
        </div>
      </Modal>

      <Toasts toasts={toasts} dismiss={dismissToast} />
    </>
  );
}
