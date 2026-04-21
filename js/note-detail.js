import { supabase, getCurrentUser } from './supabase-config.js';

// Funzione locale per evitare dipendenze che potrebbero fallire
const getTypeColorClass = (type) => {
  if (!type) return 'badge-type-zip';
  switch (type.toLowerCase()) {
    case 'appunti': return 'badge-type-pdf';
    case 'riassunto': return 'badge-type-docx';
    case 'esercizi': return 'badge-type-zip';
    case 'slides': return 'badge-type-pptx';
    default: return 'badge-type-zip';
  }
};

const initNoteDetail = async () => {
  console.log("DEBUG: Avvio initNoteDetail...");
  const container = document.getElementById('note-detail-container');
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const noteId = urlParams.get('id');

    if (!noteId) {
      console.error("DEBUG: ID nota mancante nell'URL");
      container.innerHTML = '<div class="empty-state"><p>Appunto non trovato (ID mancante).</p><a href="notes.html" class="btn btn-secondary">Torna alla libreria</a></div>';
      return;
    }

    // 1. Carica utente e suo voto
    const user = await getCurrentUser();
    let userProfile = null;
    let userRating = 0;

    if (user) {
      const [{ data: profile }, { data: rating }] = await Promise.all([
        supabase.from('profiles').select('nickname').eq('id', user.id).single(),
        supabase.from('ratings').select('score').eq('note_id', noteId).eq('user_id', user.id).maybeSingle()
      ]);
      userProfile = profile;
      if (rating) userRating = rating.score;
    }

    // 2. Carica dettagli appunto
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      throw new Error("Appunto non trovato nel database.");
    }

    // 3. Carica commenti
    const { data: comments } = await supabase
      .from('comments')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: false });

    // 4. Carica Bundle
    let bundleFiles = [];
    if (note.bundle_id) {
      const { data: bundle } = await supabase
        .from('notes')
        .select('id, title, type, file_url')
        .eq('bundle_id', note.bundle_id);
      bundleFiles = bundle || [];
    }

    renderDetail(note, comments || [], bundleFiles, user, userProfile, userRating);

  } catch (err) {
    console.error("DEBUG: Errore fatale initNoteDetail:", err);
    container.innerHTML = `<div class="empty-state"><h2>Errore</h2><p>${err.message}</p><a href="notes.html" class="btn btn-secondary mt-24">Libreria</a></div>`;
  }
};

const renderDetail = (note, comments, bundleFiles, user, userProfile, userRating) => {
  const container = document.getElementById('note-detail-container');
  const dateStr = new Date(note.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const tagsHtml = (note.tags || []).map(tag => `<span class="badge">#${tag}</span>`).join('');
  const isPdf = note.file_url.toLowerCase().endsWith('.pdf');

  container.innerHTML = `
    <div class="fade-up visible">
      <div class="flex justify-between items-start mb-32 flex-wrap gap-16">
        <div style="flex: 1; min-width: 300px;">
          <div class="flex items-center gap-12 mb-12">
            <span class="badge ${getTypeColorClass(note.type)}">${note.type || 'Risorsa'}</span>
            ${note.bundle_id ? '<span class="badge" style="background:var(--accent-soft); color:var(--accent-alt); border-color:var(--accent-alt);">PACCHETTO</span>' : ''}
            <span class="small" style="color:var(--text-muted);"><i data-lucide="calendar" style="width:14px;height:14px;vertical-align:middle;"></i> ${dateStr}</span>
          </div>
          <h1 style="font-size: 2.5rem; margin-bottom: 12px;">${note.title}</h1>
          <p style="font-size: 1.125rem; font-weight: 500; color: var(--accent);"><i data-lucide="book-open" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;"></i> ${note.subject}</p>
        </div>
        <div class="flex gap-12">
          <button class="btn btn-secondary" id="detail-save-btn"><i data-lucide="bookmark" style="width:18px;height:18px;"></i> Salva</button>
          <a href="${note.file_url}" target="_blank" id="detail-download-btn" class="btn btn-primary"><i data-lucide="download" style="width:18px;height:18px;"></i> Scarica</a>
        </div>
      </div>

      <div class="note-detail-layout">
        <div class="note-detail-main">
          ${isPdf ? `<div class="pdf-preview-container">
            <div class="pdf-preview-header">
              <span class="small" style="font-weight:600;"><i data-lucide="eye" style="width:14px;height:14px;vertical-align:middle;"></i> Anteprima PDF</span>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pdf-frame').requestFullscreen()"><i data-lucide="maximize" style="width:14px;height:14px;"></i></button>
            </div>
            <iframe id="pdf-frame" src="${note.file_url}#toolbar=0" width="100%" height="600px" style="border:none;"></iframe>
          </div>` : ''}

          <div class="info-card">
            <h3 class="mb-16">Informazioni</h3>
            <div class="info-grid">
              <div><label class="small">Docente</label><div class="info-value">${note.professor || 'Non indicato'}</div></div>
              <div><label class="small">Anno Accademico</label><div class="info-value">${note.academic_year || 'N.D.'}</div></div>
              <div><label class="small">Anno Corso</label><div class="info-value">${note.year}° Anno</div></div>
              <div><label class="small">Caricato da</label><div class="info-value">${note.uploader_name}</div></div>
            </div>
            <div class="mb-32"><h4>Descrizione</h4><p style="white-space: pre-wrap;">${note.description || 'Nessuna descrizione.'}</p></div>
            ${note.table_of_contents ? `<div class="toc-container"><h4>Indice</h4><p style="white-space: pre-wrap; font-size:0.875rem;">${note.table_of_contents}</p></div>` : ''}
            <div class="mt-32"><h4>Tag</h4><div class="card-tags">${tagsHtml}</div></div>
          </div>

          <div id="comments-section" style="margin-top: 48px;">
            <h3 class="mb-24 flex items-center gap-12"><i data-lucide="message-square" style="width:24px;height:24px;color:var(--accent-alt);"></i> Discussioni (<span id="comments-count">${comments.length}</span>)</h3>
            <div id="comment-form-container" class="mb-40">
              ${user ? `<div class="comment-form-card">
                  <div class="form-group mb-16"><label class="form-label">Lascia un commento</label><textarea id="comment-content" class="form-textarea" placeholder="Scrivi qui..."></textarea></div>
                  <div class="flex justify-between items-center">
                    <label class="flex items-center gap-8" style="cursor:pointer;"><input type="checkbox" id="is-errata"> <span class="small">Segnala <strong>Errata Corrige</strong></span></label>
                    <button id="submit-comment" class="btn btn-primary">Invia</button>
                  </div>
                </div>` : `<div class="text-center auth-needed-card"><p class="small">Accedi per commentare.</p></div>`}
            </div>
            <div id="comments-list">${renderCommentsList(comments)}</div>
          </div>
        </div>

        <div class="note-detail-sidebar">
          <div class="sidebar-sticky">
            ${bundleFiles.length > 1 ? `<div class="sidebar-card">
                <h4 class="mb-16"><i data-lucide="layers" style="width:18px;height:18px;color:var(--accent-alt);"></i> Nel pacchetto</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${bundleFiles.map(bf => `<a href="note-detail.html?id=${bf.id}" class="bundle-item ${bf.id == note.id ? 'active' : ''}" style="display:block; padding:12px; border-radius:var(--radius-sm); border:1px solid ${bf.id == note.id ? 'var(--accent-alt)' : 'var(--border)'}; background:${bf.id == note.id ? 'var(--accent-glow)' : 'transparent'}; text-decoration:none; color:inherit;">
                      <div style="font-weight:600; font-size:0.8125rem;">${bf.title.split(' (Parte')[0]}</div>
                      <div class="small" style="font-size:0.75rem; color:var(--text-muted);">${bf.type}</div>
                    </a>`).join('')}
                </div>
              </div>` : ''}

            <div class="sidebar-card rating-card">
              <h4 class="mb-16">Valutazione Community</h4>
              <div id="avg-rating-display" class="rating-number">${note.rating > 0 ? parseFloat(note.rating).toFixed(1) : '--'}</div>
              <p class="small" id="rating-count-display" style="margin:8px 0 24px 0;">Basato su ${note.rating_count || 0} voti</p>
              
              <div class="star-rating justify-center mb-16" id="interactive-rating">
                ${[1, 2, 3, 4, 5].map(v => `<i data-lucide="star" class="star" data-value="${v}" style="cursor:pointer; width:28px; height:28px;"></i>`).join('')}
              </div>
              <p class="small" id="user-rating-msg" style="color:var(--accent-alt); font-weight:500;">${userRating > 0 ? 'Hai già votato questo appunto' : 'Clicca sulle stelle per votare'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
  setupEventListeners(note, user, userProfile, userRating);
};

const setupEventListeners = (note, user, userProfile, userRating) => {
  // Save/Download
  document.getElementById('detail-save-btn').onclick = (e) => window.toggleSaveNote?.(e, note.id);
  document.getElementById('detail-download-btn').onclick = (e) => window.trackDownload?.(e, note.id);

  // Comment Submit
  if (user) {
    document.getElementById('submit-comment')?.addEventListener('click', () => handleCommentSubmit(note, user, userProfile));
  }

  // Interactive Stars
  const starContainer = document.getElementById('interactive-rating');
  if (starContainer) {
    const stars = starContainer.querySelectorAll('.star');
    
    const updateStars = (val) => {
      stars.forEach(s => {
        const sVal = parseInt(s.dataset.value);
        if (sVal <= val) {
          s.style.fill = 'var(--accent-alt)';
          s.style.color = 'var(--accent-alt)';
        } else {
          s.style.fill = 'none';
          s.style.color = 'var(--text-muted)';
        }
      });
    };

    // Init stars visually
    updateStars(userRating);

    stars.forEach(star => {
      star.onmouseover = () => updateStars(parseInt(star.dataset.value));
      star.onmouseout = () => updateStars(userRating);
      star.onclick = async () => {
        if (!user) {
          window.Toast.warning("Accedi per votare!");
          return;
        }
        const val = parseInt(star.dataset.value);
        if (val === userRating) {
          // Rimuovi voto se clicchi sullo stesso
          await handleRemoveRate(note.id, user.id);
        } else {
          await handleRateNote(note.id, user.id, val);
        }
      };
    });
  }
};

const handleRemoveRate = async (noteId, userId) => {
  try {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId);

    if (error) throw error;

    window.Toast.info("Valutazione rimossa.");
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    window.Toast.error("Errore nella rimozione del voto.");
    console.error(err);
  }
};

const handleRateNote = async (noteId, userId, score) => {
  try {
    const { error } = await supabase.from('ratings').upsert({
      note_id: noteId,
      user_id: userId,
      score: score
    });

    if (error) throw error;

    window.Toast.success("Voto salvato! Grazie.");
    // Piccola attesa per il trigger DB e ricarica UI
    setTimeout(() => window.location.reload(), 1000);
  } catch (err) {
    window.Toast.error("Errore nel salvataggio del voto.");
    console.error(err);
  }
};

const renderCommentsList = (comments) => {
  if (!comments || comments.length === 0) return `<div class="empty-state" style="padding:32px;"><p>Nessun commento. Sii il primo!</p></div>`;
  return comments.map(c => `
    <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-md); border:1px solid ${c.is_errata ? '#EF4444' : 'var(--border)'}; margin-bottom:16px; position:relative;">
      ${c.is_errata ? `<span class="badge" style="position:absolute; top:12px; right:12px; color:#EF4444; border-color:#EF4444; background:rgba(239,68,68,0.05);">ERRATA CORRIGE</span>` : ''}
      <div class="flex items-center gap-12 mb-12">
        <div style="width:32px; height:32px; border-radius:999px; background:var(--accent); color:white; display:flex; items-center; justify-content:center; font-weight:600; font-size:0.75rem;">${(c.user_name || 'U').charAt(0).toUpperCase()}</div>
        <div><div style="font-weight:600; font-size:0.875rem;">${c.user_name || 'Utente'}</div><div class="small" style="font-size:0.75rem;">${new Date(c.created_at).toLocaleDateString('it-IT')}</div></div>
      </div>
      <p style="font-size:0.9375rem; margin:0;">${c.content}</p>
    </div>`).join('');
};

const handleCommentSubmit = async (note, user, profile) => {
  const contentEl = document.getElementById('comment-content');
  const isErrataEl = document.getElementById('is-errata');
  const content = contentEl?.value.trim();
  if (!content) return;
  try {
    const isErrata = isErrataEl.checked;
    const { error } = await supabase.from('comments').insert([{ 
      note_id: note.id, 
      user_id: user.id, 
      user_name: profile ? profile.nickname : "Studente", 
      content: content, 
      is_errata: isErrata 
    }]);
    if (error) throw error;

    // Invia Notifica all'uploader (se non è lo stesso autore)
    if (user.id !== note.uploader_id) {
      await supabase.from('notifications').insert([{
        user_id: note.uploader_id,
        actor_name: profile ? profile.nickname : "Uno studente",
        note_id: note.id,
        type: isErrata ? 'errata' : 'comment',
        message: isErrata ? "ha segnalato un errore nel tuo appunto." : "ha commentato il tuo appunto."
      }]);
    }

    window.Toast.success("Commento aggiunto!");
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    console.error(err);
    window.Toast.error("Errore nell'invio del commento.");
  }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNoteDetail);
else initNoteDetail();
