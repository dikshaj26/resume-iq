// Client API Request layer
(function () {
  const BASE_URL = window.location.origin;

  class API {
    constructor() {
      this.token = localStorage.getItem('token') || null;
    }

    setToken(token) {
      this.token = token;
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }

    getToken() {
      return this.token;
    }

    async request(endpoint, options = {}) {
      const url = `${BASE_URL}${endpoint}`;
      
      // Default headers
      const headers = {};
      
      // If uploading files, let fetch handle boundary automatically (do not set Content-Type)
      if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      // Attach token if exists
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const config = {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      };

      try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'API request failed');
        }

        return data;
      } catch (error) {
        console.error(`API Request Error [${endpoint}]:`, error);
        throw error;
      }
    }

    // ==========================================
    // Auth Endpoints
    // ==========================================
    async register(name, email, password) {
      const data = await this.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      if (data.success && data.token) {
        this.setToken(data.token);
      }
      return data;
    }

    async login(email, password) {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.success && data.token) {
        this.setToken(data.token);
      }
      return data;
    }

    async getMe() {
      return this.request('/api/auth/me', { method: 'GET' });
    }

    async forgotPassword(email) {
      return this.request('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    }

    async resetPassword(email, password) {
      return this.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    }

    logout() {
      this.setToken(null);
    }

    // ==========================================
    // Resume Endpoints
    // ==========================================
    async uploadResume(formData) {
      return this.request('/api/resumes/upload', {
        method: 'POST',
        body: formData
      });
    }

    async createResumeVersion(resumeId, payload) {
      return this.request(`/api/resumes/${resumeId}/version`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    async optimizeResumeWithAI(resumeId) {
      return this.request(`/api/resumes/${resumeId}/optimize`, {
        method: 'POST'
      });
    }

    async getResumes() {
      return this.request('/api/resumes', { method: 'GET' });
    }

    async getResumeVersions(rootId) {
      return this.request(`/api/resumes/series/${rootId}`, { method: 'GET' });
    }

    async getResumeDetails(resumeId) {
      return this.request(`/api/resumes/${resumeId}`, { method: 'GET' });
    }

    async deleteResume(rootId) {
      return this.request(`/api/resumes/${rootId}`, { method: 'DELETE' });
    }

    // ==========================================
    // Analysis Endpoints
    // ==========================================
    async getAnalysisDetails(reportId) {
      return this.request(`/api/analysis/${reportId}`, { method: 'GET' });
    }

    async getReportByResume(resumeId) {
      return this.request(`/api/analysis/resume/${resumeId}`, { method: 'GET' });
    }

    async getAnalysisHistory() {
      return this.request('/api/analysis/history', { method: 'GET' });
    }

    async getAnalysisTrends() {
      return this.request('/api/analysis/trends', { method: 'GET' });
    }

    async runSocialAudit(payload) {
      return this.request('/api/analysis/social', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    // ==========================================
    // Job Match Endpoints
    // ==========================================
    async matchJobDescription(payload) {
      return this.request('/api/job-match', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    async getJobMatches() {
      return this.request('/api/job-match', { method: 'GET' });
    }

    async getJobMatchDetails(matchId) {
      return this.request(`/api/job-match/${matchId}`, { method: 'GET' });
    }

    // AI Cover Letter helper (re-routed through server via job match or directly generate)
    async generateCoverLetter(resumeId, jobDescription, tone) {
      // Find parent resume text
      const resume = await this.getResumeDetails(resumeId);
      
      // Call endpoint that leverages geminiService on backend
      const response = await this.request('/api/job-match', {
        method: 'POST',
        headers: {
          'X-Generate-Cover-Letter-Only': 'true'
        },
        // We will handle cover-letter generating request inside the jobMatch controller
        body: JSON.stringify({
          resumeId,
          jobDescriptionText: jobDescription,
          jobTitle: 'Cover Letter Request',
          company: 'Cover Letter Request',
          tone
        })
      });
      return response;
    }

    // ==========================================
    // Mock Interview Endpoints
    // ==========================================
    async startMockInterview(resumeId, targetRole, targetCompany) {
      return this.request('/api/interviews/generate', {
        method: 'POST',
        body: JSON.stringify({ resumeId, targetRole, targetCompany })
      });
    }

    async submitQuestionAnswer(interviewId, questionId, userAnswer) {
      return this.request(`/api/interviews/${interviewId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ questionId, userAnswer })
      });
    }

    async getInterviewHistory() {
      return this.request('/api/interviews', { method: 'GET' });
    }

    async getInterviewDetails(interviewId) {
      return this.request(`/api/interviews/${interviewId}`, { method: 'GET' });
    }

    // ==========================================
    // Profile & Settings Endpoints
    // ==========================================
    async updateProfile(payload) {
      return this.request('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }

    async updatePassword(currentPassword, newPassword) {
      return this.request('/api/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
      });
    }

    async getSettings() {
      return this.request('/api/profile/settings', { method: 'GET' });
    }

    async updateSettings(payload) {
      return this.request('/api/profile/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    }
  }

  window.ResumeIQ_API = new API();
})();
