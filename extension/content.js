// LinkedIn Job Requirements Analyzer - Content Script
// Extracts job data from LinkedIn job pages (both detail and list views)

(function() {
  'use strict';

  // Selectors for LinkedIn job detail page elements
  // LinkedIn uses CSS modules with dynamic class names, so we use partial matching
  const DETAIL_SELECTORS = {
    jobTitle: [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      '[class*="job-details"] h1',
      '[class*="JobDetails"] h1',
      '.t-24.t-bold.inline',
      'h1.t-24',
      '.job-detail-page h1',
      'h1[class*="title"]',
      'h1'
    ],
    companyName: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '[class*="job-details"] a[href*="/company/"]',
      '[class*="JobDetails"] a[href*="/company/"]',
      '.job-detail-page a[href*="/company/"]',
      'a[href*="/company/"]'
    ],
    location: [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '[class*="job-details"] [class*="location"]',
      '[class*="job-details"] [class*="bullet"]',
      '[class*="JobDetails"] [class*="location"]',
      '.job-detail-page [class*="location"]'
    ],
    jobDescription: [
      '[class*="AboutTheJob"]',
      '[class*="about-the-job"]',
      '[class*="description__text"]',
      '.jobs-description__content',
      '.jobs-description-content__text',
      '.jobs-box__html-content',
      '#job-details',
      '.job-detail-page [class*="description"]',
      '[class*="JobDetails"] [class*="content"]'
    ],
    workplaceType: [
      '.job-details-jobs-unified-top-card__workplace-type',
      '.jobs-unified-top-card__workplace-type',
      '[class*="workplace-type"]',
      '[class*="workplaceType"]'
    ]
  };

  // Selectors for job cards in list views (job tracker, saved jobs, search results)
  const LIST_SELECTORS = {
    // Job card containers - try multiple patterns
    jobCards: [
      // Job tracker page
      '.job-card-container',
      '.jobs-job-board-list__item',
      '.job-card-list__entity-lockup',
      // Saved jobs / my-items page
      '.reusable-search__result-container',
      '.entity-result',
      // Generic list items
      '[data-job-id]',
      '.jobs-search-results__list-item',
      '.scaffold-layout__list-item'
    ],
    // Within a card, find these elements
    cardTitle: [
      '.job-card-list__title',
      '.job-card-container__link',
      '.entity-result__title-text a',
      '.job-card-list__entity-lockup a',
      'a[data-control-name="job_card_title"]',
      '.artdeco-entity-lockup__title a',
      'a.job-card-container__link'
    ],
    cardCompany: [
      '.job-card-container__primary-description',
      '.job-card-container__company-name',
      '.entity-result__primary-subtitle',
      '.artdeco-entity-lockup__subtitle',
      '.job-card-list__entity-lockup-subtitle'
    ],
    cardLocation: [
      '.job-card-container__metadata-item',
      '.entity-result__secondary-subtitle',
      '.artdeco-entity-lockup__caption',
      '.job-card-list__entity-lockup-caption'
    ],
    cardLink: [
      'a[href*="/jobs/view/"]',
      'a[href*="currentJobId="]',
      '.job-card-container__link',
      '.job-card-list__title a'
    ]
  };

  /**
   * Special handler for jobs-tracker page which uses dynamic class names
   * Finds jobs by looking for links to job pages
   */
  function findJobsOnTrackerPage() {
    const jobs = [];
    const seen = new Set();

    // Find all links to job view pages
    const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');

    for (const link of jobLinks) {
      const href = link.href;
      const jobId = extractJobIdFromUrl(href);

      if (!jobId || seen.has(jobId)) continue;
      seen.add(jobId);

      // Try to find the card container by going up the DOM
      let card = link.closest('li') || link.closest('[role="listitem"]') || link.closest('div[class*="card"]');
      if (!card) {
        // Go up a few levels to find a reasonable container
        card = link.parentElement?.parentElement?.parentElement;
      }

      // Extract title from the link text or nearby elements
      let title = link.textContent.trim();
      if (!title || title.length < 3) {
        // Look for title in nearby elements
        const titleEl = card?.querySelector('span[aria-hidden="true"]') ||
                        card?.querySelector('strong') ||
                        card?.querySelector('[class*="title"]');
        title = titleEl?.textContent.trim() || title;
      }

      // Try to find company name
      let company = null;
      if (card) {
        // Look for company in various places
        const companyEl = card.querySelector('a[href*="/company/"]') ||
                          card.querySelector('span[class*="subtitle"]') ||
                          card.querySelectorAll('span')[1]; // Often second span is company
        company = companyEl?.textContent.trim();
      }

      // Try to find location
      let location = null;
      if (card) {
        const locationEl = card.querySelector('span[class*="location"]') ||
                          card.querySelector('[class*="caption"]');
        location = locationEl?.textContent.trim();
      }

      if (title && title.length > 2) {
        jobs.push({
          id: jobId,
          url: href,
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

    return jobs;
  }

  /**
   * Try multiple selectors and return the first match
   */
  function queryWithFallbacks(selectors, context = document) {
    for (const selector of selectors) {
      const element = context.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Try multiple selectors and return all matches
   */
  function queryAllWithFallbacks(selectors, context = document) {
    for (const selector of selectors) {
      const elements = context.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
    return [];
  }

  /**
   * Extract job ID from a URL
   */
  function extractJobIdFromUrl(url) {
    if (!url) return null;

    const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
    if (viewMatch) return viewMatch[1];

    const paramMatch = url.match(/currentJobId=(\d+)/);
    if (paramMatch) return paramMatch[1];

    const collectionsMatch = url.match(/\/jobs\/collections\/[^/]+\/(\d+)/);
    if (collectionsMatch) return collectionsMatch[1];

    // Try to find any number sequence that looks like a job ID (10+ digits)
    const anyIdMatch = url.match(/(\d{10,})/);
    if (anyIdMatch) return anyIdMatch[1];

    return null;
  }

  /**
   * Extract job ID from the current URL
   */
  function extractJobId() {
    return extractJobIdFromUrl(window.location.href);
  }

  /**
   * Clean and extract text content from an element
   * Uses TreeWalker to handle deeply nested text nodes
   */
  function getCleanText(element) {
    if (!element) return null;

    // First try direct textContent
    let text = element.textContent.trim().replace(/\s+/g, ' ');

    // If that's empty or very short, try TreeWalker for nested text
    if (!text || text.length < 3) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
      let fullText = '';
      let node;
      while (node = walker.nextNode()) {
        fullText += node.textContent + ' ';
      }
      text = fullText.trim().replace(/\s+/g, ' ');
    }

    return text || null;
  }

  /**
   * Extract the full job description HTML and text
   */
  function extractJobDescription() {
    console.log('[LinkedIn Analyzer] Attempting to extract job description...');

    // Try standard selectors first
    let descElement = queryWithFallbacks(DETAIL_SELECTORS.jobDescription);
    if (descElement) {
      console.log('[LinkedIn Analyzer] Found via standard selectors');
    }

    // Fallback: look for elements with "About" in class name that have substantial text
    if (!descElement) {
      const candidates = document.querySelectorAll('[class*="About"], [class*="about"], [class*="Description"], [class*="description"]');
      console.log('[LinkedIn Analyzer] Checking', candidates.length, 'candidates with About/Description in class');
      for (const el of candidates) {
        const text = el.textContent.trim();
        if (text.length > 200) {
          descElement = el;
          console.log('[LinkedIn Analyzer] Found via class name partial match, length:', text.length);
          break;
        }
      }
    }

    // Fallback: find the largest text block in the job detail area
    if (!descElement) {
      const jobDetailPage = document.querySelector('.job-detail-page, [class*="job-detail"], [class*="JobDetail"], main, [role="main"]');
      console.log('[LinkedIn Analyzer] Job detail area found:', !!jobDetailPage);
      if (jobDetailPage) {
        const allDivs = jobDetailPage.querySelectorAll('div, section, article');
        let maxLen = 0;
        for (const div of allDivs) {
          const text = div.textContent.trim();
          if (text.length > maxLen && text.length > 300) {
            maxLen = text.length;
            descElement = div;
          }
        }
        if (descElement) {
          console.log('[LinkedIn Analyzer] Found largest text block, length:', maxLen);
        }
      }
    }

    // Last resort: find ANY element with substantial text
    if (!descElement) {
      console.log('[LinkedIn Analyzer] Trying last resort - scanning all elements');
      const allElements = document.querySelectorAll('div, section, article, p');
      let bestElement = null;
      let bestScore = 0;

      for (const el of allElements) {
        const text = el.textContent.trim();
        // Look for elements with job-related keywords
        const hasKeywords = /experience|requirements|qualifications|responsibilities|skills|about|role|position/i.test(text);
        const score = text.length + (hasKeywords ? 500 : 0);

        if (text.length > 300 && score > bestScore) {
          bestScore = score;
          bestElement = el;
        }
      }

      if (bestElement) {
        descElement = bestElement;
        console.log('[LinkedIn Analyzer] Found via last resort scan, length:', bestElement.textContent.length);
      }
    }

    if (!descElement) {
      console.log('[LinkedIn Analyzer] Could not find job description');
      return { html: null, text: null };
    }

    return {
      html: descElement.innerHTML,
      text: descElement.textContent.trim().replace(/\s+/g, ' ')
    };
  }

  /**
   * Extract job data from the current detail view page
   */
  function extractJobData() {
    console.log('[LinkedIn Analyzer] extractJobData called, URL:', window.location.href);

    const jobId = extractJobId();
    console.log('[LinkedIn Analyzer] Extracted job ID:', jobId);

    if (!jobId) {
      console.log('[LinkedIn Analyzer] No job ID found in URL');
      return null;
    }

    let titleElement = queryWithFallbacks(DETAIL_SELECTORS.jobTitle);
    let companyElement = queryWithFallbacks(DETAIL_SELECTORS.companyName);
    const locationElement = queryWithFallbacks(DETAIL_SELECTORS.location);
    const workplaceElement = queryWithFallbacks(DETAIL_SELECTORS.workplaceType);

    console.log('[LinkedIn Analyzer] Title element found:', !!titleElement);
    console.log('[LinkedIn Analyzer] Company element found:', !!companyElement);

    // Fallback for title: find any h1 or h2 in job detail area
    if (!titleElement) {
      const jobArea = document.querySelector('.job-detail-page, [class*="job-detail"], [class*="JobDetail"], main, [role="main"]');
      if (jobArea) {
        titleElement = jobArea.querySelector('h1') || jobArea.querySelector('h2');
        console.log('[LinkedIn Analyzer] Title from fallback:', !!titleElement);
      }
    }

    // Fallback for title: just get any h1
    if (!titleElement) {
      titleElement = document.querySelector('h1');
      console.log('[LinkedIn Analyzer] Title from h1:', !!titleElement);
    }

    // Fallback for company: find link to company page
    if (!companyElement) {
      companyElement = document.querySelector('a[href*="/company/"]');
      console.log('[LinkedIn Analyzer] Company from fallback:', !!companyElement);
    }

    const description = extractJobDescription();

    const jobData = {
      id: jobId,
      url: window.location.href,
      title: getCleanText(titleElement),
      company: getCleanText(companyElement),
      location: getCleanText(locationElement),
      workplaceType: getCleanText(workplaceElement),
      descriptionHtml: description.html,
      descriptionText: description.text,
      capturedAt: new Date().toISOString()
    };

    console.log('[LinkedIn Analyzer] Extracted data - Title:', jobData.title, '| Company:', jobData.company, '| Desc length:', jobData.descriptionText?.length || 0);

    // Be very lenient - if we have ANY useful data, return it
    if (!jobData.descriptionText && !jobData.title) {
      console.log('[LinkedIn Analyzer] Could not extract any useful data - page may not be fully loaded');
      return null;
    }

    // If we have description but no title, use placeholder
    if (!jobData.title) {
      jobData.title = 'Unknown Title';
    }

    return jobData;
  }

  /**
   * Extract job data from a single job card element
   */
  function extractJobFromCard(card) {
    // Find job link and extract ID
    const linkElement = queryWithFallbacks(LIST_SELECTORS.cardLink, card);
    const href = linkElement?.href || card.querySelector('a')?.href;
    const jobId = extractJobIdFromUrl(href);

    // Also check for data-job-id attribute
    const dataJobId = card.getAttribute('data-job-id') ||
                      card.querySelector('[data-job-id]')?.getAttribute('data-job-id');

    const finalJobId = jobId || dataJobId;

    if (!finalJobId) {
      console.log('[LinkedIn Analyzer] Could not find job ID in card');
      return null;
    }

    // Extract other details
    const titleElement = queryWithFallbacks(LIST_SELECTORS.cardTitle, card);
    const companyElement = queryWithFallbacks(LIST_SELECTORS.cardCompany, card);
    const locationElement = queryWithFallbacks(LIST_SELECTORS.cardLocation, card);

    const title = getCleanText(titleElement);
    const company = getCleanText(companyElement);

    if (!title) {
      console.log('[LinkedIn Analyzer] Could not find title in card');
      return null;
    }

    const jobUrl = href || `https://www.linkedin.com/jobs/view/${finalJobId}/`;

    return {
      id: finalJobId,
      url: jobUrl,
      title: title,
      company: company,
      location: getCleanText(locationElement),
      workplaceType: null,
      descriptionHtml: null,
      descriptionText: null, // Not available in list view
      capturedAt: new Date().toISOString(),
      capturedFromList: true // Flag to indicate this needs description fetch
    };
  }

  /**
   * Find all job cards on the current page
   */
  function findJobCards() {
    const cards = queryAllWithFallbacks(LIST_SELECTORS.jobCards);
    if (cards.length > 0) {
      console.log(`[LinkedIn Analyzer] Found ${cards.length} potential job cards`);
      return cards;
    }

    // Fallback for jobs-tracker: count job links instead
    const jobLinks = document.querySelectorAll('a[href*="/jobs/view/"]');
    const uniqueJobIds = new Set();
    for (const link of jobLinks) {
      const jobId = extractJobIdFromUrl(link.href);
      if (jobId) uniqueJobIds.add(jobId);
    }

    console.log(`[LinkedIn Analyzer] Found ${uniqueJobIds.size} jobs via link detection`);
    // Return a fake array of the right length for counting purposes
    return Array.from(uniqueJobIds).map(id => ({ id }));
  }

  /**
   * Extract all jobs from the current list view
   */
  function extractAllJobsFromList() {
    const url = window.location.href;

    // Special handling for jobs-tracker page
    if (url.includes('/jobs-tracker')) {
      const jobs = findJobsOnTrackerPage();
      console.log(`[LinkedIn Analyzer] Extracted ${jobs.length} jobs from tracker page`);
      return jobs;
    }

    // Standard card-based extraction
    const cards = findJobCards();
    const jobs = [];
    const seen = new Set();

    for (const card of cards) {
      const job = extractJobFromCard(card);
      if (job && !seen.has(job.id)) {
        seen.add(job.id);
        jobs.push(job);
      }
    }

    // Fallback: if no cards found, try the tracker method anyway
    if (jobs.length === 0) {
      const trackerJobs = findJobsOnTrackerPage();
      if (trackerJobs.length > 0) {
        console.log(`[LinkedIn Analyzer] Fallback: extracted ${trackerJobs.length} jobs via link detection`);
        return trackerJobs;
      }
    }

    console.log(`[LinkedIn Analyzer] Extracted ${jobs.length} unique jobs from list`);
    return jobs;
  }

  /**
   * Detect if we're on a list view vs detail view
   */
  function detectPageType() {
    const url = window.location.href;

    // Check for detail view URLs
    if (url.includes('/jobs/view/')) {
      return 'detail';
    }

    // Check for list views
    if (url.includes('/my-items/saved-jobs') ||
        url.includes('/jobs-tracker') ||
        url.includes('/jobs/tracker') ||
        url.includes('/jobs/collections') ||
        url.includes('/jobs/search')) {
      return 'list';
    }

    // Check if we have job cards on the page
    const cards = findJobCards();
    if (cards.length > 0) {
      return 'list';
    }

    // Check if we have a detail view
    const hasDescription = queryWithFallbacks(DETAIL_SELECTORS.jobDescription);
    if (hasDescription) {
      return 'detail';
    }

    return 'unknown';
  }

  /**
   * Save job data via background service worker
   */
  function saveJobData(jobData) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'saveJob', data: jobData },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error(response?.error || 'Unknown error'));
          }
        }
      );
    });
  }

  /**
   * Show a notification toast on the page
   */
  function showToast(message, isError = false, duration = 3000) {
    const existing = document.getElementById('linkedin-analyzer-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'linkedin-analyzer-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${isError ? '#d32f2f' : '#0A66C2'};
      color: white;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Update toast message
   */
  function updateToast(message) {
    const toast = document.getElementById('linkedin-analyzer-toast');
    if (toast) {
      toast.textContent = message;
    }
  }

  /**
   * Handle single job capture request
   */
  async function handleCaptureRequest() {
    try {
      const jobData = extractJobData();

      if (!jobData) {
        showToast('Could not extract job data. Make sure you\'re viewing a job listing.', true);
        return { success: false, error: 'No job data found' };
      }

      const response = await saveJobData(jobData);

      if (response.duplicate) {
        showToast('Job already captured: ' + jobData.title);
      } else {
        showToast('Captured: ' + jobData.title);
      }

      return { success: true, duplicate: response.duplicate, jobData };
    } catch (error) {
      console.error('[LinkedIn Analyzer] Error capturing job:', error);
      showToast('Error capturing job: ' + error.message, true);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle capture all jobs from list view
   */
  async function handleCaptureAllFromList() {
    try {
      const jobs = extractAllJobsFromList();

      if (jobs.length === 0) {
        showToast('No jobs found on this page. Try scrolling to load more.', true);
        return { success: false, error: 'No jobs found', captured: 0 };
      }

      showToast(`Capturing ${jobs.length} jobs...`, false, 30000);

      let captured = 0;
      let duplicates = 0;
      let errors = 0;

      for (let i = 0; i < jobs.length; i++) {
        try {
          const response = await saveJobData(jobs[i]);
          if (response.duplicate) {
            duplicates++;
          } else {
            captured++;
          }
          updateToast(`Capturing jobs: ${i + 1}/${jobs.length}`);
        } catch (error) {
          console.error('[LinkedIn Analyzer] Error saving job:', error);
          errors++;
        }
      }

      const message = `Captured ${captured} new jobs` +
                      (duplicates > 0 ? `, ${duplicates} duplicates` : '') +
                      (errors > 0 ? `, ${errors} errors` : '');

      showToast(message, errors > 0 && captured === 0);

      return {
        success: true,
        captured,
        duplicates,
        errors,
        total: jobs.length
      };
    } catch (error) {
      console.error('[LinkedIn Analyzer] Error capturing jobs:', error);
      showToast('Error capturing jobs: ' + error.message, true);
      return { success: false, error: error.message, captured: 0 };
    }
  }

  /**
   * Get page info for popup
   */
  function getPageInfo() {
    const pageType = detectPageType();
    let jobCount = 0;

    if (pageType === 'list') {
      // For tracker page, use link detection for accurate count
      if (window.location.href.includes('/jobs-tracker')) {
        const jobs = findJobsOnTrackerPage();
        jobCount = jobs.length;
      } else {
        jobCount = findJobCards().length;
      }
    } else {
      jobCount = extractJobId() ? 1 : 0;
    }

    return {
      pageType,
      jobCount,
      url: window.location.href
    };
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureJob') {
      handleCaptureRequest().then(sendResponse);
      return true;
    }

    if (message.action === 'captureAllFromList') {
      handleCaptureAllFromList().then(sendResponse);
      return true;
    }

    if (message.action === 'getJobData') {
      const jobData = extractJobData();
      sendResponse({ success: !!jobData, data: jobData });
      return false;
    }

    if (message.action === 'getPageInfo') {
      const pageInfo = getPageInfo();
      sendResponse({ success: true, ...pageInfo });
      return false;
    }

    if (message.action === 'getJobsFromList') {
      const jobs = extractAllJobsFromList();
      sendResponse({ success: true, jobs });
      return false;
    }
  });

  // Log that content script is loaded
  const pageType = detectPageType();
  console.log(`[LinkedIn Analyzer] Content script loaded on ${pageType} page:`, window.location.href);
})();
