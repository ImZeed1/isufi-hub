import { supabase, getCurrentUser } from './supabase-config.js';

const initUpload = async () => {
  const uploadForm = document.getElementById('upload-form');
  if (!uploadForm) return;

  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile } = await supabase.from('profiles').select('nickname').eq('id', user.id).single();
  const uploaderName = profile ? profile.nickname : 'Studente';

  // --- MULTI-STEP ---
  const steps = document.querySelectorAll('.form-step');
  const indicators = document.querySelectorAll('.step-indicator');
  const nextBtns = document.querySelectorAll('.btn-next');
  const prevBtns = document.querySelectorAll('.btn-prev');
  let currentStep = 0;

  const showStep = (stepIndex) => {
    steps.forEach((step, index) => {
      step.style.display = (index === stepIndex) ? 'block' : 'none';
      if (index === stepIndex) {
        step.classList.add('visible');
      }
    });
    indicators.forEach((indicator, index) => {
      if (index < stepIndex) {
        indicator.classList.add('completed');
        indicator.classList.remove('active');
        indicator.innerHTML = '<i data-lucide="check" style="width:16px;height:16px;"></i>';
      } else if (index === stepIndex) {
        indicator.classList.add('active');
        indicator.classList.remove('completed');
        indicator.innerHTML = index + 1;
      } else {
        indicator.classList.remove('active', 'completed');
        indicator.innerHTML = index + 1;
      }
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Update review step
    if (stepIndex === steps.length - 1) {
      updateReviewStep();
    }
  };

  // Validate current step before advancing
  const validateStep = (stepIndex) => {
    const step = steps[stepIndex];
    const requiredFields = step.querySelectorAll('[required]');
    let valid = true;

    requiredFields.forEach(field => {
      if (!field.value || field.value === '') {
        field.classList.add('error');
        valid = false;
        field.addEventListener('input', () => field.classList.remove('error'), { once: true });
        field.addEventListener('change', () => field.classList.remove('error'), { once: true });
      }
    });

    if (!valid) {
      Toast.warning("Compila tutti i campi obbligatori.");
    }
    return valid;
  };

  nextBtns.forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      if (validateStep(currentStep) && currentStep < steps.length - 1) {
        currentStep++;
        showStep(currentStep);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  document.querySelectorAll('.btn-prev').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    });
  });
  showStep(currentStep);

  // --- CASCADING DROPDOWNS ---
  const areaSelect = document.getElementById('upload-area');
  const materiaSelect = document.getElementById('upload-materia');

  const materieMap = {
    "Tecnico-Scientifica": [
      "Ingegneria Informatica", "Ingegneria Biomedica", "Ingegneria Civile", "Ingegneria dell'Informazione",
      "Ingegneria Gestionale", "Ingegneria Industriale", "Matematica", "Fisica",
      "Chimica per la Sostenibilità", "Biologia", "Scienze e Tecnologie per l'Ambiente",
      "Infermieristica", "Fisica Medica", "Fisioterapia", "Scienze Motorie",
      "Farmacia", "Ingegneria Elettronica", "Ingegneria delle Telecomunicazioni"
    ],
    "Economico-Giuridica": [
      "Economia e Finanza", "Economia Aziendale", "Scienze dei Servizi Giuridici",
      "Economia del Turismo", "Management, Controllo e Finanza", "Giurisprudenza (ciclo unico)"
    ],
    "Umanistico-Sociale": [
      "Filosofia", "Lettere", "Scienze della Comunicazione", "Lingue, Letterature e Culture Straniere",
      "Beni Culturali", "Scienze Politiche", "Sociologia", "Servizio Sociale", "Educazione Sociale",
      "Scienze dell'Educazione", "Lettere Classiche", "Lettere Moderne", "Archeologia", "Digital Heritage",
      "Storia dell'Arte", "Data Science per le Scienze Umane", "Scienze della Formazione Primaria"
    ]
  };

  areaSelect.addEventListener('change', (e) => {
    const area = e.target.value;
    materiaSelect.innerHTML = '<option value="" disabled selected>Seleziona un corso di laurea...</option>';
    if (materieMap[area]) {
      materiaSelect.disabled = false;
      materieMap[area].sort().forEach(materia => {
        const option = document.createElement('option');
        option.value = materia;
        option.textContent = materia;
        materiaSelect.appendChild(option);
      });
    } else {
      materiaSelect.disabled = true;
    }
  });

  // --- DRAG & DROP ---
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-upload');
  const dropzoneText = dropzone.querySelector('h3');
  const dropzoneSubtext = dropzone.querySelector('.small');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateDropzoneUI(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) updateDropzoneUI(fileInput.files[0]);
    });
  }

  function updateDropzoneUI(files) {
    if (files.length === 1) {
      const file = files[0];
      const ext = file.name.split('.').pop().toUpperCase();
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      dropzoneText.textContent = file.name;
      if (dropzoneSubtext) {
        dropzoneSubtext.innerHTML = `<strong>${ext}</strong> &middot; ${sizeMB} MB`;
      }
    } else {
      dropzoneText.textContent = `${files.length} file selezionati`;
      if (dropzoneSubtext) {
        let totalSize = 0;
        for (let i = 0; i < files.length; i++) totalSize += files[i].size;
        dropzoneSubtext.innerHTML = `Pacchetto di ${(totalSize / (1024 * 1024)).toFixed(1)} MB totali`;
      }
    }
    dropzone.style.borderColor = 'var(--accent-alt)';
    dropzone.style.backgroundColor = 'var(--accent-soft)';
  }

  // --- REVIEW STEP ---
  function updateReviewStep() {
    const reviewContainer = document.getElementById('review-summary');
    if (!reviewContainer) return;

    const area = document.getElementById('upload-area').value || '—';
    const materia = document.getElementById('upload-materia').value || '—';
    const professor = document.getElementById('upload-professor').value || '—';
    const year = document.getElementById('upload-year').value || '—';
    const academicYear = document.getElementById('upload-academic-year').value || '—';
    const type = document.getElementById('upload-type').value || '—';
    const title = document.getElementById('upload-title').value || '—';
    
    const files = fileInput.files;
    const filesInfo = files.length > 1 ? `${files.length} file (Pacchetto)` : (files[0] ? files[0].name : 'Nessun file');

    reviewContainer.innerHTML = `
      <div style="display:grid;grid-template-columns:120px 1fr;gap:8px 16px;font-size:0.875rem;">
        <span style="color:var(--text-muted);font-weight:500;">Titolo</span>
        <span style="font-weight:600;">${title}</span>
        <span style="color:var(--text-muted);font-weight:500;">Professore</span>
        <span>${professor}</span>
        <span style="color:var(--text-muted);font-weight:500;">Materia</span>
        <span>${materia}</span>
        <span style="color:var(--text-muted);font-weight:500;">Contenuto</span>
        <span>${filesInfo}</span>
        <span style="color:var(--text-muted);font-weight:500;">Tipo</span>
        <span>${type}</span>
      </div>
    `;
  }

  // --- SUBMIT ---
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const area = document.getElementById('upload-area').value;
    const subject = document.getElementById('upload-materia').value;
    const professor = document.getElementById('upload-professor').value;
    const year = parseInt(document.getElementById('upload-year').value);
    const academic_year = document.getElementById('upload-academic-year').value;
    const type = document.getElementById('upload-type').value;
    const title = document.getElementById('upload-title').value;
    const description = document.getElementById('upload-description').value;
    const table_of_contents = document.getElementById('upload-toc').value;
    const tagsString = document.getElementById('upload-tags').value;

    const files = Array.from(fileInput.files);
    if (files.length === 0) {
      window.Toast.warning("Seleziona almeno un file da caricare.");
      return;
    }

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader" class="spin" style="width:18px;height:18px;"></i> Caricamento...';
    submitBtn.disabled = true;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
      // Se ci sono più file, creiamo un bundle_id
      const bundle_id = files.length > 1 ? Math.random().toString(36).substring(2, 15) : null;
      const tagsArray = tagsString ? tagsString.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 50 * 1024 * 1024) throw new Error(`Il file ${file.name} supera i 50MB.`);

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('note-files')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('note-files').getPublicUrl(filePath);
        const publicUrl = publicUrlData.publicUrl;

        const { error: dbError } = await supabase.from('notes').insert([{
          title: files.length > 1 ? `${title} (Parte ${i+1}: ${file.name})` : title,
          subject,
          area,
          professor,
          academic_year,
          year,
          type,
          uploader_id: user.id,
          uploader_name: uploaderName,
          file_url: publicUrl,
          description,
          table_of_contents,
          tags: tagsArray,
          bundle_id: bundle_id
        }]);

        if (dbError) throw dbError;
      }

      window.Toast.success("Caricamento completato con successo!");
      setTimeout(() => { window.location.href = 'notes.html'; }, 1200);

    } catch (error) {
      console.error(error);
      window.Toast.error("Errore: " + error.message);
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUpload);
} else {
  initUpload();
}
