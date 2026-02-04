# Development Notes

This document summarizes the key features, fixes, and design decisions made during development of the LinkedIn Job Requirements Analyzer.

## Overview

A Chrome extension + CLI toolkit to capture LinkedIn job listings and analyze skill requirements across multiple jobs to help with job search preparation.

---

## Key Features Built

### 1. Chrome Extension - Job Capture

**Multi-page support:**
- Detail view (`/jobs/view/123`) - Captures single job with full description
- List views (`/my-items/saved-jobs`, `/jobs-tracker`, `/jobs/collections`) - Bulk capture visible jobs
- Search results page support

**Robust DOM extraction (content.js):**
- Multiple fallback selectors for each element (title, company, location, description)
- LinkedIn uses CSS modules with dynamic class names - we use partial class matching (`[class*="job-title"]`)
- TreeWalker for extracting text from deeply nested spans
- Special handler for jobs-tracker page which has particularly dynamic markup

**Key fixes:**
- Title extraction: Falls back through h1 → data attributes → prominent text blocks
- Description extraction: Finds "About the job" section, tries class patterns, then largest text block with job keywords
- Job ID extraction: Handles `/jobs/view/123`, `currentJobId=123`, and `/jobs/collections/*/123` URL patterns

### 2. Background Description Fetching

For jobs captured from list views (which don't include descriptions):
- Opens a separate popup window (doesn't steal focus from main browser)
- Navigates to each job page sequentially
- Waits for page load + JS rendering (5 seconds)
- Retries failed extractions up to 3 times
- Rate limited (4-7 second delays) to avoid LinkedIn detection
- Progress tracking with stop capability

### 3. Storage & Deduplication

- Uses Chrome's local storage API
- Deduplicates by LinkedIn job ID
- Merges data when re-capturing (preserves existing description if new one empty)
- ~5MB limit supports 500+ jobs easily

### 4. Skill Analysis

**Built-in popup analysis:**
- 7 skill categories, 100+ keywords
- Real-time frequency counting with regex word-boundary matching
- Visual bar charts showing relative skill popularity
- Shows percentage of jobs mentioning each skill

**Command-line keyword analyzer (analyzer/keyword_analyzer.js):**
- 11+ expanded categories
- Multiple output formats: table, CSV, JSON
- Configurable top-N filtering
- Metrics: count, percentage, avg occurrences per job

**LLM deep analysis (analyzer/llm_analyzer.js):**
- Supports Anthropic Claude and OpenAI
- Generates: skill breakdown, experience requirements, common responsibilities, industry trends
- Personalized study recommendations
- Skills gap analysis

### 5. Export Options

**From extension popup:**
- JSON (full data including HTML)
- CSV (spreadsheet-compatible)

**From CLI (analyzer/export.js):**
- JSON, CSV, Markdown table, Plain text
- Summary view grouped by company

---

## Technical Decisions

### Why multiple selector fallbacks?
LinkedIn's frontend uses CSS modules that generate dynamic class names (e.g., `jobs-unified-top-card__job-title--abc123`). The actual class names change frequently. By checking multiple selectors and using partial matching, we maintain compatibility across LinkedIn updates.

### Why separate background window for fetching?
Creating a popup window with `focused: false` allows the fetch process to run without interrupting the user's main browser window. They can continue browsing while descriptions are fetched.

### Why no npm dependencies?
The CLI tools use only Node.js built-ins (`fs`, `https`, `path`). This keeps the project simple and avoids dependency management for what are essentially standalone scripts.

### Why regex word-boundary matching for skills?
Using `\b` word boundaries prevents false positives like matching "Java" in "JavaScript". Case-insensitive matching handles variations like "AWS" vs "aws".

---

## File Structure

```
extension/
├── manifest.json       # Chrome extension manifest (v3)
├── content.js          # Injected into LinkedIn - DOM extraction
├── background.js       # Service worker - storage, fetch orchestration
└── popup/
    ├── popup.html      # Extension popup UI
    ├── popup.css       # Styling
    └── popup.js        # UI logic, local analysis

analyzer/
├── keyword_analyzer.js # CLI keyword frequency analysis
├── llm_analyzer.js     # CLI LLM-powered deep analysis
└── export.js           # CLI export utilities
```

---

## Known Limitations

1. **List view captures lack descriptions** - By design, list pages don't show full job descriptions. Use "Fetch Descriptions" or open each job individually.

2. **LinkedIn DOM changes** - LinkedIn periodically updates their frontend. If extraction breaks, check the selector arrays in content.js and background.js.

3. **Rate limiting** - Fetching many descriptions too quickly may trigger LinkedIn's anti-automation. The built-in delays help, but be cautious with large batches.

4. **No real-time sync** - Jobs are stored locally. Export regularly if you want backups.

---

## Usage Quick Reference

**Capture jobs:**
1. Navigate to LinkedIn saved jobs or job tracker
2. Click extension icon → "Capture All Visible"
3. For full descriptions: Click "Fetch Descriptions" or capture from detail pages

**Analyze skills:**
- In popup: Click "Analyze Requirements"
- CLI: `node analyzer/keyword_analyzer.js exported-jobs.json`
- Deep analysis: `ANTHROPIC_API_KEY=xxx node analyzer/llm_analyzer.js exported-jobs.json`

**Export:**
- Popup: JSON or CSV buttons
- CLI: `node analyzer/export.js exported-jobs.json --format markdown`
