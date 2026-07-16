// Theme Management
(function () {
  const themeToggleBtn = document.getElementById('theme-toggle');
  
  // Get active theme from localStorage or system preference
  const getSavedTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme toggle icon
    if (themeToggleBtn) {
      const icon = themeToggleBtn.querySelector('i');
      if (icon) {
        if (theme === 'dark') {
          icon.className = 'fa-solid fa-sun';
          themeToggleBtn.title = 'Switch to Light Mode';
        } else {
          icon.className = 'fa-solid fa-moon';
          themeToggleBtn.title = 'Switch to Dark Mode';
        }
      }
    }
  };

  // Initial theme application
  const initialTheme = getSavedTheme();
  applyTheme(initialTheme);

  // Wait for DOM load to bind events
  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      // Re-apply to sync toggle icon
      applyTheme(getSavedTheme());
      
      themeBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Add a smooth switching transition class to body
        document.body.style.transition = 'background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease';
        
        applyTheme(newTheme);
        
        // Sync with API if user is logged in
        if (window.ResumeIQ_API && window.ResumeIQ_API.getToken()) {
          window.ResumeIQ_API.updateSettings({ theme: newTheme })
            .catch(err => console.error('Failed to sync theme preference with backend settings:', err));
        }
        
        // Clear transition styling after animation completes
        setTimeout(() => {
          document.body.style.transition = '';
        }, 500);
      });
    }
  });
})();
