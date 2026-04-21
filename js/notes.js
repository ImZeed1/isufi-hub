import { supabase, getCurrentUser } from './supabase-config.js';

// Stato globale del modulo (accessibile da tutte le funzioni in questo file)
let savedNoteIds = [];
let currentUserId = null;

// Badge color per tipo
export const getTypeColorClass = (type) => {
  if (!type) return 'badge-type-zip';
  switch (type.toLowerCase()) {
    case 'appunti': return 'badge-type-pdf';
    case 'riassunto': return 'badge-type-docx';
    case 'esercizi': return 'badge-type-zip';
    case 'slides': return 'badge-type-pptx';
    default: return 'badge-type-zip';
  }
};

// Toggle preferiti
export const toggleSaveNote = async (e, noteId) => {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  if (!noteId) {
    console.error("DEBUG: noteId mancante in toggleSaveNote");
    return;
  }
  const idStr = String(noteId);

  const user = await getCurrentUser();
  if (!user) {
    window.Toast.warning("Devi accedere per salvare gli appunti nei preferiti.");
    setTimeout(() => window.location.href = 'login.html', 1500);
    return;
  }

  // Identifica il pulsante: cerchiamo in e.currentTarget, poi per data-id, poi per ID fisso (dettaglio)
  let btn = (e && e.currentTarget && e.currentTarget.tagName === 'BUTTON') ? e.currentTarget : null;
  if (!btn) {
    btn = document.querySelector(`.save-btn[data-note-id="${idStr}"]`) || 
          document.getElementById('detail-save-btn');
  }

  const icon = btn ? btn.querySelector('i, svg') : null;
  const isCurrentlySaved = btn ? btn.classList.contains('saved') : savedNoteIds.includes(idStr);

  console.log(`DEBUG: Toggling note ${idStr}. User: ${user.id}. Currently saved (UI state): ${isCurrentlySaved}`);

  // Optimistic UI update
  if (btn) {
    btn.classList.toggle('saved', !isCurrentlySaved);
    if (icon) {
      icon.setAttribute('fill', !isCurrentlySaved ? 'var(--accent-alt)' : 'none');
      icon.style.color = !isCurrentlySaved ? 'var(--accent-alt)' : 'var(--text-muted)';
    }
  }

  try {
    if (isCurrentlySaved) {
      // RIMOZIONE
      const { error } = await supabase
        .from('saved_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('note_id', noteId);
      
      if (error) throw error;
      
      savedNoteIds = savedNoteIds.filter(id => id !== idStr);
      window.Toast.info("Rimosso dai preferiti");
    } else {
      // AGGIUNTA
      const { error } = await supabase
        .from('saved_notes')
        .insert([{ user_id: user.id, note_id: noteId }]);
      
      if (error) {
        if (error.code === '23505') { // Duplicate key
          console.warn("Nota già presente nei preferiti (DB)");
        } else {
          throw error;
        }
      }
      
      if (!savedNoteIds.includes(idStr)) {
        savedNoteIds.push(idStr);
      }
      window.Toast.success("Salvato nei preferiti!");
    }
  } catch (err) {
    console.error("ERRORE toggleSaveNote:", err);
    // Revert on error
    if (btn) {
      btn.classList.toggle('saved', isCurrentlySaved);
      if (icon) {
        icon.setAttribute('fill', isCurrentlySaved ? 'var(--accent-alt)' : 'none');
        icon.style.color = isCurrentlySaved ? 'var(--accent-alt)' : 'var(--text-muted)';
      }
    }
    window.Toast.error("Errore nel salvataggio: " + (err.message || "Riprova."));
  }
};
window.toggleSaveNote = toggleSaveNote;

// Modifica titolo
window.editNote = async (e, noteId, currentTitle) => {
  e.preventDefault();
  e.stopPropagation();

  const newTitle = prompt("Modifica il titolo dell'appunto:", currentTitle);
  if (!newTitle || newTitle.trim() === "" || newTitle === currentTitle) return;

  const { error } = await supabase.from('notes').update({ title: newTitle.trim() }).eq('id', noteId);
  if (error) {
    window.Toast.error("Errore durante la modifica: " + error.message);
  } else {
    window.Toast.success("Titolo aggiornato!");
    setTimeout(() => window.location.reload(), 800);
  }
};

// Elimina nota
window.deleteNote = async (e, noteId, fileUrl) => {
  e.preventDefault();
  e.stopPropagation();

  if (!confirm("Sei sicuro di voler eliminare definitivamente questo appunto?")) return;

  try {
    const urlParts = fileUrl.split('/note-files/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      await supabase.storage.from('note-files').remove([filePath]);
    }
  } catch (err) {
    console.warn("File fisico non rimosso:", err);
  }

  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) {
    window.Toast.error("Errore durante l'eliminazione: " + error.message);
  } else {
    window.Toast.success("Appunto eliminato.");
    setTimeout(() => window.location.reload(), 800);
  }
};

// Traccia download
export const trackDownload = async (e, noteId) => {
  // Non blocchiamo il click, lasciamo aprire il link
  try {
    // Increment download counter via RPC or manual update
    const { data: note } = await supabase.from('notes').select('downloads').eq('id', noteId).single();
    if (note) {
      await supabase.from('notes').update({ downloads: (note.downloads || 0) + 1 }).eq('id', noteId);
    }
  } catch (err) {
    console.warn("Download tracking failed:", err);
  }
};

// Skeleton loading
const createSkeletonCards = (count = 6) => {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="note-card" style="opacity: 0.6;">
        <div class="skeleton skeleton-text wide" style="height:20px;margin-bottom:12px;"></div>
        <div class="skeleton skeleton-text medium" style="height:14px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:6px;margin-top:16px;">
          <div class="skeleton" style="width:60px;height:22px;border-radius:999px;"></div>
          <div class="skeleton" style="width:50px;height:22px;border-radius:999px;"></div>
        </div>
        <div style="margin-top:auto;padding-top:20px;">
          <div class="skeleton" style="height:40px;border-radius:8px;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-light);">
          <div class="skeleton skeleton-text short" style="height:12px;"></div>
          <div class="skeleton skeleton-text short" style="height:12px;width:30%;"></div>
        </div>
      </div>`;
  }
  return html;
};

// Genera la card
export const createNoteCard = (note, overrideSavedIds, overrideUserId) => {
  const card = document.createElement('div');
  card.className = 'note-card fade-up';
  card.setAttribute('data-area', note.area);

  const activeSavedIds = overrideSavedIds || savedNoteIds;
  const activeUserId = overrideUserId || currentUserId;

  const isSaved = activeSavedIds.includes(String(note.id));
  const saveClass = isSaved ? 'saved' : '';
  const saveIconFill = isSaved ? 'var(--accent-alt)' : 'none';
  const saveIconColor = isSaved ? 'var(--accent-alt)' : 'var(--text-muted)';

  const tagsHtml = (note.tags || []).map(tag =>
    `<span class="badge">#${tag}</span>`
  ).join('');

  const isUploader = activeUserId === note.uploader_id;
  let adminActionsHtml = '';

  if (isUploader) {
    const safeTitle = note.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    adminActionsHtml = `
      <div style="display:flex;gap:8px;margin-top:14px;border-top:1px dashed var(--border);padding-top:14px;">
        <button onclick="editNote(event, '${note.id}', '${safeTitle}')" class="btn btn-secondary btn-sm" style="flex:1;">
          <i data-lucide="edit-2" style="width:14px;height:14px;"></i> Rinomina
        </button>
        <button onclick="deleteNote(event, '${note.id}', '${note.file_url}')" class="btn btn-secondary btn-sm" style="flex:1;color:#EF4444;border-color:rgba(239,68,68,0.3);">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Elimina
        </button>
      </div>
    `;
  }

  // Format date
  const dateStr = new Date(note.created_at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const hasToc = note.table_of_contents && note.table_of_contents.trim() !== "";
  const isBundle = !!note.bundle_id;

    // Rating display
    const ratingDisplay = note.rating && note.rating > 0
      ? `<i data-lucide="star" style="width:14px;height:14px;color:var(--accent-alt);fill:var(--accent-alt);"></i> ${parseFloat(note.rating).toFixed(1)}`
      : `<i data-lucide="star" style="width:14px;height:14px;color:var(--text-light);"></i> N.A.`;

    card.innerHTML = `
    <div class="card-header">
      <div class="card-title-wrap">
        <div class="card-title">${isBundle ? note.title.split(' (Parte')[0] : note.title}</div>
        <div class="card-subject">${note.subject}</div>
        <div class="small" style="margin-top:4px;color:var(--text-muted);">
          <i data-lucide="user-check" style="width:12px;height:12px;vertical-align:middle;"></i> ${note.professor || 'Prof. non indicato'} 
          &middot; <i data-lucide="history" style="width:12px;height:12px;vertical-align:middle;"></i> ${note.academic_year || 'A.A. N.D.'}
        </div>
      </div>
      <button class="save-btn ${saveClass}" data-note-id="${note.id}" onclick="toggleSaveNote(event, '${note.id}')" title="Salva nei preferiti">
        <i data-lucide="bookmark" style="width:20px;height:20px;color:${saveIconColor};" fill="${saveIconFill}"></i>
      </button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
      <span class="badge ${getTypeColorClass(note.type)}">${note.type}</span>
      ${isBundle ? `<span class="badge" style="background:var(--accent-soft); color:var(--accent-alt); border-color:var(--accent-alt);"><i data-lucide="layers" style="width:12px;height:12px;vertical-align:middle;"></i> PACCHETTO (${note.bundle_count} file)</span>` : ''}
      ${hasToc && !isBundle ? '<span class="badge" style="border-color:var(--accent-alt);color:var(--accent-alt);background:var(--accent-glow);">+ Indice</span>' : ''}
    </div>
    <div class="card-tags">${tagsHtml}</div>

    <div style="margin-top:20px;">
      <a href="note-detail.html?id=${note.id}" class="btn btn-primary" style="width:100%;display:flex;justify-content:center;padding:10px;">
        <i data-lucide="eye" style="width:16px;height:16px;"></i> ${isBundle ? 'Apri Pacchetto' : 'Visualizza Dettagli'}
      </a>
    </div>

    ${adminActionsHtml}

    <div class="card-footer" style="${isUploader ? 'margin-top:14px;' : ''}">
      <div class="card-meta-left">
        <span class="meta-item"><i data-lucide="user" style="width:14px;height:14px;"></i> ${note.uploader_name}</span>
        <span class="meta-item"><i data-lucide="calendar" style="width:14px;height:14px;"></i> ${dateStr}</span>
      </div>
      <div class="card-meta-right">
        <span class="meta-item"><i data-lucide="download" style="width:14px;height:14px;"></i> ${note.downloads || 0}</span>
        <span class="meta-item">${ratingDisplay}</span>
      </div>
    </div>
  `;
  return card;
};

// Renderizza note in un container
export const renderNotes = (notes, containerId, overrideSavedIds, overrideUserId) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (notes.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i data-lucide="file-x" class="empty-state-icon"></i>
        <p>Nessun appunto trovato.</p>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  notes.forEach((note, index) => {
    const card = createNoteCard(note, overrideSavedIds, overrideUserId);
    container.appendChild(card);
    setTimeout(() => card.classList.add('visible'), 30 + (index * 50));
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ============================================
// INIT
// ============================================
const initNotes = async () => {
  const user = await getCurrentUser();
  
  // Resetta stato per sicurezza
  savedNoteIds = [];
  currentUserId = null;

  if (user) {
    currentUserId = user.id;
    const { data: saved } = await supabase.from('saved_notes').select('note_id').eq('user_id', user.id);
    if (saved) savedNoteIds = saved.map(s => String(s.note_id));
  }

  const recentContainer = document.getElementById('recent-notes-container');
  const notesGridContainer = document.getElementById('notes-grid');

  if (recentContainer) recentContainer.innerHTML = createSkeletonCards(6);
  if (notesGridContainer) notesGridContainer.innerHTML = createSkeletonCards(6);

  // Fetch notes
  const { data: allNotesRaw, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
  
  if (error) {
    window.Toast.error("Errore nel caricamento degli appunti.");
    console.error(error);
    return;
  }

  const processNotes = (rawNotes) => {
    const bundles = {};
    const processed = [];
    rawNotes.forEach(note => {
      if (!note.bundle_id) {
        processed.push({ ...note, bundle_count: 1 });
      } else {
        if (!bundles[note.bundle_id]) {
          bundles[note.bundle_id] = { ...note, bundle_count: 1 };
          processed.push(bundles[note.bundle_id]);
        } else {
          bundles[note.bundle_id].bundle_count++;
        }
      }
    });
    return processed;
  };

  const allNotes = processNotes(allNotesRaw || []);
  let currentNotes = allNotes;

  // HOME: recent notes
  if (recentContainer) {
    renderNotes(currentNotes.slice(0, 6), 'recent-notes-container');
    
    // Caricamento statistiche reali per la homepage
    const loadDynamicStats = async () => {
      const notesCountEl = document.getElementById('stat-notes-count');
      const areasCountEl = document.getElementById('stat-areas-count');
      const usersCountEl = document.getElementById('stat-users-count');

      if (!notesCountEl && !areasCountEl && !usersCountEl) return;

      try {
        // 1. Conteggio appunti
        const { count: notesCount } = await supabase.from('notes').select('*', { count: 'exact', head: true });
        
        // 2. Conteggio utenti (profili)
        const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

        // 3. Conteggio aree (usiamo quelle uniche presenti nelle note o 3 se vuoto)
        const { data: areasData } = await supabase.from('notes').select('area');
        const uniqueAreas = new Set(areasData ? areasData.map(n => n.area) : []);
        const areasCount = Math.max(uniqueAreas.size, 3); // Almeno le 3 aree principali

        if (notesCountEl) {
          notesCountEl.setAttribute('data-count', notesCount || 0);
          if (window.animateCounter) window.animateCounter(notesCountEl);
        }
        if (usersCountEl) {
          usersCountEl.setAttribute('data-count', usersCount || 0);
          if (window.animateCounter) window.animateCounter(usersCountEl);
        }
        if (areasCountEl) {
          areasCountEl.setAttribute('data-count', areasCount);
          if (window.animateCounter) window.animateCounter(areasCountEl);
        }
      } catch (err) {
        console.error("Errore nel caricamento delle statistiche:", err);
      }
    };
    
    loadDynamicStats();

    // Caricamento Leaderboard (Top Contributors)
    const loadLeaderboard = async () => {
      const container = document.getElementById('leaderboard-container');
      if (!container) return;

      try {
        // Recuperiamo tutti gli appunti per calcolare le statistiche per utente
        const { data: notesData, error } = await supabase.from('notes').select('uploader_id, uploader_name, downloads, rating');
        if (error) throw error;

        const contributors = {};
        notesData.forEach(note => {
          if (!contributors[note.uploader_id]) {
            contributors[note.uploader_id] = {
              name: note.uploader_name,
              count: 0,
              downloads: 0,
              points: 0
            };
          }
          contributors[note.uploader_id].count++;
          contributors[note.uploader_id].downloads += (note.downloads || 0);
          // Calcolo punti: 10 per ogni appunto, 1 per ogni download
          contributors[note.uploader_id].points = (contributors[note.uploader_id].count * 10) + contributors[note.uploader_id].downloads;
        });

        // Convertiamo in array e ordiniamo per punti
        const leaderboard = Object.values(contributors).sort((a, b) => b.points - a.points).slice(0, 5);

        if (leaderboard.length === 0) {
          container.innerHTML = '<p class="small text-center" style="grid-column:1/-1;">Nessun contributo ancora.</p>';
          return;
        }

        container.innerHTML = leaderboard.map((user, index) => `
          <div class="fade-up visible" style="background:var(--bg-card); padding:24px; border-radius:var(--radius-md); border:1px solid var(--border); display:flex; flex-direction:column; align-items:center; text-align:center; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='none'">
            <div style="width:50px; height:50px; border-radius:999px; background:var(--accent-glow); color:var(--accent-alt); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.25rem; margin-bottom:16px; border:2px solid var(--accent-alt);">
              ${index + 1}
            </div>
            <h4 style="margin-bottom:4px;">${user.name}</h4>
            <p class="small" style="color:var(--text-muted); margin-bottom:16px;">Top Contributor</p>
            <div style="display:flex; gap:16px; border-top:1px solid var(--border-light); padding-top:16px; width:100%; justify-content:center;">
              <div>
                <div style="font-weight:700; color:var(--text);">${user.count}</div>
                <div class="small" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em;">Appunti</div>
              </div>
              <div>
                <div style="font-weight:700; color:var(--text);">${user.downloads}</div>
                <div class="small" style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em;">Download</div>
              </div>
            </div>
          </div>
        `).join('');
        
        if (typeof lucide !== 'undefined') lucide.createIcons();

      } catch (err) {
        console.error("Errore Leaderboard:", err);
        container.innerHTML = '<p class="small">Impossibile caricare la classifica.</p>';
      }
    };

    loadLeaderboard();
  }

  // LIBRERIA: filtri + ordinamento + ricerca
  if (notesGridContainer) {
    renderNotes(currentNotes, 'notes-grid');

    // Counter
    const countEl = document.getElementById('notes-count');
    if (countEl) countEl.textContent = currentNotes.length;

    // Sort
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'recenti') {
          currentNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (value === 'scaricati') {
          currentNotes.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        } else if (value === 'votati') {
          currentNotes.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
        renderNotes(currentNotes, 'notes-grid');
        if (countEl) countEl.textContent = currentNotes.length;
      });
    }

    // Filters
    const filterSelects = document.querySelectorAll('.filter-select');
    const professorFilterInput = document.getElementById('filter-professor');

    const applyFilters = () => {
      const areaFilter = document.getElementById('filter-area').value;
      const yearFilter = document.getElementById('filter-year').value;
      const typeFilter = document.getElementById('filter-type').value;
      const academicYearFilter = document.getElementById('filter-academic-year').value;
      const professorFilter = professorFilterInput ? professorFilterInput.value.trim().toLowerCase() : '';

      currentNotes = (allNotes || []).filter(note => {
        const matchesArea = (areaFilter === 'all' || note.area === areaFilter);
        const matchesYear = (yearFilter === 'all' || note.year.toString() === yearFilter);
        const matchesType = (typeFilter === 'all' || note.type === typeFilter);
        const matchesAcademicYear = (academicYearFilter === 'all' || note.academic_year === academicYearFilter);
        const matchesProfessor = (professorFilter === '' || (note.professor && note.professor.toLowerCase().includes(professorFilter)));

        return matchesArea && matchesYear && matchesType && matchesAcademicYear && matchesProfessor;
      });

      // Apply current search too
      const searchInput = document.getElementById('notes-search');
      if (searchInput && searchInput.value.trim()) {
        const query = searchInput.value.trim().toLowerCase();
        currentNotes = currentNotes.filter(note =>
          note.title.toLowerCase().includes(query) ||
          note.subject.toLowerCase().includes(query) ||
          note.area.toLowerCase().includes(query) ||
          (note.tags || []).some(t => t.toLowerCase().includes(query)) ||
          (note.description || '').toLowerCase().includes(query) ||
          (note.table_of_contents || '').toLowerCase().includes(query) ||
          (note.professor || '').toLowerCase().includes(query)
        );
      }

      sortSelect.dispatchEvent(new Event('change'));
    };

    filterSelects.forEach(select => {
      select.addEventListener('change', applyFilters);
    });

    if (professorFilterInput) {
      professorFilterInput.addEventListener('input', applyFilters);
    }

    // Live Search & Autocomplete
    const searchInput = document.getElementById('notes-search');
    if (searchInput) {
      const searchWrapper = searchInput.parentElement;
      const autocompleteDropdown = document.createElement('div');
      autocompleteDropdown.className = 'autocomplete-dropdown';
      searchWrapper.appendChild(autocompleteDropdown);

      let searchTimeout;

      const updateAutocomplete = (query) => {
        if (!query || query.length < 2) {
          autocompleteDropdown.classList.remove('open');
          return;
        }

        // Estrai materie e docenti univoci
        const subjects = [...new Set(allNotesRaw.map(n => n.subject))];
        const professors = [...new Set(allNotesRaw.map(n => n.professor).filter(Boolean))];

        const matches = [
          ...subjects.filter(s => s.toLowerCase().includes(query)).map(s => ({ label: s, type: 'Materia' })),
          ...professors.filter(p => p.toLowerCase().includes(query)).map(p => ({ label: p, type: 'Docente' }))
        ].slice(0, 6);

        if (matches.length > 0) {
          autocompleteDropdown.innerHTML = matches.map(m => `
            <div class="autocomplete-item" data-value="${m.label}">
              <div class="autocomplete-label">${m.label}</div>
              <div class="autocomplete-type">${m.type}</div>
            </div>
          `).join('');
          autocompleteDropdown.classList.add('open');

          autocompleteDropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.onclick = () => {
              searchInput.value = item.dataset.value;
              autocompleteDropdown.classList.remove('open');
              applyFilters();
            };
          });
        } else {
          autocompleteDropdown.classList.remove('open');
        }
      };

      searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        updateAutocomplete(query);
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 250);
      });

      // Chiudi cliccando fuori
      document.addEventListener('click', (e) => {
        if (!searchWrapper.contains(e.target)) autocompleteDropdown.classList.remove('open');
      });
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotes);
} else {
  initNotes();
}
