import { supabase, getCurrentUser } from './supabase-config.js';

const initAuthState = async () => {
  const user = await getCurrentUser();
  
  const loginBtns = document.querySelectorAll('#nav-login-btn');
  const profileBtns = document.querySelectorAll('#nav-profile-btn');
  const notificationArea = document.getElementById('nav-notifications');

  if (user) {
    // Utente loggato: mostra Profilo, nascondi Accedi
    loginBtns.forEach(btn => btn.style.display = 'none');
    profileBtns.forEach(btn => {
      btn.style.display = 'inline-block';
      if(btn.parentElement && btn.parentElement.classList.contains('mobile-nav-overlay')){
        btn.style.display = 'block';
      }
    });

    // Inizializza Notifiche
    if (notificationArea) {
      notificationArea.style.display = 'block';
      initNotifications(user);
    }

  } else {
    // Utente non loggato: mostra Accedi, nascondi Profilo
    loginBtns.forEach(btn => {
      btn.style.display = 'inline-block';
      if(btn.parentElement && btn.parentElement.classList.contains('mobile-nav-overlay')){
        btn.style.display = 'block';
      }
    });
    profileBtns.forEach(btn => btn.style.display = 'none');
    if (notificationArea) notificationArea.style.display = 'none';
    
    // Se siamo su una pagina protetta (upload o profile), reindirizza al login
    const currentPath = window.location.pathname;
    if (currentPath.endsWith('upload.html') || currentPath.endsWith('profile.html')) {
      window.location.href = 'login.html';
    }
  }
};

const initNotifications = async (user) => {
  const bellBtn = document.getElementById('bell-btn');
  const bellBadge = document.getElementById('bell-badge');
  const dropdown = document.getElementById('notifications-dropdown');
  const list = document.getElementById('notifications-list');

  if (!bellBtn || !dropdown || !list) return;

  // 1. Carica notifiche iniziali
  const loadNotifications = async () => {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error("Errore caricamento notifiche:", error);
      return;
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
      bellBadge.style.display = 'block';
      bellBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    } else {
      bellBadge.style.display = 'none';
    }

    if (notifications.length === 0) {
      list.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.8rem;">Nessuna notifica</div>';
      return;
    }

    list.innerHTML = notifications.map(n => `
      <a href="note-detail.html?id=${n.note_id}" class="notification-item ${n.is_read ? '' : 'unread'}">
        <div class="notification-item-icon">
          <i data-lucide="${n.type === 'errata' ? 'alert-triangle' : 'message-square'}" style="width:14px;height:14px;"></i>
        </div>
        <div class="notification-content">
          <div class="notification-text"><strong>${n.actor_name}</strong> ${n.message}</div>
          <div class="notification-time">${new Date(n.created_at).toLocaleDateString('it-IT')}</div>
        </div>
      </a>
    `).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  await loadNotifications();

  // 2. Click sulla campanella
  bellBtn.onclick = async (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    
    if (isOpen) {
      // Segna come lette quando apri
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error) {
        bellBadge.style.display = 'none';
      }
    }
  };

  // Chiudi cliccando fuori
  document.addEventListener('click', () => dropdown.classList.remove('open'));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthState);
} else {
  initAuthState();
}
