import { supabase, getCurrentUser } from './supabase-config.js';
import { toggleSaveNote, trackDownload } from './notes.js';

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

    // 1. Carica utente, suo voto e stato salvataggio
    const user = await getCurrentUser();
    let userProfile = null;
    let userRating = 0;
    let isSaved = false;

    if (user) {
      const [{ data: profile }, { data: rating }, { data: saved }] = await Promise.all([
        supabase.from('profiles').select('nickname').eq('id', user.id).single(),
        supabase.from('ratings').select('score').eq('note_id', noteId).eq('user_id', user.id).maybeSingle(),
        supabase.from('saved_notes').select('id').eq('user_id', user.id).eq('note_id', noteId).maybeSingle()
      ]);
      userProfile = profile;
      if (rating) userRating = rating.score;
      if (saved) isSaved = true;
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

    renderDetail(note, comments || [], bundleFiles, user, userProfile, userRating, isSaved);

  } catch (err) {
    console.error("DEBUG: Errore fatale initNoteDetail:", err);
    container.innerHTML = `<div class="empty-state"><h2>Errore</h2><p>${err.message}</p><a href="notes.html" class="btn btn-secondary mt-24">Libreria</a></div>`;
  }
};

const renderDetail = (note, comments, bundleFiles, user, userProfile, userRating, isSaved) => {
  const container = document.getElementById('note-detail-container');
  const dateStr = new Date(note.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const tagsHtml = (note.tags || []).map(tag => `<span class="badge">#${tag}</span>`).join('');
  const isPdf = note.file_url.toLowerCase().endsWith('.pdf');

  container.innerHTML = `
    <div class="fade-up visible">
      <!-- Header della Nota -->
      <div class="note-detail-header mb-40">
        <div class="flex flex-col gap-16">
          <div class="flex items-center gap-12 flex-wrap">
            <span class="badge ${getTypeColorClass(note.type)}">${note.type || 'Risorsa'}</span>
            ${note.bundle_id ? '<span class="badge badge-bundle"><i data-lucide="layers" style="width:12px;height:12px;"></i> PACCHETTO</span>' : ''}
            <div class="note-meta-top">
              <span class="small"><i data-lucide="calendar"></i> Caricato il ${dateStr}</span>
              <span class="small"><i data-lucide="user"></i> ${note.uploader_name}</span>
            </div>
          </div>
          <h1 class="note-main-title">${note.title}</h1>
          <div class="note-subject-pill">
            <i data-lucide="book-open"></i>
            <span>${note.subject}</span>
          </div>
        </div>
        
        <div class="note-actions-fixed">
          <button class="btn btn-secondary ${isSaved ? 'saved' : ''}" id="detail-save-btn">
            <i data-lucide="bookmark" ${isSaved ? 'fill="var(--accent-alt)" style="color:var(--accent-alt);"' : ''}></i> <span>${isSaved ? 'Salvato' : 'Salva'}</span>
          </button>
          <a href="${note.file_url}" target="_blank" id="detail-download-btn" class="btn btn-primary">
            <i data-lucide="download"></i> <span>Download PDF</span>
          </a>
        </div>
      </div>

      <div class="note-detail-layout">
        <div class="note-detail-main">
          <!-- Anteprima PDF -->
          ${isPdf ? `<div class="pdf-preview-container">
            <div class="pdf-preview-header">
              <div class="flex items-center gap-8">
                <i data-lucide="file-text" style="width:16px;height:16px;color:var(--accent-alt);"></i>
                <span class="small" style="font-weight:600;">Anteprima Documento</span>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pdf-frame').requestFullscreen()">
                <i data-lucide="maximize"></i>
              </button>
            </div>
            <iframe id="pdf-frame" src="${note.file_url}#toolbar=0" width="100%" height="650px" style="border:none;"></iframe>
          </div>` : ''}

          <!-- Box Informazioni Tecniche -->
          <div class="info-section-card">
            <div class="section-header">
              <i data-lucide="info"></i>
              <h3>Dettagli Accademici</h3>
            </div>
            <div class="academic-grid">
              <div class="academic-item">
                <i data-lucide="graduation-cap"></i>
                <div class="academic-content">
                  <label>Docente</label>
                  <span>${note.professor || 'Non indicato'}</span>
                </div>
              </div>
              <div class="academic-item">
                <i data-lucide="calendar-days"></i>
                <div class="academic-content">
                  <label>Anno Accademico</label>
                  <span>${note.academic_year || 'N.D.'}</span>
                </div>
              </div>
              <div class="academic-item">
                <i data-lucide="milestone"></i>
                <div class="academic-content">
                  <label>Anno di Corso</label>
                  <span>${note.year}° Anno</span>
                </div>
              </div>
              <div class="academic-item">
                <i data-lucide="tag"></i>
                <div class="academic-content">
                  <label>Area</label>
                  <span>${note.area || 'N.D.'}</span>
                </div>
              </div>
            </div>

            <div class="description-block mt-32">
              <h4>Descrizione del materiale</h4>
              <p>${note.description || 'Nessuna descrizione aggiuntiva fornita dall\'autore.'}</p>
            </div>

            ${note.table_of_contents ? `
            <div class="toc-block mt-24">
              <div class="toc-header">
                <i data-lucide="list-ordered"></i>
                <span>Indice Contenuti</span>
              </div>
              <div class="toc-content">${note.table_of_contents}</div>
            </div>` : ''}

            <div class="tags-block mt-32">
              <div class="flex items-center gap-8 mb-12">
                <i data-lucide="hash" style="width:16px;height:16px;color:var(--text-light);"></i>
                <span class="small" style="font-weight:600;color:var(--text-muted);">Tag Correlati</span>
              </div>
              <div class="card-tags">${tagsHtml}</div>
            </div>
          </div>

          <!-- Sezione Commenti / Community -->
          <div id="comments-section" class="mt-48">
            <div class="section-header mb-24">
              <i data-lucide="messages-square"></i>
              <h3>Discussioni Community <span class="count-badge">${comments.length}</span></h3>
            </div>

            <div class="comment-input-area mb-40">
              ${user ? `
                <div class="professional-form">
                  <textarea id="comment-content" class="form-textarea" placeholder="Hai domande o vuoi ringraziare l'autore?"></textarea>
                  <div class="form-footer">
                    <label class="errata-toggle">
                      <input type="checkbox" id="is-errata">
                      <span class="toggle-box"></span>
                      <span class="toggle-label">Segnala Errata Corrige</span>
                    </label>
                    <button id="submit-comment" class="btn btn-primary btn-sm">Invia Commento</button>
                  </div>
                </div>` : `
                <div class="auth-notice">
                  <i data-lucide="lock"></i>
                  <p>Devi aver effettuato l'accesso per partecipare alla discussione.</p>
                  <a href="login.html" class="btn btn-secondary btn-sm">Accedi</a>
                </div>`}
            </div>
            <div id="comments-list" class="comments-feed">
              ${renderCommentsList(comments, user)}
            </div>
          </div>
        </div>

        <div class="note-detail-sidebar">
          <div class="sidebar-sticky">
            <!-- Box Rating -->
            <div class="sidebar-card rating-card-pro">
              <span class="sidebar-label">VALUTAZIONE MEDIA</span>
              <div class="rating-hero">
                <span class="rating-val">${note.rating > 0 ? parseFloat(note.rating).toFixed(1) : '--'}</span>
                <div class="rating-stars-static">
                   <div class="star-rating justify-center mb-4">
                    ${[1,2,3,4,5].map(v => `<i data-lucide="star" class="${v <= Math.round(note.rating) ? 'filled' : ''}" style="width:16px;height:16px;"></i>`).join('')}
                   </div>
                   <span class="small">${note.rating_count || 0} recensioni</span>
                </div>
              </div>
              
              <div class="user-vote-box mt-24">
                <span class="small mb-12 block">La tua valutazione</span>
                <div class="star-rating justify-center mb-12" id="interactive-rating">
                  ${[1, 2, 3, 4, 5].map(v => `<i data-lucide="star" class="star" data-value="${v}" style="cursor:pointer; width:24px; height:24px;"></i>`).join('')}
                </div>
                <p class="small status-msg" id="user-rating-msg">${userRating > 0 ? 'Hai già espresso il tuo voto' : 'Seleziona una stella'}</p>
              </div>
            </div>

            <!-- Box Bundle -->
            ${bundleFiles.length > 1 ? `
            <div class="sidebar-card bundle-card-pro">
              <div class="flex items-center gap-8 mb-16">
                <i data-lucide="package" style="width:18px;height:18px;color:var(--accent-alt);"></i>
                <h4 style="margin:0;">Contenuti Correlati</h4>
              </div>
              <div class="bundle-list-pro">
                ${bundleFiles.map(bf => `
                  <a href="note-detail.html?id=${bf.id}" class="bundle-link-item ${bf.id == note.id ? 'current' : ''}">
                    <div class="bundle-icon">
                      <i data-lucide="${bf.type === 'esercizi' ? 'pencil' : 'file-text'}"></i>
                    </div>
                    <div class="bundle-info">
                      <span class="bt">${bf.title.split(' (Parte')[0]}</span>
                      <span class="bs">${bf.type}</span>
                    </div>
                    ${bf.id == note.id ? '<span class="now-viewing">In visione</span>' : ''}
                  </a>
                `).join('')}
              </div>
            </div>` : ''}

            <!-- Tips / Safety -->
            <div class="safety-card">
              <i data-lucide="shield-check"></i>
              <p class="small">Questo materiale è riservato agli allievi ISUFI. Non diffondere esternamente.</p>
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
  document.getElementById('detail-save-btn').onclick = async (e) => {
    await toggleSaveNote(e, note.id);
    // Aggiorna il testo del pulsante dopo il toggle
    const btn = e.currentTarget;
    const isSaved = btn.classList.contains('saved');
    btn.querySelector('span').textContent = isSaved ? 'Salvato' : 'Salva';
  };
  document.getElementById('detail-download-btn').onclick = (e) => trackDownload(e, note.id);

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

const renderCommentsList = (comments, currentUser) => {
  if (!comments || comments.length === 0) return `<div class="empty-state-comments"><i data-lucide="message-circle" style="width:32px;height:32px;opacity:0.2;margin-bottom:12px;"></i><p>Ancora nessuna discussione. Inizia tu!</p></div>`;
  
  return comments.map(c => {
    const isOwner = currentUser && c.user_id === currentUser.id;
    
    return `
    <div class="comment-item ${c.is_errata ? 'is-errata-report' : ''}" id="comment-${c.id}">
      <div class="comment-sidebar">
        <div class="comment-avatar">${(c.user_name || 'U').charAt(0).toUpperCase()}</div>
        ${c.is_errata ? '<div class="errata-indicator" title="Segnalazione Errore"><i data-lucide="alert-triangle"></i></div>' : ''}
      </div>
      <div class="comment-content-wrap">
        <div class="comment-meta">
          <div class="flex items-center justify-between w-full">
            <div>
              <span class="comment-author">${c.user_name || 'Studente'}</span>
              <span class="comment-date">${new Date(c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            ${isOwner ? `
              <div class="comment-actions-group">
                <button class="btn-comment-action" onclick="window.prepareEditComment('${c.id}')">
                  <i data-lucide="pencil" style="width:12px;height:12px;"></i> <span>Modifica</span>
                </button>
                <button class="btn-comment-action btn-comment-delete" onclick="window.handleCommentDelete('${c.id}')">
                  <i data-lucide="trash-2" style="width:12px;height:12px;"></i> <span>Elimina</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="comment-text" id="comment-text-${c.id}">
          ${c.is_errata ? '<span class="errata-label">SEGNALAZIONE ERRORE:</span> ' : ''}
          ${c.content}
        </div>
        <div class="comment-edit-area" id="comment-edit-${c.id}" style="display:none; margin-top:12px;">
          <textarea class="form-textarea mb-12" id="edit-input-${c.id}">${c.content}</textarea>
          <div class="flex gap-8">
            <button class="btn btn-primary btn-sm" onclick="window.handleCommentUpdate('${c.id}')">Salva</button>
            <button class="btn btn-secondary btn-sm" onclick="window.cancelEditComment('${c.id}')">Annulla</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
};

// Global handlers per i pulsanti inline
window.prepareEditComment = (id) => {
  document.getElementById(`comment-text-${id}`).style.display = 'none';
  document.getElementById(`comment-edit-${id}`).style.display = 'block';
};

window.cancelEditComment = (id) => {
  document.getElementById(`comment-text-${id}`).style.display = 'block';
  document.getElementById(`comment-edit-${id}`).style.display = 'none';
};

window.handleCommentUpdate = async (id) => {
  const newContent = document.getElementById(`edit-input-${id}`).value.trim();
  if (!newContent) return;
  
  try {
    const { error } = await supabase
      .from('comments')
      .update({ content: newContent })
      .eq('id', id);
    
    if (error) throw error;
    window.Toast.success("Commento aggiornato.");
    setTimeout(() => window.location.reload(), 500);
  } catch (err) {
    window.Toast.error("Errore nell'aggiornamento.");
    console.error(err);
  }
};

window.handleCommentDelete = async (id) => {
  if (!confirm("Sei sicuro di voler eliminare questo commento?")) return;
  
  try {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    window.Toast.info("Commento eliminato.");
    document.getElementById(`comment-${id}`).remove();
  } catch (err) {
    window.Toast.error("Errore nell'eliminazione.");
    console.error(err);
  }
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
