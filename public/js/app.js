// ResumeIQ SPA Main Client Logic
document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================================================
  // 1. Core State & Elements
  // ==========================================================================
  const state = {
    user: null,
    resumes: [],            // List of root resumes (v1 series)
    currentResume: null,    // Currently active resume version
    currentReport: null,    // Currently active ATS report
    activeInterview: null,  // Active mock interview session details
    activeQuestionIdx: 0,   // Current question index in interview
    interviewTimer: null,   // Timer interval handler
    interviewTime: 0,       // Duration in seconds
    charts: {
      radar: null,
      line: null
    }
  };

  // Toast System
  const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Animate removal
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  };

  // Global Error Handler for UI Toast Feedback
  window.onerror = function (message, source, lineno, colno, error) {
    showToast(`UI System Error: ${message} (Line ${lineno})`, 'danger');
    return false;
  };

  // Profile Dropdown
  const dropdownTrigger = document.getElementById('profileDropdownTrigger');
  const dropdownMenu = document.getElementById('profileDropdownMenu');
  
  if (dropdownTrigger && dropdownMenu) {
    dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('show');
    });
  }

  // ==========================================================================
  // 2. SPA Client Router
  // ==========================================================================
  const views = {
    landing: document.getElementById('view-landing'),
    auth: document.getElementById('view-auth'),
    app: document.getElementById('view-app')
  };

  const authCards = {
    login: document.getElementById('auth-login-card'),
    signup: document.getElementById('auth-signup-card'),
    forgot: document.getElementById('auth-forgot-card'),
    reset: document.getElementById('auth-reset-card')
  };

  const tabs = {
    dashboard: document.getElementById('tab-dashboard'),
    upload: document.getElementById('tab-upload'),
    analysis: document.getElementById('tab-analysis'),
    builder: document.getElementById('tab-builder'),
    'job-match': document.getElementById('tab-job-match'),
    'social-audit': document.getElementById('tab-social-audit'),
    'mock-interview': document.getElementById('tab-mock-interview'),
    history: document.getElementById('tab-history'),
    settings: document.getElementById('tab-settings')
  };

  const routeHandler = async () => {
    const hash = window.location.hash || '#landing';
    const token = window.ResumeIQ_API.getToken();

    // Reset layout active states
    Object.values(views).forEach(v => v.classList.remove('active'));
    Object.values(authCards).forEach(c => c.classList.remove('active'));
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

    // 1. Unauthenticated landing hashes & anchor links
    if (hash === '#landing' || ['#features', '#how-it-works', '#faq'].includes(hash)) {
      if (token) {
        window.location.hash = '#dashboard';
        return;
      }
      views.landing.classList.add('active');

      // Scroll smoothly to the target section if it's an anchor link
      if (hash !== '#landing') {
        const target = document.querySelector(hash);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    // 2. Auth view card hashes
    if (['#login', '#signup', '#forgot', '#reset'].includes(hash)) {
      if (token) {
        window.location.hash = '#dashboard';
        return;
      }
      views.auth.classList.add('active');
      const cardName = hash.substring(1);
      authCards[cardName].classList.add('active');
      return;
    }

    // 3. Logout action
    if (hash === '#logout') {
      window.ResumeIQ_API.logout();
      state.user = null;
      showToast('Logged out successfully', 'success');
      window.location.hash = '#landing';
      return;
    }

    // 4. Authenticated dashboard hashes
    if (token) {
      views.app.classList.add('active');
      
      // Determine tab ID from hash
      const tabName = hash.substring(1);
      const activeTab = tabs[tabName] || tabs.dashboard;
      
      activeTab.classList.add('active');
      
      // Set active nav sidebar item
      const navItem = document.querySelector(`.nav-item[data-tab="tab-${tabName}"]`);
      if (navItem) {
        navItem.classList.add('active');
      }

      // Update header title
      const titleMap = {
        dashboard: 'Dashboard Overview',
        upload: 'ATS Resume Upload',
        analysis: 'Detailed ATS Analysis',
        builder: 'Resume Builder Canvas',
        'job-match': 'Job Description comparison',
        'social-audit': 'Social profile auditor',
        'mock-interview': 'Mock Interview simulator',
        history: 'Resume Version History',
        settings: 'Settings & Profile'
      };
      document.getElementById('current-view-title').innerText = titleMap[tabName] || 'Dashboard';

      // Load data based on tab routing
      if (!state.user) {
        await fetchUserProfile();
      }

      if (tabName === 'dashboard' || !tabName) {
        loadDashboardData();
      } else if (tabName === 'history') {
        loadHistoryData();
      } else if (tabName === 'builder') {
        initResumeBuilder();
      } else if (tabName === 'job-match') {
        populateResumeDropdowns('match-resume-select');
      } else if (tabName === 'social-audit') {
        populateReportsDropdown('audit-report-select');
      } else if (tabName === 'mock-interview') {
        populateResumeDropdowns('interview-resume-select');
        loadInterviewHistory();
      }
    } else {
      // Redirect to login if unauthenticated
      window.location.hash = '#login';
    }
  };

  window.addEventListener('hashchange', routeHandler);

  // Helper: Fetch Profile
  const fetchUserProfile = async () => {
    try {
      const data = await window.ResumeIQ_API.getMe();
      if (data.success) {
        state.user = data.user;
        
        // Update user names UI elements
        document.getElementById('sidebar-user-name').innerText = state.user.name;
        document.getElementById('sidebar-user-email').innerText = state.user.email;
        document.getElementById('dash-user-name').innerText = state.user.name;
        
        const initials = state.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('header-user-initials').innerText = initials;

        // Settings defaults
        document.getElementById('settings-name').value = state.user.name;
        document.getElementById('settings-email').value = state.user.email;
        document.getElementById('settings-linkedin').value = state.user.linkedinUrl || '';
        document.getElementById('settings-github').value = state.user.githubUrl || '';
        document.getElementById('settings-portfolio').value = state.user.portfolioUrl || '';
      }
    } catch (err) {
      console.error(err);
      window.ResumeIQ_API.logout();
      window.location.hash = '#login';
    }
  };

  // ==========================================================================
  // 3. User Authentication Submissions
  // ==========================================================================
  
  // Login
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    try {
      const data = await window.ResumeIQ_API.login(email, pass);
      if (data.success) {
        showToast('Login successful', 'success');
        window.location.hash = '#dashboard';
      }
    } catch (error) {
      showToast(error.message || 'Login failed. Check credentials.', 'danger');
    }
  });

  // Signup
  document.getElementById('form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-password').value;
    try {
      const data = await window.ResumeIQ_API.register(name, email, pass);
      if (data.success) {
        showToast('Registration successful', 'success');
        window.location.hash = '#dashboard';
      }
    } catch (error) {
      showToast(error.message || 'Registration failed.', 'danger');
    }
  });

  // Forgot password
  document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    try {
      const data = await window.ResumeIQ_API.forgotPassword(email);
      showToast(data.message, 'success');
      window.location.hash = '#login';
    } catch (error) {
      showToast(error.message, 'danger');
    }
  });

  // Logout trigger
  document.getElementById('btn-logout').addEventListener('click', () => {
    window.location.hash = '#logout';
  });

  // FAQ Accordions on landing
  document.querySelectorAll('.faq-question').forEach(item => {
    item.addEventListener('click', () => {
      item.parentElement.classList.toggle('active');
    });
  });

  // Resume Builder Accordion Sections Toggle
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      if (content && content.classList.contains('accordion-content')) {
        content.classList.toggle('active');
      }
    });
  });

  // Custom role/company dropdown triggers on Upload Tab
  const selectRole = document.getElementById('upload-role');
  const customRoleInput = document.getElementById('upload-custom-role');
  selectRole.addEventListener('change', () => {
    if (selectRole.value === 'Other') {
      customRoleInput.classList.remove('hidden');
      customRoleInput.required = true;
    } else {
      customRoleInput.classList.add('hidden');
      customRoleInput.required = false;
    }
  });

  const selectCompany = document.getElementById('upload-company');
  const customCompanyInput = document.getElementById('upload-custom-company');
  selectCompany.addEventListener('change', () => {
    if (selectCompany.value === 'Custom') {
      customCompanyInput.classList.remove('hidden');
      customCompanyInput.required = true;
    } else {
      customCompanyInput.classList.add('hidden');
      customCompanyInput.required = false;
    }
  });

  // ==========================================================================
  // 4. File Drag & Drop Upload
  // ==========================================================================
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadForm = document.getElementById('form-upload-resume');
  const uploadPreview = document.getElementById('upload-preview-container');
  const previewName = document.getElementById('preview-file-name');
  const previewSize = document.getElementById('preview-file-size');
  const removeFileBtn = document.getElementById('btn-remove-file');
  const submitUploadBtn = document.getElementById('btn-submit-upload');
  const uploadProgressBar = document.getElementById('upload-progress-bar');
  
  let selectedFile = null;

  dropZone.addEventListener('click', () => fileInput.click());
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  const handleFileSelection = (file) => {
    if (file.type !== 'application/pdf') {
      showToast('Only PDF files are supported', 'danger');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Maximum file size is 5MB', 'danger');
      return;
    }
    selectedFile = file;
    previewName.innerText = file.name;
    previewSize.innerText = `${(file.size / 1024).toFixed(1)} KB`;
    
    uploadPreview.classList.remove('hidden');
    submitUploadBtn.disabled = false;
  };

  removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    uploadPreview.classList.add('hidden');
    submitUploadBtn.disabled = true;
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    submitUploadBtn.disabled = true;
    uploadProgressBar.style.width = '20%';

    const formData = new FormData();
    formData.append('resume', selectedFile);
    
    // Grab target role
    let role = selectRole.value;
    if (role === 'Other') role = customRoleInput.value;
    formData.append('targetRole', role);

    // Grab target company
    let company = selectCompany.value;
    if (company === 'Custom') company = customCompanyInput.value;
    formData.append('targetCompany', company);

    uploadProgressBar.style.width = '50%';

    try {
      const data = await window.ResumeIQ_API.uploadResume(formData);
      uploadProgressBar.style.width = '100%';
      
      if (data.success) {
        showToast('Resume parsed and analyzed successfully!', 'success');
        
        // Save to state
        state.currentResume = data.resume;
        state.currentReport = data.report;

        // Reset inputs
        selectedFile = null;
        fileInput.value = '';
        uploadPreview.classList.add('hidden');
        uploadProgressBar.style.width = '0%';

        // Route to analysis detailed tab
        document.getElementById('nav-analysis').classList.remove('hidden');
        window.location.hash = '#analysis';
        
        // Fill Report Details
        renderAnalysisReport(data.report);
      }
    } catch (error) {
      uploadProgressBar.style.width = '0%';
      submitUploadBtn.disabled = false;
      showToast(error.message || 'Failed to upload and parse resume', 'danger');
    }
  });

  // ==========================================================================
  // 5. Render ATS Detailed Analysis Report
  // ==========================================================================
  const renderAnalysisReport = (report) => {
    if (!report) return;

    // TARGET
    document.getElementById('report-target-meta').innerText = `${report.targetCompany} | ${report.targetRole}`;
    
    // OVERALL SCORE
    document.getElementById('report-overall-score').innerText = `${report.overallScore}%`;
    const ring = document.getElementById('report-overall-ring');
    const offset = 440 - (440 * report.overallScore) / 100;
    ring.style.strokeDashoffset = offset;

    // BREAKDOWNS
    const breakdowns = [
      { id: 'formatting', score: report.scores.formatting },
      { id: 'skills', score: report.scores.skills },
      { id: 'experience', score: report.scores.experience },
      { id: 'education', score: report.scores.education },
      { id: 'keyword', score: report.scores.keyword },
      { id: 'readability', score: report.scores.readability }
    ];

    breakdowns.forEach(item => {
      document.getElementById(`score-${item.id}`).innerText = `${item.score}%`;
      const bar = document.getElementById(`bar-${item.id}`);
      bar.style.width = `${item.score}%`;
      bar.className = 'progress-bar';
      if (item.score < 50) bar.style.backgroundColor = 'var(--danger)';
      else if (item.score < 75) bar.style.backgroundColor = 'var(--warning)';
      else bar.style.backgroundColor = 'var(--success)';
    });

    // OVERVIEWS
    document.getElementById('report-summary').innerText = report.professionalSummary || 'No summary generated.';
    document.getElementById('report-ats-verdict').innerText = report.atsFeedback || 'No ATS feedback generated.';

    // STRENGTHS & WEAKNESSES
    const strengthsUl = document.getElementById('report-strengths-ul');
    strengthsUl.innerHTML = '';
    report.strengths.forEach(s => {
      const li = document.createElement('li');
      li.innerText = s;
      strengthsUl.appendChild(li);
    });

    const weaknessesUl = document.getElementById('report-weaknesses-ul');
    weaknessesUl.innerHTML = '';
    report.weaknesses.forEach(w => {
      const li = document.createElement('li');
      li.innerText = w;
      weaknessesUl.appendChild(li);
    });

    // KEYWORDS CLOUDS
    const matchedKeys = document.getElementById('report-matched-keywords');
    matchedKeys.innerHTML = '';
    report.keywords.matched.forEach(kw => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerText = kw;
      matchedKeys.appendChild(span);
    });

    const missingKeys = document.getElementById('report-missing-keywords');
    missingKeys.innerHTML = '';
    report.keywords.missing.forEach(kw => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerText = kw;
      missingKeys.appendChild(span);
    });

    // SKILLS CLOUDS
    const matchedS = document.getElementById('report-matched-skills');
    matchedS.innerHTML = '';
    report.skillsMatch.matched.forEach(sk => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerText = sk;
      matchedS.appendChild(span);
    });

    const missingS = document.getElementById('report-missing-skills');
    missingS.innerHTML = '';
    report.skillsMatch.missing.forEach(sk => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerText = sk;
      missingS.appendChild(span);
    });

    // REVIEWS
    document.getElementById('report-formatting-review').innerText = report.formattingReview || 'Parsed well.';
    document.getElementById('report-grammar-review').innerText = report.grammarReview || 'Correct spelling.';
    document.getElementById('report-project-analysis').innerText = report.projectAnalysis || 'Good tech projects.';

    // CHECKLIST SUGGESTIONS
    const checkUl = document.getElementById('report-priority-checklist');
    checkUl.innerHTML = '';
    report.priorityImprovements.forEach(item => {
      const li = document.createElement('li');
      li.innerText = item;
      checkUl.appendChild(li);
    });

    const certUl = document.getElementById('report-certifications-ul');
    certUl.innerHTML = '';
    report.certificationSuggestions.forEach(c => {
      const li = document.createElement('li');
      li.innerText = c;
      certUl.appendChild(li);
    });

    const careerUl = document.getElementById('report-career-ul');
    careerUl.innerHTML = '';
    report.careerSuggestions.forEach(c => {
      const li = document.createElement('li');
      li.innerText = c;
      careerUl.appendChild(li);
    });
  };

  // Analysis sub-tabs navigation
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const paneId = btn.getAttribute('data-subtab');
      document.getElementById(paneId).classList.add('active');
    });
  });

  // Share link copy
  document.getElementById('btn-copy-report-share').addEventListener('click', () => {
    const reportUrl = `${window.location.origin}/#analysis`;
    navigator.clipboard.writeText(reportUrl);
    showToast('Report URL copied to clipboard!', 'success');
  });

  // Print button
  document.getElementById('btn-print-report').addEventListener('click', () => {
    window.print();
  });

  // One-click optimizer button
  document.getElementById('btn-one-click-optimize').addEventListener('click', async () => {
    if (!state.currentResume) {
      showToast('No active resume loaded to optimize', 'warning');
      return;
    }
    const btn = document.getElementById('btn-one-click-optimize');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running Optimizer...`;
    
    try {
      const data = await window.ResumeIQ_API.optimizeResumeWithAI(state.currentResume._id);
      if (data.success) {
        showToast('Resume optimized successfully! Version history updated.', 'success');
        state.currentResume = data.resume;
        state.currentReport = data.report;
        
        // Re-render report details
        renderAnalysisReport(data.report);
        
        // Redirect to Resume Builder tab to display the optimized resume
        window.location.hash = '#builder';
      }
    } catch (e) {
      showToast(e.message || 'AI Optimizer failed.', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-rocket"></i> Run One-Click AI Optimizer`;
    }
  });

  // ==========================================================================
  // 6. Dashboards Loaders (Data, Line/Radar charts)
  // ==========================================================================
  const loadDashboardData = async () => {
    try {
      const data = await window.ResumeIQ_API.getResumes();
      if (data.success) {
        state.resumes = data.resumes;
        
        const tbody = document.getElementById('dash-resumes-tbody');
        tbody.innerHTML = '';

        if (state.resumes.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" class="empty-state-row">No resumes uploaded yet. Go to Upload.</td></tr>`;
          
          document.getElementById('dash-resume-name').innerText = 'No Resume Uploaded';
          document.getElementById('dash-resume-role').innerText = 'Select PDF to scan';
          document.getElementById('dash-ats-score').innerText = '0%';
          document.getElementById('dash-resume-company-badge').classList.add('hidden');
          
          initLineChart([]);
          initRadarChart({ matched: [], missing: [] });
          return;
        }

        // Display root V1 resumes in table
        state.resumes.forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${r.originalName}</strong></td>
            <td>${r.targetRole}</td>
            <td>${r.targetCompany}</td>
            <td><span class="badge badge-info" id="td-score-${r._id}">Loading...</span></td>
            <td>
              <button class="btn btn-secondary btn-sm btn-view-series" data-id="${r._id}"><i class="fa-solid fa-folder-open"></i> Open</button>
            </td>
          `;
          tbody.appendChild(tr);
          
          // Async load score for this resume series
          window.ResumeIQ_API.getReportByResume(r._id)
            .then(res => {
              if (res.success) {
                const badge = document.getElementById(`td-score-${r._id}`);
                if (badge) {
                  badge.innerText = `${res.report.overallScore}%`;
                  if (res.report.overallScore >= 80) badge.className = 'badge badge-success';
                  else if (res.report.overallScore < 50) badge.className = 'badge badge-danger';
                  else badge.className = 'badge badge-warning';
                }
              }
            }).catch(() => {});
        });

        // Set top dashboard block to reflect the latest resume
        const latest = state.resumes[0];
        document.getElementById('dash-resume-name').innerText = latest.originalName;
        document.getElementById('dash-resume-role').innerText = latest.targetRole;
        
        const badge = document.getElementById('dash-resume-company-badge');
        badge.innerText = latest.targetCompany;
        badge.classList.remove('hidden');

        // Fetch details of latest report to draw graphs and score circle
        const latestReport = await window.ResumeIQ_API.getReportByResume(latest._id);
        if (latestReport.success) {
          state.currentResume = latest;
          state.currentReport = latestReport.report;

          // Enable detailed analysis link
          document.getElementById('nav-analysis').classList.remove('hidden');

          // Score Ring
          document.getElementById('dash-ats-score').innerText = `${state.currentReport.overallScore}%`;
          const ring = document.getElementById('dash-score-ring');
          const offset = 314 - (314 * state.currentReport.overallScore) / 100;
          ring.style.strokeDashoffset = offset;

          // Skill Competencies Radar
          initRadarChart(state.currentReport.skillsMatch);
        }

        // Draw Line Chart
        const trends = await window.ResumeIQ_API.getAnalysisTrends();
        if (trends.success) {
          initLineChart(trends.trends);
        }

        // Bind row clicks
        document.querySelectorAll('.btn-view-series').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id');
            const rootReport = await window.ResumeIQ_API.getReportByResume(id);
            if (rootReport.success) {
              state.currentReport = rootReport.report;
              // Fetch detailed resume version
              const resDetails = await window.ResumeIQ_API.getResumeDetails(rootReport.report.resume);
              state.currentResume = resDetails.resume;

              renderAnalysisReport(rootReport.report);
              document.getElementById('nav-analysis').classList.remove('hidden');
              window.location.hash = '#analysis';
            }
          });
        });

      }
    } catch (error) {
      console.error('Dashboard loading failed:', error);
    }
  };

  // Radar chart
  const initRadarChart = (skillsMatch) => {
    const ctx = document.getElementById('chart-competency');
    if (!ctx) return;

    if (state.charts.radar) {
      state.charts.radar.destroy();
    }

    const matchedCount = skillsMatch.matched.length;
    const missingCount = skillsMatch.missing.length;

    const data = {
      labels: ['Technical Coverage', 'Soft Skills', 'Certifications', 'Experience', 'Layout Structure'],
      datasets: [{
        label: 'Current Competency',
        data: [
          matchedCount > 0 ? Math.min(50 + matchedCount * 8, 100) : 40,
          85, // soft skills default baseline
          matchedCount > 4 ? 90 : 60,
          state.currentReport ? state.currentReport.scores.experience : 50,
          state.currentReport ? state.currentReport.scores.formatting : 60
        ],
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(59, 130, 246)'
      }]
    };

    state.charts.radar = new Chart(ctx, {
      type: 'radar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          r: {
            angleLines: { display: true, color: 'rgba(255,255,255,0.05)' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            pointLabels: { color: 'var(--muted)', font: { size: 9 } },
            ticks: { display: false },
            suggestedMin: 20,
            suggestedMax: 100
          }
        }
      }
    });
  };

  // Line chart
  const initLineChart = (trendList) => {
    const ctx = document.getElementById('chart-trends');
    if (!ctx) return;

    if (state.charts.line) {
      state.charts.line.destroy();
    }

    // Sort/Filter trendList to get a clean timeline
    const labels = trendList.map(t => `${t.date} (${t.version})`);
    const scores = trendList.map(t => t.overallScore);

    // If no values
    if (labels.length === 0) {
      labels.push('Launch');
      scores.push(0);
    }

    state.charts.line = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'ATS Score',
          data: scores,
          fill: false,
          borderColor: 'rgb(45, 212, 191)',
          tension: 0.2,
          pointRadius: 4,
          pointBackgroundColor: 'var(--accent)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: 'var(--muted)', font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: 'var(--muted)', font: { size: 9 } },
            min: 0,
            max: 100
          }
        }
      }
    });
  };

  // ==========================================================================
  // 7. Resume Builder & Template Sync
  // ==========================================================================
  const builderForm = document.getElementById('form-resume-builder');
  const templateSelect = document.getElementById('template-select');
  const canvas = document.getElementById('resume-canvas');
  
  const initResumeBuilder = async () => {
    if (!state.currentResume) {
      showToast('Upload a resume first to build templates.', 'warning');
      window.location.hash = '#upload';
      return;
    }

    // Refresh state from DB
    try {
      const data = await window.ResumeIQ_API.getResumeDetails(state.currentResume._id);
      if (data.success) {
        state.currentResume = data.resume;
        populateBuilderForm(data.resume.parsedData);
        renderResumeCanvas();
      }
    } catch (e) {
      console.error(e);
      showToast(`Error syncing Resume Builder: ${e.message}`, 'danger');
    }
  };

  const populateBuilderForm = (parsedData) => {
    if (!parsedData) return;
    
    // Contact
    document.getElementById('build-name').value = parsedData.personalInfo?.name || '';
    document.getElementById('build-email').value = parsedData.personalInfo?.email || '';
    document.getElementById('build-phone').value = parsedData.personalInfo?.phone || '';
    document.getElementById('build-location').value = parsedData.personalInfo?.location || '';
    document.getElementById('build-website').value = parsedData.personalInfo?.website || '';

    // Summary
    document.getElementById('build-summary').value = parsedData.summary || '';

    // Experience list
    const expContainer = document.getElementById('builder-experience-list');
    expContainer.innerHTML = '';
    if (parsedData.experience) {
      parsedData.experience.forEach((exp, idx) => {
        addExperienceFormCard(exp, idx);
      });
    }

    // Projects list
    const projContainer = document.getElementById('builder-projects-list');
    projContainer.innerHTML = '';
    if (parsedData.projects) {
      parsedData.projects.forEach((proj, idx) => {
        addProjectFormCard(proj, idx);
      });
    }

    // Education list
    const eduContainer = document.getElementById('builder-education-list');
    eduContainer.innerHTML = '';
    if (parsedData.education) {
      parsedData.education.forEach((edu, idx) => {
        addEducationFormCard(edu, idx);
      });
    }

    // Skills
    document.getElementById('build-skills-tech').value = parsedData.skills?.technical?.join(', ') || '';
    document.getElementById('build-skills-soft').value = parsedData.skills?.soft?.join(', ') || '';
    document.getElementById('build-skills-languages').value = parsedData.skills?.languages?.join(', ') || '';
  };

  // Helper form builders
  const addExperienceFormCard = (exp = {}, index) => {
    const container = document.getElementById('builder-experience-list');
    const card = document.createElement('div');
    card.className = 'dynamic-item-card';
    card.innerHTML = `
      <button type="button" class="btn-delete-item btn-del-exp"><i class="fa-solid fa-trash"></i></button>
      <div class="form-row-2">
        <div class="form-group">
          <label>Company</label>
          <input type="text" class="form-input exp-company" value="${exp.company || ''}">
        </div>
        <div class="form-group">
          <label>Role</label>
          <input type="text" class="form-input exp-role" value="${exp.role || ''}">
        </div>
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>Start Date</label>
          <input type="text" class="form-input exp-start" value="${exp.startDate || ''}">
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="text" class="form-input exp-end" value="${exp.endDate || ''}" ${exp.current ? 'disabled' : ''}>
        </div>
      </div>
      <div class="form-group">
        <label class="checkbox-container">
          <input type="checkbox" class="exp-current" ${exp.current ? 'checked' : ''}>
          <span class="checkmark"></span> Current Role
        </label>
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-textarea exp-desc" rows="3">${exp.description || ''}</textarea>
      </div>
    `;
    container.appendChild(card);

    // Bind current toggle
    const currentCheck = card.querySelector('.exp-current');
    const endDateInput = card.querySelector('.exp-end');
    currentCheck.addEventListener('change', (e) => {
      endDateInput.disabled = e.target.checked;
      if (e.target.checked) endDateInput.value = '';
      renderResumeCanvas();
    });

    // Delete bind
    card.querySelector('.btn-del-exp').addEventListener('click', () => {
      card.remove();
      renderResumeCanvas();
    });

    // Instantly bind input changes
    card.querySelectorAll('.form-input, .form-textarea').forEach(el => {
      el.addEventListener('input', renderResumeCanvas);
    });
  };

  const addProjectFormCard = (proj = {}, index) => {
    const container = document.getElementById('builder-projects-list');
    const card = document.createElement('div');
    card.className = 'dynamic-item-card';
    card.innerHTML = `
      <button type="button" class="btn-delete-item btn-del-proj"><i class="fa-solid fa-trash"></i></button>
      <div class="form-row-2">
        <div class="form-group">
          <label>Project Title</label>
          <input type="text" class="form-input proj-title" value="${proj.title || ''}">
        </div>
        <div class="form-group">
          <label>Technologies Used</label>
          <input type="text" class="form-input proj-tech" value="${proj.technologies?.join(', ') || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Project URL</label>
        <input type="text" class="form-input proj-url" value="${proj.url || ''}">
      </div>
      <div class="form-group">
        <label>Project Description</label>
        <textarea class="form-textarea proj-desc" rows="2">${proj.description || ''}</textarea>
      </div>
    `;
    container.appendChild(card);

    card.querySelector('.btn-del-proj').addEventListener('click', () => {
      card.remove();
      renderResumeCanvas();
    });

    card.querySelectorAll('.form-input, .form-textarea').forEach(el => {
      el.addEventListener('input', renderResumeCanvas);
    });
  };

  const addEducationFormCard = (edu = {}, index) => {
    const container = document.getElementById('builder-education-list');
    const card = document.createElement('div');
    card.className = 'dynamic-item-card';
    card.innerHTML = `
      <button type="button" class="btn-delete-item btn-del-edu"><i class="fa-solid fa-trash"></i></button>
      <div class="form-row-2">
        <div class="form-group">
          <label>School / University</label>
          <input type="text" class="form-input edu-school" value="${edu.school || ''}">
        </div>
        <div class="form-group">
          <label>Degree</label>
          <input type="text" class="form-input edu-degree" value="${edu.degree || ''}">
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label>Field of Study</label>
          <input type="text" class="form-input edu-field" value="${edu.fieldOfStudy || ''}">
        </div>
        <div class="form-group">
          <label>Graduation Year</label>
          <input type="text" class="form-input edu-end" value="${edu.endDate || ''}">
        </div>
        <div class="form-group">
          <label>GPA</label>
          <input type="text" class="form-input edu-gpa" value="${edu.gpa || ''}">
        </div>
      </div>
    `;
    container.appendChild(card);

    card.querySelector('.btn-del-edu').addEventListener('click', () => {
      card.remove();
      renderResumeCanvas();
    });

    card.querySelectorAll('.form-input, .form-textarea').forEach(el => {
      el.addEventListener('input', renderResumeCanvas);
    });
  };

  // Bind Add Buttons
  document.getElementById('btn-add-experience').addEventListener('click', () => addExperienceFormCard({}, Date.now()));
  document.getElementById('btn-add-project').addEventListener('click', () => addProjectFormCard({}, Date.now()));
  document.getElementById('btn-add-education').addEventListener('click', () => addEducationFormCard({}, Date.now()));

  // Bind key inputs to re-draw canvas
  document.querySelectorAll('#form-resume-builder input, #form-resume-builder textarea').forEach(input => {
    input.addEventListener('input', renderResumeCanvas);
  });

  templateSelect.addEventListener('change', () => {
    canvas.className = `resume-canvas template-${templateSelect.value}`;
    renderResumeCanvas();
  });

  // Export PDF trigger
  document.getElementById('btn-download-resume').addEventListener('click', () => {
    window.print();
  });

  // Extract current structured form values
  function getBuilderFormData() {
    const expCards = document.querySelectorAll('#builder-experience-list .dynamic-item-card');
    const experience = Array.from(expCards).map(card => ({
      company: card.querySelector('.exp-company').value,
      role: card.querySelector('.exp-role').value,
      startDate: card.querySelector('.exp-start').value,
      endDate: card.querySelector('.exp-end').value,
      current: card.querySelector('.exp-current').checked,
      description: card.querySelector('.exp-desc').value
    }));

    const projCards = document.querySelectorAll('#builder-projects-list .dynamic-item-card');
    const projects = Array.from(projCards).map(card => ({
      title: card.querySelector('.proj-title').value,
      technologies: card.querySelector('.proj-tech').value.split(',').map(s => s.trim()).filter(s => s.length > 0),
      url: card.querySelector('.proj-url').value,
      description: card.querySelector('.proj-desc').value
    }));

    const eduCards = document.querySelectorAll('#builder-education-list .dynamic-item-card');
    const education = Array.from(eduCards).map(card => ({
      school: card.querySelector('.edu-school').value,
      degree: card.querySelector('.edu-degree').value,
      fieldOfStudy: card.querySelector('.edu-field').value,
      endDate: card.querySelector('.edu-end').value,
      gpa: card.querySelector('.edu-gpa').value
    }));

    return {
      personalInfo: {
        name: document.getElementById('build-name').value,
        email: document.getElementById('build-email').value,
        phone: document.getElementById('build-phone').value,
        location: document.getElementById('build-location').value,
        website: document.getElementById('build-website').value
      },
      summary: document.getElementById('build-summary').value,
      experience,
      projects,
      education,
      skills: {
        technical: document.getElementById('build-skills-tech').value.split(',').map(s => s.trim()).filter(s => s.length > 0),
        soft: document.getElementById('build-skills-soft').value.split(',').map(s => s.trim()).filter(s => s.length > 0),
        languages: document.getElementById('build-skills-languages').value.split(',').map(s => s.trim()).filter(s => s.length > 0)
      }
    };
  };

  // Compile and draw HTML content on the canvas
  function renderResumeCanvas() {
    const data = getBuilderFormData();
    const style = templateSelect.value;
    
    let html = '';

    if (style === 'minimalist') {
      html = `
        <h1>${data.personalInfo.name || 'Your Name'}</h1>
        <div class="resume-contact">
          ${data.personalInfo.email || 'name@domain.com'} &nbsp;|&nbsp; 
          ${data.personalInfo.phone || 'Phone'} &nbsp;|&nbsp; 
          ${data.personalInfo.location || 'Location'} &nbsp;|&nbsp; 
          ${data.personalInfo.website || 'Portfolio'}
        </div>
        
        ${data.summary ? `
          <div class="resume-section-title">Professional Summary</div>
          <div style="font-size: 9.5pt; color: #2D3748; margin-bottom:12px;">${data.summary}</div>
        ` : ''}

        ${data.skills.technical.length > 0 || data.skills.soft.length > 0 ? `
          <div class="resume-section-title">Technical Expertise</div>
          <div style="font-size: 9.5pt; color: #2D3748; margin-bottom:12px;">
            ${data.skills.technical.length > 0 ? `<strong>Languages & Frameworks:</strong> ${data.skills.technical.join(', ')}<br>` : ''}
            ${data.skills.soft.length > 0 ? `<strong>Competencies:</strong> ${data.skills.soft.join(', ')}` : ''}
          </div>
        ` : ''}

        ${data.experience.length > 0 ? `
          <div class="resume-section-title">Experience</div>
          ${data.experience.map(exp => `
            <div class="exp-row">
              <span>${exp.role || 'Role'} at ${exp.company || 'Company'}</span>
              <span>${exp.startDate || 'Start'} – ${exp.current ? 'Present' : (exp.endDate || 'End')}</span>
            </div>
            <div class="exp-desc">${exp.description}</div>
          `).join('')}
        ` : ''}

        ${data.projects.length > 0 ? `
          <div class="resume-section-title">Projects</div>
          ${data.projects.map(p => `
            <div class="proj-row">
              <span>${p.title || 'Project'} ${p.technologies.length > 0 ? `(${p.technologies.join(', ')})` : ''}</span>
              <span>${p.url ? `<a href="${p.url}" target="_blank">${p.url}</a>` : ''}</span>
            </div>
            <div class="exp-desc" style="margin-top: 4px;">${p.description}</div>
          `).join('')}
        ` : ''}

        ${data.education.length > 0 ? `
          <div class="resume-section-title">Education</div>
          ${data.education.map(edu => `
            <div class="exp-row">
              <span>${edu.degree || 'Degree'} in ${edu.fieldOfStudy || 'Field'}</span>
              <span>${edu.endDate || 'Year'}</span>
            </div>
            <div style="font-size: 9.5pt; color:#4A5568; margin-bottom: 8px;">
              ${edu.school || 'School'} ${edu.gpa ? `&nbsp;|&nbsp; GPA: ${edu.gpa}` : ''}
            </div>
          `).join('')}
        ` : ''}
      `;
    } else if (style === 'executive') {
      html = `
        <div class="left-side">
          <div style="font-weight: 800; font-size: 14pt; line-height: 1.2; margin-bottom: 12px; color: #2B6CB0;">
            ${data.personalInfo.name || 'Your Name'}
          </div>
          <div style="font-size: 8.5pt; color: #4A5568; display:flex; flex-direction:column; gap:6px; margin-bottom:20px;">
            <span><i class="fa-solid fa-envelope"></i> ${data.personalInfo.email || 'Email'}</span>
            <span><i class="fa-solid fa-phone"></i> ${data.personalInfo.phone || 'Phone'}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${data.personalInfo.location || 'Location'}</span>
            <span><i class="fa-solid fa-globe"></i> ${data.personalInfo.website || 'Portfolio'}</span>
          </div>

          <div class="resume-section-title">Core Skills</div>
          <div style="font-size: 8.5pt; display: flex; flex-direction: column; gap: 8px; margin-top:8px;">
            <div><strong>Tech:</strong><br>${data.skills.technical.join(', ')}</div>
            <div><strong>Soft:</strong><br>${data.skills.soft.join(', ')}</div>
            <div><strong>Languages:</strong><br>${data.skills.languages.join(', ')}</div>
          </div>
        </div>
        <div class="right-side">
          ${data.summary ? `
            <div class="resume-section-title" style="margin-top:0;">Professional Summary</div>
            <div style="font-size: 9pt; color:#2D3748; margin-bottom: 16px;">${data.summary}</div>
          ` : ''}

          ${data.experience.length > 0 ? `
            <div class="resume-section-title">Professional Experience</div>
            ${data.experience.map(exp => `
              <div style="display:flex; justify-content:space-between; font-weight:700; font-size:9.5pt;">
                <span>${exp.role || 'Role'}</span>
                <span style="color:#718096; font-size:8.5pt;">${exp.startDate || 'Start'} – ${exp.current ? 'Present' : (exp.endDate || 'End')}</span>
              </div>
              <div style="color:#2B6CB0; font-size:8.5rem; font-weight:600; margin-bottom:4px;">${exp.company}</div>
              <div style="font-size: 8.5pt; color:#4A5568; white-space:pre-line; margin-bottom:12px;">${exp.description}</div>
            `).join('')}
          ` : ''}

          ${data.projects.length > 0 ? `
            <div class="resume-section-title">Projects Showcase</div>
            ${data.projects.map(p => `
              <div style="display:flex; justify-content:space-between; font-weight:700; font-size:9.5pt;">
                <span>${p.title || 'Project'}</span>
                <span style="color:#718096; font-size:8.5pt;">${p.url ? 'Link' : ''}</span>
              </div>
              <div style="font-size:8.5pt; color:#2D3748; margin-bottom:8px; white-space:pre-line;">
                <em>Tech: ${p.technologies.join(', ')}</em><br>${p.description}
              </div>
            `).join('')}
          ` : ''}

          ${data.education.length > 0 ? `
            <div class="resume-section-title">Education</div>
            ${data.education.map(edu => `
              <div style="display:flex; justify-content:space-between; font-weight:700; font-size:9.5pt;">
                <span>${edu.degree || 'Degree'}</span>
                <span style="color:#718096; font-size:8.5pt;">${edu.endDate || 'Year'}</span>
              </div>
              <div style="font-size:8.5pt; color:#4A5568;">
                ${edu.school || 'School'} ${edu.gpa ? `| GPA: ${edu.gpa}` : ''}
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
    } else { // tech grid template
      html = `
        <div class="header-grid">
          <h1 style="margin: 0; font-weight: 800; font-size: 22pt;">${data.personalInfo.name || 'Your Name'}</h1>
          <div style="font-size: 8.5pt; color:#4A5568; display:flex; gap:16px; margin-top:8px; flex-wrap:wrap;">
            <span><i class="fa-solid fa-envelope" style="color:#2C7A7B;"></i> ${data.personalInfo.email || 'Email'}</span>
            <span><i class="fa-solid fa-phone" style="color:#2C7A7B;"></i> ${data.personalInfo.phone || 'Phone'}</span>
            <span><i class="fa-solid fa-location-dot" style="color:#2C7A7B;"></i> ${data.personalInfo.location || 'Location'}</span>
            <span><i class="fa-solid fa-globe" style="color:#2C7A7B;"></i> ${data.personalInfo.website || 'Portfolio'}</span>
          </div>
        </div>

        ${data.summary ? `
          <div class="resume-section-title"><i class="fa-solid fa-id-badge"></i> Profile</div>
          <div style="font-size: 9pt; color:#2D3748; margin-bottom: 16px;">${data.summary}</div>
        ` : ''}

        ${data.skills.technical.length > 0 || data.skills.soft.length > 0 ? `
          <div class="resume-section-title"><i class="fa-solid fa-cubes"></i> Skill Set</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:8.5pt; margin-bottom:16px; background:#F7FAFC; padding:12px;">
            <div><strong>Tech Stack:</strong><br>${data.skills.technical.join(', ')}</div>
            <div><strong>Methodologies:</strong><br>${data.skills.soft.join(', ')}</div>
          </div>
        ` : ''}

        ${data.experience.length > 0 ? `
          <div class="resume-section-title"><i class="fa-solid fa-history"></i> Career Timeline</div>
          ${data.experience.map(exp => `
            <div style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; font-weight:700; font-size:10pt; color:#2C7A7B;">
                <span>${exp.role || 'Role'}</span>
                <span>${exp.startDate || 'Start'} – ${exp.current ? 'Present' : (exp.endDate || 'End')}</span>
              </div>
              <div style="font-weight:600; font-size:9pt; color:#4A5568; margin-bottom:4px;">${exp.company}</div>
              <div style="font-size:8.5pt; color:#2D3748; white-space:pre-line;">${exp.description}</div>
            </div>
          `).join('')}
        ` : ''}

        ${data.projects.length > 0 ? `
          <div class="resume-section-title"><i class="fa-solid fa-code"></i> Engineering Projects</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:8.5pt;">
            ${data.projects.map(p => `
              <div style="border:1px solid #E2E8F0; padding:12px; border-radius:4px;">
                <div style="font-weight:700; color:#2C7A7B; margin-bottom:4px;">${p.title}</div>
                <div style="color:#718096; font-size:8pt; margin-bottom:4px;">Tech: ${p.technologies.join(', ')}</div>
                <div style="color:#2D3748; font-size:8.5pt;">${p.description}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    }

    canvas.innerHTML = html;
  };

  // Submit/Save edited version to Backend
  builderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.currentResume) return;

    try {
      const payload = {
        parsedData: getBuilderFormData(),
        targetRole: state.currentResume.targetRole,
        targetCompany: state.currentResume.targetCompany
      };
      
      const data = await window.ResumeIQ_API.createResumeVersion(state.currentResume._id, payload);
      if (data.success) {
        showToast(`Saved version v${data.resume.version} successfully!`, 'success');
        state.currentResume = data.resume;
        state.currentReport = data.report;
        
        // Render new report details
        renderAnalysisReport(data.report);
      }
    } catch (err) {
      showToast(err.message || 'Failed to save resume version', 'danger');
    }
  });
  // Helper dropdown populator
  const populateResumeDropdowns = async (selectId) => {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
      const data = await window.ResumeIQ_API.getResumes();
      if (data.success) {
        select.innerHTML = '<option value="" disabled selected>Choose a Resume...</option>';
        data.resumes.forEach(r => {
          select.innerHTML += `<option value="${r._id}">${r.originalName} (${r.targetRole})</option>`;
        });
      }
    } catch (e) {
      console.error(e);
      showToast(`Error loading resumes dropdown: ${e.message}`, 'danger');
    }
  };

  const populateReportsDropdown = async (selectId) => {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
      const data = await window.ResumeIQ_API.getAnalysisHistory();
      if (data.success) {
        select.innerHTML = '<option value="" disabled selected>Select reference analysis...</option>';
        data.reports.forEach(rep => {
          if (rep.resume) {
            select.innerHTML += `<option value="${rep._id}">Report: ${rep.resume.originalName} v${rep.resume.version} (${rep.targetCompany})</option>`;
          }
        });
      }
    } catch (e) {
      console.error(e);
      showToast(`Error loading analysis reports dropdown: ${e.message}`, 'danger');
    }
  };
  // ==========================================================================
  // 8. Job Description Comparison
  // ==========================================================================
  const jobMatchForm = document.getElementById('form-job-match');
  
  jobMatchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const resumeId = document.getElementById('match-resume-select').value;
    const jobTitle = document.getElementById('match-job-title').value;
    const company = document.getElementById('match-company').value;
    const jdText = document.getElementById('match-jd-text').value;

    if (!resumeId) {
      showToast('Please select a resume version', 'warning');
      return;
    }

    const submitBtn = jobMatchForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing Job Match...`;

    try {
      const data = await window.ResumeIQ_API.matchJobDescription({
        resumeId,
        jobTitle,
        company,
        jobDescriptionText: jdText
      });

      if (data.success) {
        showToast('Job Description comparison analysis ready!', 'success');
        document.getElementById('match-empty-state').classList.add('hidden');
        const resultsBox = document.getElementById('match-results-card');
        resultsBox.classList.remove('hidden');

        // Score Ring
        const percentage = data.jobMatch.matchPercentage;
        document.getElementById('match-percentage-score').innerText = `${percentage}%`;
        const ring = document.getElementById('match-score-ring');
        const offset = 314 - (314 * percentage) / 100;
        ring.style.strokeDashoffset = offset;

        // Details
        document.getElementById('match-results-role-company').innerText = `${data.jobMatch.jobTitle} at ${data.jobMatch.company}`;
        document.getElementById('match-role-fit').innerText = data.jobMatch.roleFit;

        // Missing cloud keywords
        const keywordsBox = document.getElementById('match-missing-keywords');
        keywordsBox.innerHTML = '';
        data.jobMatch.missingKeywords.forEach(kw => {
          keywordsBox.innerHTML += `<span class="tag">${kw}</span>`;
        });

        const skillsBox = document.getElementById('match-missing-skills');
        skillsBox.innerHTML = '';
        data.jobMatch.missingSkills.forEach(sk => {
          skillsBox.innerHTML += `<span class="tag">${sk}</span>`;
        });

        document.getElementById('match-ats-suggestions').innerText = data.jobMatch.atsSuggestions;

        // Learning roadmap timeline & steps
        document.getElementById('match-roadmap-timeline').innerText = data.jobMatch.learningRoadmap.timeline || '4 weeks';
        const stepsUl = document.getElementById('match-roadmap-steps-ul');
        stepsUl.innerHTML = '';
        data.jobMatch.learningRoadmap.steps.forEach(step => {
          stepsUl.innerHTML += `<li>${step}</li>`;
        });

        // Setup AI Cover letter generate button bindings
        const letterBtn = document.getElementById('btn-generate-cover-letter');
        const letterContainer = document.getElementById('cover-letter-container');
        const letterTextarea = document.getElementById('cover-letter-text');
        
        letterContainer.classList.add('hidden'); // Clear previous
        letterBtn.disabled = false;
        letterBtn.innerHTML = `<i class="fa-solid fa-signature"></i> Create Letter`;

        // Unbind any previous events
        const clone = letterBtn.cloneNode(true);
        letterBtn.parentNode.replaceChild(clone, letterBtn);
        
        clone.addEventListener('click', async () => {
          const tone = document.getElementById('cover-letter-tone').value;
          clone.disabled = true;
          clone.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Writing Letter...`;
          try {
            const res = await window.ResumeIQ_API.generateCoverLetter(resumeId, jdText, tone);
            if (res.success && res.coverLetter) {
              showToast('Cover letter written successfully!', 'success');
              letterTextarea.value = res.coverLetter;
              letterContainer.classList.remove('hidden');
            }
          } catch (err) {
            showToast('Failed to generate cover letter.', 'danger');
          } finally {
            clone.disabled = false;
            clone.innerHTML = `<i class="fa-solid fa-signature"></i> Create Letter`;
          }
        });

        // Copy cover letter text
        document.getElementById('btn-copy-cover-letter').addEventListener('click', () => {
          navigator.clipboard.writeText(letterTextarea.value);
          showToast('Cover letter copied to clipboard!', 'success');
        });

      }
    } catch (err) {
      showToast(err.message || 'Job match analysis failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart"></i> Compare Resume with JD`;
    }
  });

  // ==========================================================================
  // 9. Social Auditor Audit
  // ==========================================================================
  const socialAuditForm = document.getElementById('form-social-audit');

  socialAuditForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const reportId = document.getElementById('audit-report-select').value;
    const linkedinUrl = document.getElementById('audit-linkedin').value;
    const githubUrl = document.getElementById('audit-github').value;
    const portfolioUrl = document.getElementById('audit-portfolio').value;
    const userProvidedBio = document.getElementById('audit-bio-text').value;

    if (!reportId) {
      showToast('Select a reference analysis report', 'warning');
      return;
    }

    const submitBtn = socialAuditForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running Social Review...`;

    try {
      const data = await window.ResumeIQ_API.runSocialAudit({
        reportId,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        userProvidedBio
      });

      if (data.success) {
        showToast('Social marketing audit critiques ready!', 'success');
        document.getElementById('social-empty-state').classList.add('hidden');
        document.getElementById('social-results-cards').classList.remove('hidden');

        // LinkedIn
        document.getElementById('badge-score-linkedin').innerText = `${data.socialAnalysis.linkedin.score}/100`;
        document.getElementById('critique-linkedin').innerText = data.socialAnalysis.linkedin.critique;
        const linkedinUl = document.getElementById('suggestions-linkedin');
        linkedinUl.innerHTML = '';
        data.socialAnalysis.linkedin.suggestions.forEach(s => {
          linkedinUl.innerHTML += `<li>${s}</li>`;
        });

        // GitHub
        document.getElementById('badge-score-github').innerText = `${data.socialAnalysis.github.score}/100`;
        document.getElementById('critique-github').innerText = data.socialAnalysis.github.critique;
        const githubUl = document.getElementById('suggestions-github');
        githubUl.innerHTML = '';
        data.socialAnalysis.github.suggestions.forEach(s => {
          githubUl.innerHTML += `<li>${s}</li>`;
        });

        // Portfolio
        document.getElementById('badge-score-portfolio').innerText = `${data.socialAnalysis.portfolio.score}/100`;
        document.getElementById('critique-portfolio').innerText = data.socialAnalysis.portfolio.critique;
        const portfolioUl = document.getElementById('suggestions-portfolio');
        portfolioUl.innerHTML = '';
        data.socialAnalysis.portfolio.suggestions.forEach(s => {
          portfolioUl.innerHTML += `<li>${s}</li>`;
        });
      }
    } catch (err) {
      showToast(err.message || 'Social audit failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Run Social Audit`;
    }
  });

  // ==========================================================================
  // 10. AI Mock Interview Simulator
  // ==========================================================================
  const startInterviewForm = document.getElementById('form-start-interview');
  const boardEmptyState = document.getElementById('interview-empty-state');
  const activeBoard = document.getElementById('interview-active-board');
  const activeMeta = document.getElementById('interview-active-meta');
  const trackerText = document.getElementById('interview-question-tracker');
  const timerText = document.getElementById('interview-timer');
  const questionText = document.getElementById('interview-question-text');
  const questionCategory = document.getElementById('interview-question-category');
  const answerForm = document.getElementById('form-submit-answer');
  const answerTextarea = document.getElementById('interview-user-answer');
  
  const evalCard = document.getElementById('interview-evaluation-box');
  const evalScore = document.getElementById('evaluation-question-score');
  const evalStrengths = document.getElementById('evaluation-strengths');
  const evalWeaknesses = document.getElementById('evaluation-weaknesses');
  const evalSuggestions = document.getElementById('evaluation-suggestions');
  const btnNext = document.getElementById('btn-next-question');
  const completedBox = document.getElementById('interview-completed-box');

  const startInterviewTimer = () => {
    state.interviewTime = 0;
    clearInterval(state.interviewTimer);
    state.interviewTimer = setInterval(() => {
      state.interviewTime++;
      const mins = Math.floor(state.interviewTime / 60).toString().padStart(2, '0');
      const secs = (state.interviewTime % 60).toString().padStart(2, '0');
      timerText.innerText = `${mins}:${secs}`;
    }, 1000);
  };

  const stopInterviewTimer = () => {
    clearInterval(state.interviewTimer);
  };

  startInterviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const resumeId = document.getElementById('interview-resume-select').value;
    const targetRole = document.getElementById('interview-role').value;
    const targetCompany = document.getElementById('interview-company').value || 'Any';

    if (!resumeId) {
      showToast('Select a resume version first', 'warning');
      return;
    }

    const submitBtn = startInterviewForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating Questions...`;

    try {
      const data = await window.ResumeIQ_API.startMockInterview(resumeId, targetRole, targetCompany);
      if (data.success) {
        showToast('Questions generated successfully! Start simulation.', 'success');
        state.activeInterview = data.interview;
        state.activeQuestionIdx = 0;

        boardEmptyState.classList.add('hidden');
        activeBoard.classList.remove('hidden');
        completedBox.classList.add('hidden');
        evalCard.classList.add('hidden');
        document.getElementById('interview-response-box').classList.remove('hidden');

        activeMeta.innerText = `${data.interview.targetCompany} | ${data.interview.targetRole}`;
        
        startInterviewTimer();
        renderCurrentQuestion();
      }
    } catch (err) {
      showToast('Mock Interview generation failed.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-play"></i> Launch Interview`;
    }
  });

  const renderCurrentQuestion = () => {
    const questions = state.activeInterview.questions;
    const currentQ = questions[state.activeQuestionIdx];

    trackerText.innerText = `Question ${state.activeQuestionIdx + 1} of ${questions.length}`;
    questionCategory.innerText = currentQ.category;
    questionText.innerText = currentQ.questionText;
    
    // Clear answer field
    answerTextarea.value = '';
    
    // Hide evaluation panel
    evalCard.classList.add('hidden');
    document.getElementById('interview-response-box').classList.remove('hidden');
  };

  answerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answer = answerTextarea.value.trim();

    if (answer.length < 10) {
      showToast('Please type a more comprehensive answer.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-answer');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Evaluating...`;

    try {
      const questions = state.activeInterview.questions;
      const currentQ = questions[state.activeQuestionIdx];

      const data = await window.ResumeIQ_API.submitQuestionAnswer(
        state.activeInterview._id,
        currentQ._id,
        answer
      );

      if (data.success) {
        showToast('Evaluation graded successfully!', 'success');
        
        // Hide typing box and show evaluations card
        document.getElementById('interview-response-box').classList.add('hidden');
        evalCard.classList.remove('hidden');

        evalScore.innerText = `${data.question.evaluation.score}/100`;
        evalStrengths.innerText = data.question.evaluation.strengths;
        evalWeaknesses.innerText = data.question.evaluation.weaknesses;
        evalSuggestions.innerText = data.question.evaluation.suggestions;

        // Update state
        state.activeInterview.questions[state.activeQuestionIdx] = data.question;

        // Check if finished
        if (data.completed) {
          stopInterviewTimer();
          btnNext.innerText = 'Show Final Report';
        } else {
          btnNext.innerText = 'Next Question';
        }
      }
    } catch (err) {
      showToast('Failed to evaluate answer.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Answer`;
    }
  });

  btnNext.addEventListener('click', () => {
    const questions = state.activeInterview.questions;
    if (state.activeQuestionIdx + 1 < questions.length) {
      state.activeQuestionIdx++;
      renderCurrentQuestion();
    } else {
      // Finished: show aggregate final score card
      evalCard.classList.add('hidden');
      document.getElementById('interview-response-box').classList.add('hidden');
      
      const finishedBox = document.getElementById('interview-completed-box');
      finishedBox.classList.remove('hidden');

      // Async fetch full document to ensure we have the calculated aggregate score
      window.ResumeIQ_API.getInterviewDetails(state.activeInterview._id)
        .then(data => {
          if (data.success) {
            document.getElementById('interview-final-score').innerText = `${data.interview.overallScore}%`;
            const ring = document.getElementById('interview-final-ring');
            const offset = 440 - (440 * data.interview.overallScore) / 100;
            ring.style.strokeDashoffset = offset;
            
            // Reload historical interviews
            loadInterviewHistory();
          }
        });
    }
  });

  document.getElementById('btn-reset-interview').addEventListener('click', () => {
    boardEmptyState.classList.remove('hidden');
    activeBoard.classList.add('hidden');
    completedBox.classList.add('hidden');
  });

  // Load previous interviews
  const loadInterviewHistory = async () => {
    const list = document.getElementById('interview-sessions-list');
    try {
      const data = await window.ResumeIQ_API.getInterviewHistory();
      if (data.success) {
        list.innerHTML = '';
        if (data.interviews.length === 0) {
          list.innerHTML = '<p class="empty-state-text text-center">No interviews completed.</p>';
          return;
        }

        data.interviews.forEach(item => {
          const div = document.createElement('div');
          div.className = 'interview-history-item';
          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600;">
              <span>${item.targetCompany} | ${item.targetRole}</span>
              <span class="text-success">${item.overallScore}%</span>
            </div>
            <div style="font-size:0.7rem; color:var(--muted); margin-top:4px;">
              ${new Date(item.createdAt).toLocaleDateString()} &nbsp;|&nbsp; 
              ${item.questions.filter(q => q.userAnswer).length}/${item.questions.length} Answered
            </div>
          `;
          list.appendChild(div);

          // Click to view session details
          div.addEventListener('click', () => {
            showSessionSummary(item);
          });
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const showSessionSummary = (session) => {
    state.activeInterview = session;
    boardEmptyState.classList.add('hidden');
    activeBoard.classList.remove('hidden');
    evalCard.classList.add('hidden');
    document.getElementById('interview-response-box').classList.add('hidden');
    
    const finishedBox = document.getElementById('interview-completed-box');
    finishedBox.classList.remove('hidden');

    document.getElementById('interview-active-meta').innerText = `${session.targetCompany} | ${session.targetRole}`;
    document.getElementById('interview-final-score').innerText = `${session.overallScore}%`;
    const ring = document.getElementById('interview-final-ring');
    const offset = 440 - (440 * session.overallScore) / 100;
    ring.style.strokeDashoffset = offset;
  };

  // ==========================================================================
  // 11. Historical Resumes list & Comparisons
  // ==========================================================================
  const historyTbody = document.getElementById('history-table-tbody');
  const searchInput = document.getElementById('history-search');
  const filterRoleSelect = document.getElementById('history-filter-role');

  const loadHistoryData = async () => {
    try {
      const data = await window.ResumeIQ_API.getAnalysisHistory();
      if (data.success) {
        renderHistoryTable(data.reports);
        populateFilterRoleDropdown(data.reports);
        populateComparisonSelects(data.reports);
      }
    } catch (e) {
      showToast('Failed to load version history data.', 'danger');
    }
  };

  const renderHistoryTable = (reports) => {
    historyTbody.innerHTML = '';
    
    if (reports.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" class="empty-state-row">No resumes analyzed yet.</td></tr>`;
      return;
    }

    reports.forEach(rep => {
      if (!rep.resume) return;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${rep.resume.originalName}</strong></td>
        <td>v${rep.resume.version}</td>
        <td>${rep.targetRole}</td>
        <td>${rep.targetCompany}</td>
        <td><span class="badge ${rep.overallScore >= 80 ? 'badge-success' : (rep.overallScore < 50 ? 'badge-danger' : 'badge-warning')}">${rep.overallScore}%</span></td>
        <td>${new Date(rep.createdAt).toLocaleDateString()}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm btn-open-report" data-id="${rep._id}"><i class="fa-solid fa-chart-simple"></i> View Audit</button>
            <button class="btn btn-secondary btn-sm btn-edit-resume" data-id="${rep.resume._id}"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="btn btn-logout btn-sm btn-delete-series" data-id="${rep.resume.parentResumeId || rep.resume._id}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      historyTbody.appendChild(tr);
    });

    // Bind Actions
    document.querySelectorAll('.btn-open-report').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const repData = await window.ResumeIQ_API.getAnalysisDetails(id);
        if (repData.success) {
          state.currentReport = repData.report;
          state.currentResume = repData.report.resume;
          renderAnalysisReport(repData.report);
          document.getElementById('nav-analysis').classList.remove('hidden');
          window.location.hash = '#analysis';
        }
      });
    });

    document.querySelectorAll('.btn-edit-resume').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const resData = await window.ResumeIQ_API.getResumeDetails(id);
        if (resData.success) {
          state.currentResume = resData.resume;
          window.location.hash = '#builder';
        }
      });
    });

    document.querySelectorAll('.btn-delete-series').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this resume series? All version backups and ATS reports will be lost.')) {
          try {
            const res = await window.ResumeIQ_API.deleteResume(id);
            if (res.success) {
              showToast('Resume deleted successfully.', 'success');
              loadHistoryData();
            }
          } catch (e) {
            showToast('Deletion failed.', 'danger');
          }
        }
      });
    });
  };

  const populateFilterRoleDropdown = (reports) => {
    const roles = [...new Set(reports.map(r => r.targetRole))];
    filterRoleSelect.innerHTML = '<option value="">All Roles</option>';
    roles.forEach(role => {
      filterRoleSelect.innerHTML += `<option value="${role}">${role}</option>`;
    });
  };

  // Search/Filter binds
  searchInput.addEventListener('input', () => filterHistoryTable());
  filterRoleSelect.addEventListener('change', () => filterHistoryTable());

  const filterHistoryTable = async () => {
    const searchVal = searchInput.value.toLowerCase();
    const roleVal = filterRoleSelect.value;
    
    try {
      const data = await window.ResumeIQ_API.getAnalysisHistory();
      if (data.success) {
        const filtered = data.reports.filter(rep => {
          if (!rep.resume) return false;
          
          const matchesSearch = rep.resume.originalName.toLowerCase().includes(searchVal) || 
                                rep.targetCompany.toLowerCase().includes(searchVal);
          const matchesRole = !roleVal || rep.targetRole === roleVal;
          
          return matchesSearch && matchesRole;
        });
        renderHistoryTable(filtered);
      }
    } catch (e) {}
  };

  // Comparison dropdown triggers
  const compareA = document.getElementById('compare-v1-select');
  const compareB = document.getElementById('compare-v2-select');
  
  const populateComparisonSelects = (reports) => {
    compareA.innerHTML = '<option value="" disabled selected>Select Version A...</option>';
    compareB.innerHTML = '<option value="" disabled selected>Select Version B...</option>';
    
    reports.forEach(rep => {
      if (rep.resume) {
        const text = `${rep.resume.originalName} v${rep.resume.version} (${rep.targetCompany} - ${rep.overallScore}%)`;
        compareA.innerHTML += `<option value="${rep._id}">${text}</option>`;
        compareB.innerHTML += `<option value="${rep._id}">${text}</option>`;
      }
    });
  };

  document.getElementById('btn-compare-versions').addEventListener('click', async () => {
    const rAId = compareA.value;
    const rBId = compareB.value;

    if (!rAId || !rBId) {
      showToast('Please select both versions to compare.', 'warning');
      return;
    }

    try {
      const repA = await window.ResumeIQ_API.getAnalysisDetails(rAId);
      const repB = await window.ResumeIQ_API.getAnalysisDetails(rBId);

      if (repA.success && repB.success) {
        document.getElementById('comparison-matrix-box').classList.remove('hidden');

        const reportA = repA.report;
        const reportB = repB.report;

        document.getElementById('compare-name-a').innerText = `${reportA.resume.originalName} v${reportA.resume.version}`;
        document.getElementById('compare-name-b').innerText = `${reportB.resume.originalName} v${reportB.resume.version}`;

        // Overall
        const sA = document.getElementById('compare-score-a');
        sA.innerText = `${reportA.overallScore}%`;
        sA.className = `badge ${reportA.overallScore >= 80 ? 'badge-success' : 'badge-warning'}`;
        
        const sB = document.getElementById('compare-score-b');
        sB.innerText = `${reportB.overallScore}%`;
        sB.className = `badge ${reportB.overallScore >= 80 ? 'badge-success' : 'badge-warning'}`;

        // Breakdowns
        document.getElementById('compare-formatting-a').innerText = `${reportA.scores.formatting}%`;
        document.getElementById('compare-formatting-b').innerText = `${reportB.scores.formatting}%`;

        document.getElementById('compare-skills-a').innerText = `${reportA.scores.skills}%`;
        document.getElementById('compare-skills-b').innerText = `${reportB.scores.skills}%`;

        document.getElementById('compare-experience-a').innerText = `${reportA.scores.experience}%`;
        document.getElementById('compare-experience-b').innerText = `${reportB.scores.experience}%`;

        document.getElementById('compare-keyword-a').innerText = `${reportA.scores.keyword}%`;
        document.getElementById('compare-keyword-b').innerText = `${reportB.scores.keyword}%`;

        document.getElementById('compare-keywords-a-count').innerText = reportA.keywords.matched.length;
        document.getElementById('compare-keywords-b-count').innerText = reportB.keywords.matched.length;
      }
    } catch (e) {
      showToast('Comparison failed.', 'danger');
    }
  });

  // ==========================================================================
  // 12. Profile settings updates
  // ==========================================================================
  
  // Profile Update Form
  document.getElementById('form-settings-profile').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('settings-name').value;
    const email = document.getElementById('settings-email').value;
    const linkedinUrl = document.getElementById('settings-linkedin').value;
    const githubUrl = document.getElementById('settings-github').value;
    const portfolioUrl = document.getElementById('settings-portfolio').value;
    const avatar = document.querySelector('input[name="settings-avatar"]:checked').value;

    try {
      const data = await window.ResumeIQ_API.updateProfile({
        name, email, linkedinUrl, githubUrl, portfolioUrl, avatar
      });

      if (data.success) {
        showToast('Profile information updated successfully!', 'success');
        state.user = data.user;
        
        // Sync display
        document.getElementById('sidebar-user-name').innerText = state.user.name;
        document.getElementById('sidebar-user-email').innerText = state.user.email;
        document.getElementById('dash-user-name').innerText = state.user.name;
      }
    } catch (err) {
      showToast(err.message || 'Profile update failed.', 'danger');
    }
  });

  // Password Update Form
  document.getElementById('form-settings-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('settings-old-pass').value;
    const newPassword = document.getElementById('settings-new-pass').value;

    try {
      const data = await window.ResumeIQ_API.updatePassword(currentPassword, newPassword);
      if (data.success) {
        showToast('Password changed successfully!', 'success');
        document.getElementById('settings-old-pass').value = '';
        document.getElementById('settings-new-pass').value = '';
      }
    } catch (err) {
      showToast(err.message || 'Password update failed.', 'danger');
    }
  });

  // ==========================================================================
  // 13. Boot Route Init
  // ==========================================================================
  routeHandler();
});
