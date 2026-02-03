// LinkedIn Job Requirements Analyzer - Popup Script

document.addEventListener('DOMContentLoaded', init);

// Skill keywords organized by category
const SKILL_KEYWORDS = {
  'Programming Languages': [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'bash', 'shell',
    'sql', 'html', 'css', 'sass', 'less'
  ],
  'Frameworks & Libraries': [
    'react', 'angular', 'vue', 'svelte', 'next.js', 'nextjs', 'nuxt', 'node.js', 'nodejs',
    'express', 'fastify', 'django', 'flask', 'fastapi', 'spring', 'spring boot',
    '.net', 'rails', 'laravel', 'jquery', 'bootstrap', 'tailwind', 'material ui'
  ],
  'Cloud & Infrastructure': [
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes',
    'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions', 'gitlab',
    'linux', 'unix', 'nginx', 'apache'
  ],
  'Databases': [
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb',
    'cassandra', 'oracle', 'sql server', 'sqlite', 'firebase', 'supabase', 'graphql'
  ],
  'Tools & Practices': [
    'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'agile', 'scrum',
    'kanban', 'tdd', 'unit testing', 'integration testing', 'api', 'rest', 'restful',
    'microservices', 'monolith'
  ],
  'AI & Data': [
    'machine learning', 'ml', 'deep learning', 'ai', 'artificial intelligence',
    'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'nlp',
    'computer vision', 'data science', 'data engineering', 'etl', 'spark', 'hadoop'
  ],
  'Soft Skills': [
    'communication', 'leadership', 'teamwork', 'collaboration', 'problem solving',
    'critical thinking', 'time management', 'mentoring', 'presentation'
  ]
};

let currentJobs = [];
let currentPageInfo = null;

async function init() {
  await loadJobs();
  setupEventListeners();
  updateStats();
  updateFetchSection();
  await checkCurrentPage();
}

function setupEventListeners() {
  document.getElementById('captureBtn').addEventListener('click', captureCurrentJob);
  document.getElementById('captureAllBtn').addEventListener('click', captureAllJobs);
  document.getElementById('clearAllBtn').addEventListener('click', clearAllJobs);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('analyzeBtn').addEventListener('click', analyzeRequirements);
  document.getElementById('closeAnalysis').addEventListener('click', closeAnalysis);
  document.getElementById('fetchDescBtn').addEventListener('click', fetchDescriptions);
  document.getElementById('stopFetchBtn').addEventListener('click', () => { sendMessage('stopFetching'); });
}

async function checkCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const pageInfoEl = document.getElementById('pageInfo');
    const pageTypeEl = document.getElementById('pageType');
    const captureBtn = document.getElementById('captureBtn');
    const captureAllBtn = document.getElementById('captureAllBtn');
    const visibleJobCountEl = document.getElementById('visibleJobCount');

    // Check if we're on LinkedIn
    if (!tab.url.includes('linkedin.com')) {
      pageInfoEl.classList.remove('hidden');
      pageTypeEl.textContent = 'Navigate to LinkedIn to capture jobs';
      captureBtn.classList.add('hidden');
      captureAllBtn.classList.add('hidden');
      return;
    }

    // Check if we're on a jobs page
    if (!tab.url.includes('linkedin.com/jobs') &&
        !tab.url.includes('linkedin.com/jobs-tracker') &&
        !tab.url.includes('linkedin.com/my-items')) {
      pageInfoEl.classList.remove('hidden');
      pageTypeEl.textContent = 'Navigate to a jobs page or saved jobs to capture';
      captureBtn.classList.add('hidden');
      captureAllBtn.classList.add('hidden');
      return;
    }

    // Get page info using executeScript (more reliable than messaging)
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const url = window.location.href;
          const isDetailPage = url.includes('/jobs/view/');
          const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
          const uniqueJobs = new Set();
          jobLinks.forEach(link => {
            const match = link.href.match(/\/jobs\/view\/(\d+)/);
            if (match) uniqueJobs.add(match[1]);
          });
          return {
            isDetailPage,
            jobCount: isDetailPage ? 1 : uniqueJobs.size,
            url
          };
        }
      });

      if (results && results[0] && results[0].result) {
        const info = results[0].result;
        currentPageInfo = info;

        if (!info.isDetailPage && info.jobCount > 0) {
          pageInfoEl.classList.remove('hidden');
          pageTypeEl.textContent = `Found ${info.jobCount} jobs on this page`;
          captureBtn.classList.add('hidden');
          captureAllBtn.classList.remove('hidden');
          visibleJobCountEl.textContent = info.jobCount;
        } else if (info.isDetailPage) {
          pageInfoEl.classList.remove('hidden');
          pageTypeEl.textContent = 'Viewing job detail page';
          captureBtn.classList.remove('hidden');
          captureAllBtn.classList.add('hidden');
        } else {
          pageInfoEl.classList.add('hidden');
          captureBtn.classList.remove('hidden');
          captureAllBtn.classList.add('hidden');
        }
      }
    } catch (error) {
      console.log('Could not get page info:', error);
      pageInfoEl.classList.remove('hidden');
      pageTypeEl.textContent = 'Click a button to capture jobs';
      captureBtn.classList.remove('hidden');
      captureAllBtn.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error checking page:', error);
  }
}

async function sendMessage(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

async function loadJobs() {
  try {
    const response = await sendMessage('getJobs');
    currentJobs = response.jobs || [];
    renderJobList();
    updateFetchSection();
  } catch (error) {
    console.error('Error loading jobs:', error);
    showToast('Error loading jobs', 'error');
  }
}

async function updateStats() {
  try {
    const stats = await sendMessage('getStats');
    document.getElementById('jobCount').textContent = stats.jobCount;
    document.getElementById('storageUsed').textContent = stats.storageUsedKB;
  } catch (error) {
    console.error('Error getting stats:', error);
  }
}

function renderJobList() {
  const listElement = document.getElementById('jobList');

  if (currentJobs.length === 0) {
    listElement.innerHTML = `
      <div class="empty-state">
        <p>No jobs captured yet.</p>
        <p class="hint">Navigate to LinkedIn saved jobs and click "Capture All Visible"</p>
      </div>
    `;
    return;
  }

  // Sort by capture date (newest first)
  const sortedJobs = [...currentJobs].sort((a, b) =>
    new Date(b.capturedAt) - new Date(a.capturedAt)
  );

  listElement.innerHTML = sortedJobs.map(job => {
    const hasDescription = job.descriptionText && job.descriptionText.length > 0;
    const badge = !hasDescription ? '<span class="no-desc-badge" title="No description - click Open to capture full details">*</span>' : '';

    return `
    <div class="job-item" data-id="${job.id}" data-url="${escapeHtml(job.url || '')}">
      <div class="job-info">
        <div class="job-title" title="${escapeHtml(job.title || 'Unknown Title')}">${escapeHtml(job.title || 'Unknown Title')}${badge}</div>
        <div class="job-company" title="${escapeHtml(job.company || 'Unknown Company')}">${escapeHtml(job.company || 'Unknown Company')}</div>
        <div class="job-date">${formatDate(job.capturedAt)}</div>
      </div>
      <div class="job-actions">
        <button class="btn btn-text btn-open" title="Open job">
          Open
        </button>
        <button class="btn btn-text btn-danger btn-delete" title="Delete">
          X
        </button>
      </div>
    </div>
  `}).join('');

  // Attach event listeners (CSP doesn't allow inline handlers)
  listElement.querySelectorAll('.btn-open').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobItem = e.target.closest('.job-item');
      const url = jobItem.dataset.url;
      if (url) openJob(url);
    });
  });

  listElement.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const jobItem = e.target.closest('.job-item');
      const jobId = jobItem.dataset.id;
      if (jobId) deleteJob(jobId);
    });
  });
}

async function captureCurrentJob() {
  const btn = document.getElementById('captureBtn');
  btn.disabled = true;
  btn.textContent = 'Capturing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('linkedin.com')) {
      showToast('Please navigate to LinkedIn first', 'error');
      return;
    }

    // Use executeScript instead of messaging (more reliable)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobFromPage
    });

    if (results && results[0] && results[0].result) {
      const jobData = results[0].result;
      const saveResponse = await sendMessage('saveJob', { data: jobData });

      if (saveResponse.success) {
        if (saveResponse.duplicate) {
          showToast('Job already captured (updated)', 'success');
        } else {
          showToast('Job captured successfully!', 'success');
        }
        await loadJobs();
        await updateStats();
        updateFetchSection();
      } else {
        showToast(saveResponse.error || 'Failed to save job', 'error');
      }
    } else {
      showToast('Could not extract job data. Make sure you\'re on a job detail page.', 'error');
    }
  } catch (error) {
    console.error('Error capturing job:', error);
    showToast('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">+</span> Capture Current Job';
  }
}

async function captureAllJobs() {
  const btn = document.getElementById('captureAllBtn');
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="btn-icon">...</span> Capturing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('linkedin.com')) {
      showToast('Please navigate to LinkedIn first', 'error');
      return;
    }

    // Use executeScript to extract jobs from list
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobsFromListPage
    });

    if (results && results[0] && results[0].result) {
      const jobs = results[0].result;

      if (jobs.length === 0) {
        showToast('No jobs found on this page', 'error');
        return;
      }

      let captured = 0;
      let duplicates = 0;

      for (const job of jobs) {
        try {
          const saveResponse = await sendMessage('saveJob', { data: job });
          if (saveResponse.success) {
            if (saveResponse.duplicate) {
              duplicates++;
            } else {
              captured++;
            }
          }
        } catch (e) {
          console.error('Error saving job:', e);
        }
      }

      const msg = `Captured ${captured} jobs` +
                  (duplicates > 0 ? `, ${duplicates} already existed` : '');
      showToast(msg, 'success');
      await loadJobs();
      await updateStats();
      updateFetchSection();
    } else {
      showToast('Could not find jobs on this page', 'error');
    }
  } catch (error) {
    console.error('Error capturing jobs:', error);
    showToast('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function deleteJob(jobId) {
  try {
    await sendMessage('deleteJob', { jobId });
    await loadJobs();
    await updateStats();
    showToast('Job deleted', 'success');
  } catch (error) {
    console.error('Error deleting job:', error);
    showToast('Error deleting job', 'error');
  }
}


async function clearAllJobs() {
  if (currentJobs.length === 0) {
    showToast('No jobs to clear', 'error');
    return;
  }

  if (!confirm(`Delete all ${currentJobs.length} captured jobs? This cannot be undone.`)) {
    return;
  }

  try {
    await sendMessage('clearAll');
    await loadJobs();
    await updateStats();
    closeAnalysis();
    showToast('All jobs cleared', 'success');
  } catch (error) {
    console.error('Error clearing jobs:', error);
    showToast('Error clearing jobs', 'error');
  }
}

function openJob(url) {
  chrome.tabs.create({ url });
}


async function exportJSON() {
  if (currentJobs.length === 0) {
    showToast('No jobs to export', 'error');
    return;
  }

  try {
    const response = await sendMessage('exportJSON');
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `linkedin-jobs-${formatDateForFilename()}.json`);
    showToast('JSON exported', 'success');
  } catch (error) {
    console.error('Error exporting JSON:', error);
    showToast('Error exporting', 'error');
  }
}

async function exportCSV() {
  if (currentJobs.length === 0) {
    showToast('No jobs to export', 'error');
    return;
  }

  try {
    const response = await sendMessage('exportCSV');
    const blob = new Blob([response.data], { type: 'text/csv' });
    downloadBlob(blob, `linkedin-jobs-${formatDateForFilename()}.csv`);
    showToast('CSV exported', 'success');
  } catch (error) {
    console.error('Error exporting CSV:', error);
    showToast('Error exporting', 'error');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function analyzeRequirements() {
  if (currentJobs.length === 0) {
    showToast('No jobs to analyze', 'error');
    return;
  }

  // Combine all job descriptions
  const allText = currentJobs
    .map(job => (job.descriptionText || '').toLowerCase())
    .join(' ');

  // Count skill occurrences
  const results = {};

  for (const [category, skills] of Object.entries(SKILL_KEYWORDS)) {
    const categoryCounts = [];

    for (const skill of skills) {
      // Create regex to match whole word (with some flexibility)
      const pattern = new RegExp(`\\b${escapeRegex(skill)}\\b`, 'gi');
      const matches = allText.match(pattern);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        categoryCounts.push({ skill, count });
      }
    }

    // Sort by count descending
    categoryCounts.sort((a, b) => b.count - a.count);

    if (categoryCounts.length > 0) {
      results[category] = categoryCounts;
    }
  }

  renderAnalysisResults(results);
}

function renderAnalysisResults(results) {
  const container = document.getElementById('analysisContent');
  const resultsSection = document.getElementById('analysisResults');

  // Check how many jobs have descriptions
  const jobsWithDesc = currentJobs.filter(j => j.descriptionText && j.descriptionText.length > 0).length;

  if (Object.keys(results).length === 0) {
    let msg = '<p>No common skills found.</p>';
    if (jobsWithDesc === 0) {
      msg += '<p style="margin-top: 8px; font-size: 12px; color: #666;">Jobs captured from list view don\'t include descriptions. Open each job and capture again for full analysis.</p>';
    } else {
      msg += '<p style="margin-top: 8px; font-size: 12px; color: #666;">Try capturing more jobs with descriptions.</p>';
    }
    container.innerHTML = msg;
    resultsSection.classList.remove('hidden');
    return;
  }

  // Find max count for bar scaling
  let maxCount = 0;
  for (const category of Object.values(results)) {
    for (const item of category) {
      maxCount = Math.max(maxCount, item.count);
    }
  }

  let html = '';

  for (const [category, skills] of Object.entries(results)) {
    html += `<div class="skill-category">
      <h3>${category}</h3>
      ${skills.slice(0, 10).map(({ skill, count }) => `
        <div class="skill-item">
          <span class="skill-name">${escapeHtml(skill)}</span>
          <div class="skill-bar">
            <div class="skill-bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
          </div>
          <span class="skill-count">${count}</span>
        </div>
      `).join('')}
    </div>`;
  }

  html += `<p style="margin-top: 16px; font-size: 12px; color: #666;">
    Analysis based on ${jobsWithDesc} job${jobsWithDesc === 1 ? '' : 's'} with descriptions.
    ${currentJobs.length - jobsWithDesc > 0 ? `(${currentJobs.length - jobsWithDesc} jobs missing descriptions)` : ''}
  </p>`;

  container.innerHTML = html;
  resultsSection.classList.remove('hidden');
}

function closeAnalysis() {
  document.getElementById('analysisResults').classList.add('hidden');
}

function updateFetchSection() {
  const fetchSection = document.getElementById('fetchSection');
  const missingDescCount = document.getElementById('missingDescCount');

  const jobsWithoutDesc = currentJobs.filter(j => !j.descriptionText || j.descriptionText.length === 0);

  if (jobsWithoutDesc.length > 0 && currentJobs.length > 0) {
    fetchSection.classList.remove('hidden');
    missingDescCount.textContent = jobsWithoutDesc.length;
  } else {
    fetchSection.classList.add('hidden');
  }
}

async function fetchDescriptions() {
  const jobsWithoutDesc = currentJobs.filter(j => !j.descriptionText || j.descriptionText.length === 0);

  if (jobsWithoutDesc.length === 0) {
    showToast('All jobs already have descriptions', 'success');
    return;
  }

  const fetchBtn = document.getElementById('fetchDescBtn');
  const fetchProgress = document.getElementById('fetchProgress');
  const progressFill = document.getElementById('progressFill');
  const fetchStatus = document.getElementById('fetchStatus');

  fetchBtn.classList.add('hidden');
  fetchProgress.classList.remove('hidden');
  fetchStatus.textContent = 'Starting...';

  // Start fetching in background
  sendMessage('startFetching').then(async (result) => {
    // Fetching completed
    fetchBtn.classList.remove('hidden');
    fetchProgress.classList.add('hidden');
    progressFill.style.width = '0%';

    if (result.success) {
      const msg = result.stopped
        ? `Stopped. Fetched ${result.fetched} descriptions.`
        : `Done! Fetched ${result.fetched} descriptions${result.errors > 0 ? `, ${result.errors} errors` : ''}`;
      showToast(msg, result.errors > 0 && result.fetched === 0 ? 'error' : 'success');
    } else {
      showToast(result.error || 'Failed to fetch', 'error');
    }

    await loadJobs();
    await updateStats();
    updateFetchSection();
  });

  // Poll for status updates
  const statusInterval = setInterval(async () => {
    const status = await sendMessage('getFetchStatus');
    if (!status.isRunning) {
      clearInterval(statusInterval);
      return;
    }

    const progress = status.totalJobs > 0
      ? ((status.currentIndex + 1) / status.totalJobs) * 100
      : 0;
    progressFill.style.width = `${progress}%`;
    fetchStatus.textContent = `Fetching ${status.currentIndex + 1}/${status.totalJobs}: ${status.currentJobTitle?.substring(0, 25) || '...'}`;
  }, 1000);
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    let resolved = false;

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);

    // Also check current status in case already loaded
    chrome.tabs.get(tabId, (tab) => {
      if (tab && tab.status === 'complete' && !resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });

    // Timeout after 20 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }, 20000);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// This function is injected into the page to extract job data
// It must be self-contained (no external dependencies)
function extractJobFromPage() {
  const url = window.location.href;

  // Extract job ID from URL
  let jobId = null;
  const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
  if (viewMatch) jobId = viewMatch[1];
  if (!jobId) {
    const paramMatch = url.match(/currentJobId=(\d+)/);
    if (paramMatch) jobId = paramMatch[1];
  }
  if (!jobId) {
    const anyIdMatch = url.match(/(\d{10,})/);
    if (anyIdMatch) jobId = anyIdMatch[1];
  }

  if (!jobId) return null;

  // Find title - try multiple selectors
  let title = null;
  const titleSelectors = [
    'h1',
    '.job-details-jobs-unified-top-card__job-title',
    '[class*="job-title"]',
    '[class*="JobTitle"]'
  ];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      title = el.textContent.trim();
      if (title && title.length > 2) break;
    }
  }

  // Find company
  let company = null;
  const companyLink = document.querySelector('a[href*="/company/"]');
  if (companyLink) company = companyLink.textContent.trim();

  // Find location
  let location = null;
  const locationSelectors = [
    '[class*="job-details-jobs-unified-top-card__bullet"]',
    '[class*="location"]',
    '[class*="Location"]'
  ];
  for (const sel of locationSelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent.trim();
      if (text && (text.includes(',') || /remote|hybrid|on-?site/i.test(text)) && text.length < 100) {
        location = text;
        break;
      }
    }
    if (location) break;
  }

  // Find description
  let descriptionText = null;

  // Method 1: Find "About the job" heading
  const allElements = document.querySelectorAll('h2, h3, div, span');
  for (const el of allElements) {
    if (el.textContent.trim().toLowerCase() === 'about the job') {
      let parent = el.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        const text = parent.textContent.trim();
        if (text.length > 100 && text.length < 15000) {
          descriptionText = text.replace(/^about the job\s*/i, '').replace(/\s+/g, ' ').trim();
          if (descriptionText.length > 100) break;
        }
        parent = parent.parentElement;
      }
      if (descriptionText) break;
    }
  }

  // Method 2: Find element with AboutTheJob in class
  if (!descriptionText) {
    const aboutEl = document.querySelector('[class*="AboutTheJob"], [class*="about-the-job"]');
    if (aboutEl) {
      descriptionText = aboutEl.textContent.trim().replace(/\s+/g, ' ');
    }
  }

  // Method 3: Find #job-details
  if (!descriptionText) {
    const jobDetails = document.querySelector('#job-details');
    if (jobDetails) {
      descriptionText = jobDetails.textContent.trim().replace(/\s+/g, ' ');
    }
  }

  // Clean up description - remove trailing "more", "Show more" etc.
  if (descriptionText) {
    descriptionText = descriptionText
      .replace(/\s*(show\s+)?more\s*$/i, '')
      .replace(/\s*see\s+more\s*$/i, '')
      .replace(/\s*\.\.\.\s*more\s*$/i, '')
      .trim();
  }

  if (!title && !descriptionText) return null;

  return {
    id: jobId,
    url: url,
    title: title || 'Unknown Title',
    company: company,
    location: location,
    workplaceType: null,
    descriptionHtml: null,
    descriptionText: descriptionText,
    capturedAt: new Date().toISOString()
  };
}

// This function is injected to extract jobs from list/tracker pages
function extractJobsFromListPage() {
  const jobs = [];
  const seen = new Set();

  // Find all links to job view pages
  const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');

  for (const link of jobLinks) {
    const href = link.href;

    // Extract job ID
    const viewMatch = href.match(/\/jobs\/view\/(\d+)/);
    if (!viewMatch) continue;

    const jobId = viewMatch[1];
    if (seen.has(jobId)) continue;
    seen.add(jobId);

    // Get title from link text
    let title = link.textContent.trim();

    // If title is too short, try to find it in parent
    if (title.length < 3) {
      const parent = link.closest('li, div, article');
      if (parent) {
        const titleEl = parent.querySelector('strong, [class*="title"], h3, h4');
        if (titleEl) title = titleEl.textContent.trim();
      }
    }

    // Try to find company
    let company = null;
    const parent = link.closest('li, div, article, [class*="card"]');
    if (parent) {
      const companyLink = parent.querySelector('a[href*="/company/"]');
      if (companyLink) {
        company = companyLink.textContent.trim();
      }
    }

    if (title && title.length > 2) {
      jobs.push({
        id: jobId,
        url: href.split('?')[0], // Remove query params
        title: title,
        company: company,
        location: null,
        workplaceType: null,
        descriptionHtml: null,
        descriptionText: null,
        capturedAt: new Date().toISOString(),
        capturedFromList: true
      });
    }
  }

  console.log('[LinkedIn Analyzer] Found', jobs.length, 'jobs on list page');
  return jobs;
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateForFilename() {
  return new Date().toISOString().split('T')[0];
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;

  // Trigger reflow for animation
  toast.offsetHeight;

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}
