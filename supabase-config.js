// Конфигурация Supabase для портфолио Jiraf.
// URL и публичный (publishable) ключ берутся из проекта Supabase.
window.supabaseConfig = {
  url: 'https://swvlwbrhuiwvkvekqfns.supabase.co',
  key: 'sb_publishable_cCI5GrYQt9Ilq8C7uiAB1w_0cpNpJwW',
  // Названия бакетов (storage) для хранения загруженных файлов.
  buckets: {
    documents: 'documents',
    certificates: 'certificates'
  },
  // Email-адреса, которым доступен «вход владельца»
  // (загрузка документов, сертификатов и достижений).
  // Чтобы разрешить ещё один аккаунт — просто добавьте email в список.
  ownerEmails: ['konkony22@gmail.com']
};
