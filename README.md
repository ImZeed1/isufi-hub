# ISUFI Hub

Piattaforma di knowledge-sharing dedicata agli allievi della Scuola Superiore ISUFI. L'obiettivo è centralizzare gli appunti e il materiale didattico di qualità, organizzandoli per area disciplinare per non dover impazzire tra Drive e gruppi WhatsApp.

## Funzionalità principali
- **Ricerca organizzata:** Filtri per area (Tecnico-Scientifica, Economico-Giuridica, Umanistico-Sociale).
- **Gestione Profilo:** Sistema di login e area personale per gestire i propri caricamenti.
- **Notifiche:** Sistema di avvisi integrato.
- **PWA Ready:** Configurato con Service Worker e Manifest per essere installato come app su smartphone.

## Stack Tecnologico
Per questo progetto ho preferito evitare framework pesanti per mantenere il caricamento istantaneo e avere il controllo totale sullo stile:
- **Frontend:** HTML5, Vanilla CSS (niente Tailwind, tutto scritto a mano per un look più pulito) e JavaScript ES6.
- **Backend:** Python (`server.py`) per il routing locale.
- **Database & Auth:** Supabase per la gestione degli utenti e lo storage degli appunti.
- **Icone:** Lucide Icons.

## Setup locale
Per testare il sito in locale, basta clonare la repo e lanciare il server Python:

1. Clonare il progetto:
   ```bash
   git clone https://github.com/ImZeed1/isufi-hub.git
   ```
2. Avviare il server:
   ```bash
   python server.py
   ```
3. Navigare su `http://localhost:8000`.

## Struttura Database
Il file `database-schema.sql` nella root contiene tutte le query necessarie per ricreare le tabelle (notes, profiles, notifications) e le policy RLS su una nuova istanza Supabase.

---
*Lavori in corso: sto rifinendo la parte estetica per renderla meno pacchiana e più professionale.*
