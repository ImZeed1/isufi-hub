// Importiamo il client di Supabase via CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ⚠️ INCOLLA QUI I TUOI DATI DA SUPABASE (Project Settings -> API)
const supabaseUrl = 'https://obxnjbbobcfkteujxibl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ieG5qYmJvYmNma3RldWp4aWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDU5NTIsImV4cCI6MjA4OTUyMTk1Mn0.TuiZocFBXXfYvjotlgqPWupRyKgdSkZig_azk9uZ9bY'

// Inizializziamo il client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funzione helper per ottenere l'URL corretto per i redirect (gestisce locale e produzione)
export const getURL = () => {
  let url = window.location.origin;
  // Assicurati che finisca con /
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
  return url;
};

// Funzione helper per verificare se l'utente è loggato
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
