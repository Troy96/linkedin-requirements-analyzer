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

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('linkedin.com')) {
      showToast('Please navigate to LinkedIn first', 'error');
      return;
    }

    btn.innerHTML = '<span class="btn-icon">...</span> Loading all...';

    // First, try to modify the URL to load more jobs at once
    // Use a very high count to ensure all jobs are loaded
    const MAX_JOB_COUNT = 1000;

    const urlModified = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (maxCount) => {
        const url = new URL(window.location.href);
        const currentCount = parseInt(url.searchParams.get('count') || '0');

        // If count param is less than max, increase it
        if (currentCount < maxCount) {
          url.searchParams.set('count', maxCount.toString());
          window.location.href = url.toString();
          return { modified: true, newCount: maxCount };
        }
        return { modified: false };
      },
      args: [MAX_JOB_COUNT]
    });

    // If URL was modified, wait for page to reload
    if (urlModified && urlModified[0] && urlModified[0].result && urlModified[0].result.modified) {
      btn.innerHTML = '<span class="btn-icon">...</span> Reloading...';
      await sleep(3000);
      // Wait for the page to finish loading
      await waitForPageLoad(tab.id);
      await sleep(2000); // Extra time for content to render

      // Update the job count display after reload
      await checkCurrentPage();
    }

    // Now capture all jobs from the page
    let totalCaptured = 0;
    let totalDuplicates = 0;
    let allJobs = [];

    // Extract jobs from current view
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobsFromListPage
    });

    if (results && results[0] && results[0].result) {
      allJobs = results[0].result;
    }

    if (allJobs.length === 0) {
      showToast('No jobs found on this page', 'error');
      return;
    }

    // Update display with actual job count found
    const visibleJobCountEl = document.getElementById('visibleJobCount');
    if (visibleJobCountEl) {
      visibleJobCountEl.textContent = allJobs.length;
    }
    const pageTypeEl = document.getElementById('pageType');
    if (pageTypeEl) {
      pageTypeEl.textContent = `Found ${allJobs.length} jobs on this page`;
    }

    btn.innerHTML = `<span class="btn-icon">...</span> Capturing ${allJobs.length}...`;

    // Save all jobs
    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      try {
        const saveResponse = await sendMessage('saveJob', { data: job });
        if (saveResponse.success) {
          if (saveResponse.duplicate) {
            totalDuplicates++;
          } else {
            totalCaptured++;
          }
        }
        // Update progress every 10 jobs
        if (i % 10 === 0) {
          btn.innerHTML = `<span class="btn-icon">...</span> ${i + 1}/${allJobs.length}...`;
        }
      } catch (e) {
        console.error('Error saving job:', e);
      }
    }

    await loadJobs();
    await updateStats();

    const msg = `Captured ${totalCaptured} jobs` +
                (totalDuplicates > 0 ? `, ${totalDuplicates} already existed` : '');
    showToast(msg, 'success');
    updateFetchSection();
  } catch (error) {
    console.error('Error capturing jobs:', error);
    showToast('Error: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Wait for tab to finish loading
async function waitForPageLoad(tabId) {
  return new Promise((resolve) => {
    const checkLoad = async () => {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => document.readyState
        });
        if (results && results[0] && results[0].result === 'complete') {
          resolve();
        } else {
          setTimeout(checkLoad, 500);
        }
      } catch (e) {
        resolve();
      }
    };
    checkLoad();
    // Timeout after 15 seconds
    setTimeout(resolve, 15000);
  });
}

// Check if there's a next page button and click it if found
function checkAndClickNextPage() {
  // Helper to reliably click an element
  function clickElement(el) {
    if (!el) return false;
    try {
      el.click();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Helper to check if element is visible and enabled
  function isClickable(el) {
    if (!el) return false;
    if (el.disabled || el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  // PRIORITY 1: LinkedIn job tracker uses data-testid attribute
  const nextByTestId = document.querySelector('[data-testid="pagination-controls-next-button-visible"]');
  if (nextByTestId && isClickable(nextByTestId)) {
    clickElement(nextByTestId);
    return true;
  }

  // PRIORITY 2: Also check for prev button testid to find pagination area
  const prevByTestId = document.querySelector('[data-testid="pagination-controls-previous-button-visible"]');
  if (prevByTestId) {
    // Next button should be a sibling
    const parent = prevByTestId.parentElement;
    if (parent) {
      const buttons = parent.querySelectorAll('button');
      const lastBtn = buttons[buttons.length - 1];
      if (lastBtn && lastBtn !== prevByTestId && isClickable(lastBtn)) {
        clickElement(lastBtn);
        return true;
      }
    }
  }

  // PRIORITY 3: Generic next button selectors
  const nextButtonSelectors = [
    'button[aria-label="Next"]',
    'button[aria-label="View next page"]',
    'button[aria-label*="next" i]',
    '.artdeco-pagination__button--next',
  ];

  for (const selector of nextButtonSelectors) {
    const btn = document.querySelector(selector);
    if (isClickable(btn)) {
      clickElement(btn);
      return true;
    }
  }

  // PRIORITY 4: Find button containing "Next" text
  const allButtons = document.querySelectorAll('button');
  for (const btn of allButtons) {
    const text = btn.textContent.trim().toLowerCase();
    if (text === 'next' && isClickable(btn)) {
      clickElement(btn);
      return true;
    }
  }

  return false;
}

// Wait for page content to update after pagination click
async function waitForPageContentUpdate(tabId, previousJobCount = 0) {
  // Wait for the page to settle after navigation
  const maxWaitTime = 8000;
  const checkInterval = 500;
  let waited = 0;

  while (waited < maxWaitTime) {
    await sleep(checkInterval);
    waited += checkInterval;

    // Check if jobs are loaded on the page and count changed
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: (prevCount) => {
        const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
        const uniqueJobs = new Set();
        jobLinks.forEach(link => {
          const match = link.href.match(/\/jobs\/view\/(\d+)/);
          if (match) uniqueJobs.add(match[1]);
        });
        // Return true if we have jobs and either count changed or we have enough jobs
        return {
          count: uniqueJobs.size,
          ready: uniqueJobs.size > 0 && (uniqueJobs.size !== prevCount || uniqueJobs.size > 0)
        };
      },
      args: [previousJobCount]
    });

    if (result && result[0] && result[0].result && result[0].result.ready) {
      // Give a bit more time for full render
      await sleep(1000);
      return result[0].result.count;
    }
  }
  return 0;
}

// Try to scroll down to trigger infinite scroll loading
function scrollToLoadMore() {
  // Find the scrollable container
  const scrollContainers = [
    document.querySelector('.jobs-search-results-list'),
    document.querySelector('.scaffold-layout__list'),
    document.querySelector('[class*="jobs-list"]'),
    document.querySelector('main'),
    document.documentElement
  ];

  for (const container of scrollContainers) {
    if (container) {
      const beforeScroll = container.scrollTop;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });

      // Also try window scroll
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });

      console.log('[LinkedIn Analyzer] Scrolled to bottom');
      return true;
    }
  }
  return false;
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

  // Find title - try multiple methods
  let title = null;

  // Method 1: Try standard selectors
  const titleSelectors = [
    'h1',
    '.job-details-jobs-unified-top-card__job-title',
    '[class*="job-title"]',
    '[class*="JobTitle"]',
    '[data-testid*="title"]'
  ];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      title = el.textContent.trim();
      if (title && title.length > 2 && title.length < 200) break;
    }
  }

  // Method 2: Get h1 text using TreeWalker for nested spans
  if (!title || title.length < 3) {
    const h1 = document.querySelector('h1');
    if (h1) {
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, null, false);
      let fullText = '';
      let node;
      while (node = walker.nextNode()) {
        fullText += node.textContent;
      }
      title = fullText.trim().replace(/\s+/g, ' ');
    }
  }

  // Method 3: Look for job-detail-page container
  if (!title || title.length < 3) {
    const jobDetailEl = document.querySelector('[data-view-name="job-detail-page"]');
    if (jobDetailEl) {
      const h1InDetail = jobDetailEl.querySelector('h1');
      if (h1InDetail) {
        title = h1InDetail.textContent.trim();
      }
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

    let title = null;
    let company = null;
    let location = null;

    // Find the job card container - go up until we find a reasonable container
    let card = link.parentElement;
    for (let i = 0; i < 10 && card; i++) {
      // Check if this looks like a job card (has multiple text elements)
      const textContent = card.textContent.trim();
      if (textContent.length > 20 && textContent.length < 1000) {
        break;
      }
      card = card.parentElement;
    }

    if (card) {
      // Method 1: Look for <p> elements containing the title (LinkedIn job tracker structure)
      // Title is typically in a <p> with a <span> inside, as a sibling to the link
      const paragraphs = card.querySelectorAll('p');
      for (const p of paragraphs) {
        const text = p.textContent.trim();
        // Title is usually 5-150 chars, contains letters, not metadata
        if (text.length > 5 && text.length < 150 &&
            /[a-zA-Z]{3,}/.test(text) &&
            !text.includes('ago') &&
            !text.includes('Posted') &&
            !text.includes('applicant') &&
            !text.includes('Easy Apply')) {
          title = text;
          break;
        }
      }

      // Method 2: Look for spans with substantial text (job title often in span)
      if (!title) {
        const spans = card.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent.trim();
          // Skip if it's a parent of other elements with different text
          if (span.children.length > 0 && span.children[0].textContent.trim() !== text) {
            continue;
          }
          if (text.length > 5 && text.length < 150 &&
              /[a-zA-Z]{3,}/.test(text) &&
              !text.includes('ago') &&
              !text.includes('Posted') &&
              !text.includes('applicant')) {
            title = text;
            break;
          }
        }
      }

      // Method 3: Get first substantial text node
      if (!title) {
        const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
          const text = node.textContent.trim();
          if (text.length > 5 && text.length < 150 && /[a-zA-Z]{3,}/.test(text)) {
            title = text;
            break;
          }
        }
      }

      // Find company - look for company link first
      const companyLink = card.querySelector('a[href*="/company/"]');
      if (companyLink) {
        company = companyLink.textContent.trim();
      }

      // Find company/location from spans (usually "Company - Location (Type)")
      // Look for spans that contain " - " which indicates "Company - Location"
      if (!company) {
        const allSpans = card.querySelectorAll('span');
        for (const span of allSpans) {
          // Skip spans that contain other spans (we want leaf spans)
          if (span.querySelector('span')) continue;

          const text = span.textContent.trim();

          // Skip if this is the title we already found
          if (title && text === title) continue;

          // Skip metadata like "Posted 7h ago", "Easy Apply", etc.
          if (text.includes('Posted') ||
              text.includes('ago') ||
              text.includes('Easy Apply') ||
              text.includes('applicant') ||
              text.includes('Promoted')) continue;

          // Company info often has format "Company - Location (Type)" or just "Company"
          if (text.length > 2 && text.length < 150) {
            if (text.includes(' - ')) {
              // Parse "Company - Location" format
              const parts = text.split(' - ');
              company = parts[0].trim();
              if (parts.length > 1) {
                location = parts.slice(1).join(' - ').trim();
              }
              break;
            } else if (!company && /^[A-Z]/.test(text) && !text.includes('http')) {
              // Might be just company name (starts with capital letter)
              company = text;
            }
          }
        }
      }

      // Also check for location in parentheses like "(Remote)"
      if (company && !location) {
        const remoteMatch = company.match(/\(([^)]+)\)\s*$/);
        if (remoteMatch) {
          location = remoteMatch[1];
          company = company.replace(/\s*\([^)]+\)\s*$/, '').trim();
        }
      }
    }

    // Fallback: try link text if nothing found
    if (!title) {
      const linkText = link.textContent.trim();
      if (linkText.length > 3 && linkText.length < 200) {
        title = linkText;
      }
    }

    // Clean up title - remove extra whitespace
    if (title) {
      title = title.replace(/\s+/g, ' ').trim();
    }

    if (title && title.length > 2) {
      jobs.push({
        id: jobId,
        url: href.split('?')[0], // Remove query params
        title: title,
        company: company,
        location: location,
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
