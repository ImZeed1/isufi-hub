import { supabase, getCurrentUser } from './supabase-config.js';
import { renderNotes } from './notes.js';

const initProfile = async () => {
  const infoContainer = document.querySelector('.profile-info');
  if (infoContainer) {
    infoContainer.querySelector('p').textContent = "Connessione al database...";
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // 1. Carica profilo
    let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    const meta = user.user_metadata || {};
    const metaNickname = meta.nickname;
    const metaCourse = meta.course;

    if (!profile) {
      console.log("DEBUG: Profilo non trovato in DB, lo creo dai metadati...");
      const defaultNickname = metaNickname || (user.email ? user.email.split('@')[0] : 'Studente');
      const defaultCourse = metaCourse || 'Studente ISUFI';

      const { data: newProfile } = await supabase
        .from('profiles')
        .insert([{ id: user.id, nickname: defaultNickname, course: defaultCourse }])
        .select().single();
      if (newProfile) profile = newProfile;
    } else if (profile.nickname === user.email.split('@')[0] && metaNickname && profile.nickname !== metaNickname) {
      // Se il profilo ha il nickname di default ma i metadati hanno quello scelto dall'utente, aggiorna!
      console.log("DEBUG: Sincronizzo nickname dai metadati...");
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .update({ nickname: metaNickname, course: metaCourse || profile.course })
        .eq('id', user.id)
        .select().single();
      if (updatedProfile) profile = updatedProfile;
    }

    const infoEl = document.querySelector('.profile-info');
    const avatarEl = document.querySelector('.profile-avatar');

    const updateUI = (prof) => {
      if (avatarEl) avatarEl.textContent = prof.nickname ? prof.nickname.charAt(0).toUpperCase() : 'U';
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="flex items-center gap-12">
            <h1>${prof.nickname || 'Utente'}</h1>
            <button id="edit-profile-btn" class="btn btn-ghost btn-sm" title="Modifica profilo"><i data-lucide="edit-3" style="width:16px;height:16px;"></i></button>
          </div>
          <p><i data-lucide="graduation-cap" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> ${prof.course || 'Corso non specificato'}</p>
          <div class="profile-stats">
            <div class="profile-stat">
              <i data-lucide="upload" style="width:14px;height:14px;"></i>
              <span class="stat-value" id="count-uploads">0</span> caricati
            </div>
            <div class="profile-stat">
              <i data-lucide="download" style="width:14px;height:14px;"></i>
              <span class="stat-value" id="count-downloads">0</span> download
            </div>
            <div class="profile-stat">
              <i data-lucide="bookmark" style="width:14px;height:14px;"></i>
              <span class="stat-value" id="count-saved">0</span> salvati
            </div>
          </div>
        `;

        // Listener per modifica
        document.getElementById('edit-profile-btn').onclick = () => {
          const newNick = prompt("Inserisci il nuovo nickname:", prof.nickname);
          const newCourse = prompt("Inserisci il tuo corso di laurea:", prof.course);
          if (newNick && newNick.trim() !== "") {
            handleUpdateProfile(newNick, newCourse);
          }
        };
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    const handleUpdateProfile = async (nickname, course) => {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ nickname, course })
        .eq('id', user.id)
        .select().single();

      if (error) {
        window.Toast.error("Errore nell'aggiornamento: " + error.message);
      } else {
        window.Toast.success("Profilo aggiornato!");
        updateUI(updated);
      }
    };

    if (profile) {
      updateUI(profile);

      // Fetch stats
      const { data: uploads } = await supabase.from('notes').select('id, downloads').eq('uploader_id', user.id);
      const { data: savedIds } = await supabase.from('saved_notes').select('note_id').eq('user_id', user.id);

      document.getElementById('count-uploads').textContent = uploads ? uploads.length : 0;
      document.getElementById('count-downloads').textContent = uploads ? uploads.reduce((sum, n) => sum + (n.downloads || 0), 0) : 0;
      document.getElementById('count-saved').textContent = savedIds ? savedIds.length : 0;
    }
 else {
      if (avatarEl) avatarEl.textContent = 'U';
      if (infoEl) {
        infoEl.innerHTML = `
          <h1>Utente</h1>
          <p><i data-lucide="graduation-cap" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></i> Profilo Incompleto</p>
        `;
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Logout button
    const profileHeader = document.querySelector('.profile-header');
    if (profileHeader && !document.getElementById('logout-btn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logout-btn';
      logoutBtn.className = 'btn btn-secondary';
      logoutBtn.style.marginLeft = 'auto';
      logoutBtn.innerHTML = '<i data-lucide="log-out" style="width:16px;height:16px;"></i> Esci';
      logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        Toast.info("Logout effettuato.");
        setTimeout(() => { window.location.href = 'index.html'; }, 600);
      };
      profileHeader.appendChild(logoutBtn);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      const newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);

      newTab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        newTab.classList.add('active');
        document.getElementById(newTab.getAttribute('data-target')).classList.add('active');
      });
    });

    // 2. Preferiti
    const renderFavorites = async () => {
      const favoritesGrid = document.getElementById('favorites-grid');
      const noFavoritesMsg = document.getElementById('no-favorites');
      if (!favoritesGrid) return;

      const { data: savedIds } = await supabase.from('saved_notes').select('note_id').eq('user_id', user.id);
      const ids = savedIds ? savedIds.map(s => String(s.note_id)) : [];

      // Aggiorna il contatore nelle stats
      const countSavedEl = document.getElementById('count-saved');
      if (countSavedEl) countSavedEl.textContent = ids.length;

      if (ids.length === 0) {
        favoritesGrid.style.display = 'none';
        noFavoritesMsg.style.display = 'block';
      } else {
        const { data: favoriteNotes } = await supabase.from('notes').select('*').in('id', ids);
        favoritesGrid.style.display = 'grid';
        noFavoritesMsg.style.display = 'none';
        renderNotes(favoriteNotes || [], 'favorites-grid', ids, user.id);
      }
    };

    // 3. Caricamenti
    const renderUploads = async () => {
      const uploadsGrid = document.getElementById('uploads-grid');
      const noUploadsMsg = document.getElementById('no-uploads');
      if (!uploadsGrid) return;

      const { data: savedIds } = await supabase.from('saved_notes').select('note_id').eq('user_id', user.id);
      const ids = savedIds ? savedIds.map(s => String(s.note_id)) : [];

      const { data: myUploads } = await supabase.from('notes').select('*').eq('uploader_id', user.id);

      if (!myUploads || myUploads.length === 0) {
        uploadsGrid.style.display = 'none';
        noUploadsMsg.style.display = 'block';
      } else {
        uploadsGrid.style.display = 'grid';
        noUploadsMsg.style.display = 'none';
        renderNotes(myUploads, 'uploads-grid', ids, user.id);
      }
    };

    // Hook per ricaricare preferiti in tempo reale
    const originalToggleSave = window.toggleSaveNote;
    window.toggleSaveNote = async (e, noteId) => {
      await originalToggleSave(e, noteId);
      if (document.getElementById('favorites-grid')) {
        setTimeout(() => renderFavorites(), 300);
      }
    };

    await renderFavorites();
    await renderUploads();

  } catch (err) {
    Toast.error("Errore nel caricamento del profilo.");
    console.error(err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfile);
} else {
  initProfile();
}
