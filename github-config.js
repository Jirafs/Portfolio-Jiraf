// GitHub API Configuration
// Токен хранится в localStorage для безопасности
window.githubConfig = {
  // Функция для получения токена из localStorage
  getToken: function() {
    return localStorage.getItem('github_token') || '';
  },
  // Функция для сохранения токена
  setToken: function(token) {
    localStorage.setItem('github_token', token);
  },
  // Функция для удаления токена
  clearToken: function() {
    localStorage.removeItem('github_token');
  },
  owner: 'Jirafs',
  repo: 'Portfolio-Jiraf',
  uploadsPath: 'uploads'
};

// Если токен ещё не сохранён, покажем приглашение
if (!window.githubConfig.getToken()) {
  console.log('GitHub токен не настроен. Добавьте его через localStorage.setItem("github_token", "your_token")');
}
