// GitHub API Storage Helper
// Функции для работы с GitHub Contents API

class GitHubStorage {
  constructor() {
    this.config = window.githubConfig || {};
    this.baseUrl = 'https://api.github.com';
  }

  // Получение заголовков авторизации
  getHeaders() {
    const token = localStorage.getItem('github_token') || this.config.token;
    return {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  // Получить список файлов из папки uploads
  async listFiles() {
    try {
      const path = this.config.uploadsPath || 'uploads';
      const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Папка не существует - возвращаем пустой массив
          return [];
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  // Загрузить файл в GitHub
  async uploadFile(filename, content, type = 'document') {
    try {
      const path = `${this.config.uploadsPath || 'uploads'}/${type}/${filename}`;
      const contentBase64 = btoa(content);

      // Сначала проверяем, существует ли файл
      const getFileUrl = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
      const getFileResponse = await fetch(getFileUrl, {
        headers: this.getHeaders()
      });

      let sha = null;
      if (getFileResponse.ok) {
        const fileData = await getFileResponse.json();
        sha = fileData.sha;
      }

      // Создаем или обновляем файл
      const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;
      const body = {
        message: `Upload ${type}: ${filename}`,
        content: contentBase64
      };

      if (sha) {
        body.sha = sha;
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        url: data.content.download_url,
        path: path
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: error.message };
    }
  }

  // Удалить файл из GitHub
  async deleteFile(filename, type = 'document') {
    try {
      const path = `${this.config.uploadsPath || 'uploads'}/${type}/${filename}`;
      const url = `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

      // Получаем SHA файла
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const fileData = await response.json();

      // Удаляем файл
      const deleteResponse = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message: `Delete ${type}: ${filename}`,
          sha: fileData.sha
        })
      });

      if (!deleteResponse.ok) {
        throw new Error(`GitHub API error: ${deleteResponse.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  }

  // Получить URL файла
  getFileUrl(filename, type = 'document') {
    const path = `${this.config.uploadsPath || 'uploads'}/${type}/${filename}`;
    return `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/main/${path}`;
  }
}

// Создаем глобальный экземпляр
window.githubStorage = new GitHubStorage();
