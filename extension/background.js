// LinkedIn Job Requirements Analyzer - Background Service Worker
// Manages storage operations and fetching job descriptions

const STORAGE_KEY = 'capturedJobs';

// Fetch state
let fetchState = {
  isRunning: false,
  shouldStop: false,
  currentIndex: 0,
  totalJobs: 0,
  fetched: 0,
  errors: 0,
  currentJobTitle: '',
  tabId: null
};

/**
 * Get all captured jobs from storage
 */
async function getJobs() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || [];
}

/**
 * Save jobs to storage
 */
async function saveJobs(jobs) {
  await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
}

/**
 * Add a new job, deduplicating by job ID
 */
async function addJob(jobData) {
  const jobs = await getJobs();
  const existingIndex = jobs.findIndex(job => job.id === jobData.id);

  if (existingIndex !== -1) {
    // Update existing job - merge new data, keeping description if we have it
    const existing = jobs[existingIndex];
    jobs[existingIndex] = {
      ...existing,
      ...jobData,
      // Keep existing description if new one is empty
      descriptionText: jobData.descriptionText || existing.descriptionText,
      descriptionHtml: jobData.descriptionHtml || existing.descriptionHtml,
      updatedAt: new Date().toISOString(),
      capturedAt: existing.capturedAt
    };
    await saveJobs(jobs);
    return { success: true, duplicate: true, job: jobs[existingIndex] };
  }

  jobs.push(jobData);
  await saveJobs(jobs);
  return { success: true, duplicate: false, job: jobData };
}

/**
 * Delete a job by ID
 */
async function deleteJob(jobId) {
  const jobs = await getJobs();
  const filtered = jobs.filter(job => job.id !== jobId);
  if (filtered.length === jobs.length) {
    return { success: false, error: 'Job not found' };
  }
  await saveJobs(filtered);
  return { success: true };
}

/**
 * Clear all captured jobs
 */
async function clearAllJobs() {
  await saveJobs([]);
  return { success: true };
}

/**
 * Get storage statistics
 */
async function getStats() {
  const jobs = await getJobs();
  const dataSize = JSON.stringify(jobs).length;
  return {
    jobCount: jobs.length,
    storageUsedBytes: dataSize,
    storageUsedKB: Math.round(dataSize / 1024 * 10) / 10
  };
}

/**
 * Export jobs as JSON
 */
async function exportJobsJSON() {
  const jobs = await getJobs();
  return {
    exportedAt: new Date().toISOString(),
    jobCount: jobs.length,
    jobs: jobs
  };
}

/**
 * Export jobs as CSV
 */
async function exportJobsCSV() {
  const jobs = await getJobs();
  if (jobs.length === 0) return '';

  const headers = ['id', 'title', 'company', 'location', 'workplaceType', 'url', 'capturedAt', 'descriptionText'];
  const escapeCSV = (field) => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = [headers.join(',')];
  for (const job of jobs) {
    const row = headers.map(header => escapeCSV(job[header]));
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for tab to finish loading
 */
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

    // Check current status
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

/**
 * Extract job data from a page (injected function)
 */
function extractJobFromPage() {
  const url = window.location.href;

  // Extract job ID
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

  // Find location - look for location-related elements
  let location = null;
  const locationSelectors = [
    '[class*="job-details-jobs-unified-top-card__bullet"]',
    '[class*="location"]',
    '[class*="Location"]',
    '.job-details-jobs-unified-top-card__primary-description-container span'
  ];
  for (const sel of locationSelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent.trim();
      // Location usually contains city/state/country or "Remote"
      if (text && (text.includes(',') || /remote|hybrid|on-?site/i.test(text)) && text.length < 100) {
        location = text;
        break;
      }
    }
    if (location) break;
  }

  // If no location found, try to find it near company name
  if (!location) {
    const topCard = document.querySelector('[class*="top-card"], [class*="TopCard"]');
    if (topCard) {
      const spans = topCard.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent.trim();
        if (text && text.includes(',') && text.length < 100 && !text.includes('http')) {
          location = text;
          break;
        }
      }
    }
  }

  // Find description - specifically "About the job" section
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
    const aboutEl = document.querySelector('[class*="AboutTheJob"], [class*="about-the-job"], [class*="description__text"]');
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

  // Method 4: Look for substantial text with job keywords
  if (!descriptionText) {
    const divs = document.querySelectorAll('div, section');
    for (const div of divs) {
      const text = div.textContent.trim();
      if (text.length > 200 && text.length < 8000) {
        if (/responsibilities|requirements|qualifications|experience|skills/i.test(text)) {
          descriptionText = text.replace(/\s+/g, ' ');
          break;
        }
      }
    }
  }

  // Clean up description - remove trailing "more", "Show more", "See more" etc.
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

/**
 * Start fetching descriptions for jobs that don't have them
 */
async function startFetchingDescriptions() {
  if (fetchState.isRunning) {
    return { success: false, error: 'Already fetching' };
  }

  const jobs = await getJobs();
  const jobsWithoutDesc = jobs.filter(j => !j.descriptionText || j.descriptionText.length === 0);

  if (jobsWithoutDesc.length === 0) {
    return { success: false, error: 'All jobs already have descriptions' };
  }

  // Reset state
  fetchState = {
    isRunning: true,
    shouldStop: false,
    currentIndex: 0,
    totalJobs: jobsWithoutDesc.length,
    fetched: 0,
    errors: 0,
    currentJobTitle: '',
    tabId: null
  };

  // Create a separate window for fetching (runs independently, doesn't steal focus from main window)
  const fetchWindow = await chrome.windows.create({
    url: jobsWithoutDesc[0].url,
    type: 'popup',
    width: 800,
    height: 600,
    left: 100,
    top: 100,
    focused: false
  });
  fetchState.tabId = fetchWindow.tabs[0].id;
  const windowId = fetchWindow.id;

  // Process jobs
  for (let i = 0; i < jobsWithoutDesc.length && !fetchState.shouldStop; i++) {
    const job = jobsWithoutDesc[i];
    fetchState.currentIndex = i;
    fetchState.currentJobTitle = job.title || 'Loading...';

    try {
      // Navigate to job page (skip first one since window was created with it)
      if (i > 0) {
        await chrome.tabs.update(fetchState.tabId, { url: job.url });
      }

      // Wait for page to load
      await waitForTabLoad(fetchState.tabId);
      await sleep(5000); // Wait for JS to render

      // Extract job data
      let captured = false;
      for (let retry = 0; retry < 3 && !captured; retry++) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: fetchState.tabId },
            func: extractJobFromPage
          });

          if (results && results[0] && results[0].result) {
            const jobData = results[0].result;
            if (jobData.descriptionText && jobData.descriptionText.length > 50) {
              await addJob(jobData);
              captured = true;
              fetchState.fetched++;
            }
          }
        } catch (e) {
          console.log('Attempt', retry + 1, 'failed:', e.message);
          if (retry < 2) await sleep(2000);
        }
      }

      if (!captured) {
        fetchState.errors++;
      }

      // Wait between jobs (4-7 seconds)
      if (i < jobsWithoutDesc.length - 1 && !fetchState.shouldStop) {
        await sleep(4000 + Math.random() * 3000);
      }
    } catch (error) {
      console.error('Error fetching job:', error);
      fetchState.errors++;
    }
  }

  // Close the window
  try {
    await chrome.windows.remove(windowId);
  } catch (e) {}

  const result = {
    success: true,
    fetched: fetchState.fetched,
    errors: fetchState.errors,
    stopped: fetchState.shouldStop
  };

  fetchState.isRunning = false;
  fetchState.tabId = null;

  return result;
}

/**
 * Stop fetching
 */
function stopFetching() {
  fetchState.shouldStop = true;
  return { success: true };
}

/**
 * Get fetch status
 */
function getFetchStatus() {
  return {
    isRunning: fetchState.isRunning,
    currentIndex: fetchState.currentIndex,
    totalJobs: fetchState.totalJobs,
    fetched: fetchState.fetched,
    errors: fetchState.errors,
    currentJobTitle: fetchState.currentJobTitle
  };
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    saveJob: async () => await addJob(message.data),
    getJobs: async () => ({ success: true, jobs: await getJobs() }),
    deleteJob: async () => await deleteJob(message.jobId),
    clearAll: async () => await clearAllJobs(),
    getStats: async () => ({ success: true, ...(await getStats()) }),
    exportJSON: async () => ({ success: true, data: await exportJobsJSON() }),
    exportCSV: async () => ({ success: true, data: await exportJobsCSV() }),
    startFetching: async () => await startFetchingDescriptions(),
    stopFetching: () => stopFetching(),
    getFetchStatus: () => getFetchStatus()
  };

  const handler = handlers[message.action];

  if (handler) {
    const result = handler();
    if (result instanceof Promise) {
      result
        .then(sendResponse)
        .catch(error => {
          console.error('[LinkedIn Analyzer] Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    } else {
      sendResponse(result);
      return false;
    }
  }

  return false;
});

console.log('[LinkedIn Analyzer] Background service worker started');
