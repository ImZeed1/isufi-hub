import { supabase, getURL } from './supabase-config.js';

/**
 * ISUFI Hub - Auth Debug & Logic
 * Questo script gestisce registrazione e login.
 */

const initAuth = () => {
  console.log("DEBUG: Avvio initAuth...");
  
  // Elementi UI
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const formVerify = document.getElementById('form-verify');
  const btnBack = document.getElementById('btn-back-to-login');
  let pendingEmail = '';

  // Verifica elementi
  if (!tabLogin || !tabRegister || !formLogin || !formRegister || !formVerify) {
    console.error("DEBUG: Alcuni elementi del form non sono stati trovati nel DOM!");
    return;
  }

  const showVerifyForm = (email) => {
    pendingEmail = email;
    formLogin.classList.remove('active');
    formRegister.classList.remove('active');
    formVerify.classList.add('active');
    tabLogin.style.display = 'none';
    tabRegister.style.display = 'none';
  };

  const showLoginForm = () => {
    formVerify.classList.remove('active');
    formLogin.classList.add('active');
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    tabLogin.style.display = 'block';
    tabRegister.style.display = 'block';
  };

  if (btnBack) btnBack.onclick = showLoginForm;

  // --- GESTIONE VERIFICA OTP ---
  formVerify.onsubmit = async (e) => {
    e.preventDefault();
    console.log("DEBUG: Invio form VERIFICA OTP...");

    const btn = formVerify.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    const errorEl = document.getElementById('verify-error');
    const token = document.getElementById('verify-token').value.trim();

    try {
      btn.disabled = true;
      btn.innerHTML = 'Verifica in corso...';
      if (errorEl) errorEl.style.display = 'none';

      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: token,
        type: 'signup'
      });

      if (error) throw error;

      console.log("DEBUG: Verifica riuscita!", data);
      window.Toast.success("Account confermato!");
      setTimeout(() => window.location.href = 'index.html', 1000);

    } catch (err) {
      console.error("DEBUG: Errore verifica:", err);
      if (errorEl) {
        errorEl.textContent = err.message || "Codice non valido o scaduto.";
        errorEl.style.display = 'block';
      }
      window.Toast.error(err.message);
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  };

  // Verifica Supabase
  if (!supabase) {
    console.error("DEBUG: Il client Supabase non è inizializzato!");
    alert("Errore critico: Impossibile connettersi al database.");
    return;
  }

  console.log("DEBUG: Elementi trovati, inizializzo i listener...");

  // --- GESTIONE TABS ---
  tabLogin.onclick = () => {
    console.log("DEBUG: Cliccato tab ACCEDI");
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.add('active');
    formRegister.classList.remove('active');
    formVerify.classList.remove('active');
  };

  tabRegister.onclick = () => {
    console.log("DEBUG: Cliccato tab REGISTRATI");
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.classList.add('active');
    formLogin.classList.remove('active');
    formVerify.classList.remove('active');
  };

  // --- GESTIONE LOGIN ---
  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    console.log("DEBUG: Invio form LOGIN...");

    const btn = formLogin.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    const errorEl = document.getElementById('login-error');
    
    try {
      btn.disabled = true;
      btn.innerHTML = 'Accesso in corso...';
      if (errorEl) errorEl.style.display = 'none';

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      console.log("DEBUG: Tentativo login per", email);
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      console.log("DEBUG: Login riuscito!", data);
      
      // Controllo profilo
      try {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).single();
        if (!profile) {
          console.log("DEBUG: Profilo mancante, lo creo...");
          const meta = data.user.user_metadata || {};
          await supabase.from('profiles').insert([{
            id: data.user.id,
            nickname: meta.nickname || email.split('@')[0],
            course: meta.course || 'Studente'
          }]);
        }
      } catch (err) { console.warn("Errore profilo (non bloccante):", err); }

      window.Toast.success("Accesso effettuato!");
      setTimeout(() => window.location.href = 'index.html', 1000);

    } catch (err) {
      console.error("DEBUG: Errore login:", err);
      if (errorEl) {
        errorEl.textContent = err.message || "Errore durante l'accesso.";
        errorEl.style.display = 'block';
      }
      window.Toast.error(err.message);
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  };

  // --- GESTIONE REGISTRAZIONE ---
  formRegister.onsubmit = async (e) => {
    e.preventDefault();
    console.log("DEBUG: Invio form REGISTRAZIONE...");

    const btn = formRegister.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    const errorEl = document.getElementById('reg-error');
    const successEl = document.getElementById('reg-success');

    try {
      btn.disabled = true;
      btn.innerHTML = 'Creazione account...';
      if (errorEl) errorEl.style.display = 'none';
      if (successEl) successEl.style.display = 'none';

      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const nickname = document.getElementById('reg-nickname').value.trim();
      const course = document.getElementById('reg-course').value.trim();

      if (password.length < 6) throw new Error("La password deve essere di almeno 6 caratteri.");

      console.log("DEBUG: Chiamata signUp per", email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { nickname, course },
          emailRedirectTo: `${getURL()}login.html` 
        }
      });

      if (error) throw error;

      console.log("DEBUG: Risposta signUp:", data);

      if (!data.session) {
        // Email di conferma necessaria
        console.log("DEBUG: Email di conferma inviata.");
        window.Toast.info("Controlla la tua email per confermare.");
        if (successEl) {
          successEl.textContent = "Email di conferma inviata! Inserisci il codice qui sotto.";
          successEl.style.display = 'block';
        }
        
        // Mostra il form di verifica OTP
        showVerifyForm(email);
      } else {
        // Registrazione immediata
        console.log("DEBUG: Registrazione immediata riuscita!");
        await supabase.from('profiles').insert([{ id: data.user.id, nickname, course }]);
        window.Toast.success("Account creato!");
        setTimeout(() => window.location.href = 'index.html', 1000);
      }

    } catch (err) {
      console.error("DEBUG: Errore registrazione:", err);
      if (errorEl) {
        errorEl.textContent = err.message || "Errore durante la registrazione.";
        errorEl.style.display = 'block';
      }
      window.Toast.error(err.message);
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  };
};

// Esecuzione
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
} catch (e) {
  console.error("DEBUG: Errore fatale caricamento auth.js:", e);
  alert("Errore critico nel caricamento del modulo di autenticazione.");
}
