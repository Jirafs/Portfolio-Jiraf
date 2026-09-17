// Конфигурация Supabase для портфолио Jiraf.
// URL и публичный (publishable) ключ берутся из проекта Supabase.
window.supabaseConfig = {
  url: 'https://swvlwbrhuiwvkvekqfns.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3dmx3YnJodWl3dmt2ZWtxZm5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4NTAwMjEsImV4cCI6MjEwNDQyNjAyMX0.wrAId4SIwQDoCooS5DPlNeJHLbtpY-LWc6z9Rkb6-x0',
  // Используем существующий бакет portfolio-files с подпапками
  bucket: 'portfolio-files',
  folders: {
    documents: 'documents',
    certificates: 'certificates'
  },
  // Email-адреса, которым доступен «вход владельца»
  // (загрузка документов, сертификатов и достижений).
  // Чтобы разрешить ещё один аккаунт — просто добавьте email в список.
  ownerEmails: ['konkony22@gmail.com']
};
