# LinkedIn Job Requirements Analyzer - PRD

## Problem Statement

Users save jobs on LinkedIn but have no way to analyze common requirements across their saved positions. LinkedIn provides no API for this data, and automated scraping risks account suspension.

## Solution

A Chrome extension that safely captures job data as users manually browse their saved jobs, stores it locally, and analyzes common requirements using keyword extraction and optional LLM integration.

## Goals

- Extract job data from LinkedIn without automated scraping
- Store all data locally for privacy
- Identify most common skills/requirements across 50+ saved jobs
- Provide both quick local analysis and deeper LLM-powered insights

## Non-Goals

- Automated scraping or bulk data collection
- Cloud storage of job data
- Job application automation

---

## User Flow

1. Install extension in Chrome (developer mode)
2. Navigate to LinkedIn → Jobs → Saved Jobs
3. Click on each saved job to view details
4. Click extension icon → "Capture Job" (or enable auto-capture)
5. Repeat for all saved jobs
6. Click "Analyze" to see common requirements summary
7. Optionally export data and run LLM analysis for deeper insights

---

## Technical Architecture

### Project Structure

```
linkedin-optimizer/
├── extension/                 # Chrome extension
│   ├── manifest.json          # Extension config (Manifest V3)
│   ├── content.js             # Extracts job data from LinkedIn pages
│   ├── background.js          # Service worker for storage management
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.js           # Popup logic
│   │   └── popup.css          # Styling
│   └── icons/                 # Extension icons
├── analyzer/                  # Analysis tools (runs separately)
│   ├── keyword_analyzer.js    # Local keyword extraction
│   ├── llm_analyzer.js        # LLM-based analysis
│   └── export.js              # Export utilities
├── package.json
└── README.md
```

### Components

#### 1. Chrome Extension (Manifest V3)

**Permissions Required:**
- `storage` - Store captured job data locally
- `activeTab` - Access current tab content
- Host permission for `*.linkedin.com/*`

**Content Script (`content.js`)**
- Runs on LinkedIn job detail pages
- Extracts:
  - Job title
  - Company name
  - Location
  - Full job description
  - Job ID (from URL, for deduplication)
- Injects "Capture" button or listens for popup command

**Background Service Worker (`background.js`)**
- Manages `chrome.storage.local` API
- Handles message passing between content script and popup
- Deduplicates jobs by ID

**Popup UI**
- Shows captured job count
- Lists captured jobs (title + company)
- Buttons: Capture Current Job, Export Data, Analyze, Clear

#### 2. Analyzer Tools

**Keyword Analyzer (Local)**
- Parses job descriptions for requirements/qualifications sections
- Maintains list of common skill keywords (languages, tools, soft skills)
- Counts frequency across all captured jobs
- Outputs ranked list of most common requirements

**LLM Analyzer (Optional)**
- Exports job descriptions for external analysis
- Script to call OpenAI/Anthropic API
- Prompt categorizes requirements into:
  - Technical skills
  - Soft skills
  - Experience requirements
  - Education requirements
- User provides their own API key

---

## Data Model

### Job Object

```json
{
  "id": "linkedin-job-id",
  "title": "Software Engineer",
  "company": "Acme Corp",
  "location": "San Francisco, CA",
  "description": "Full job description text...",
  "capturedAt": "2024-02-02T12:00:00Z",
  "url": "https://linkedin.com/jobs/view/..."
}
```

### Analysis Output

```json
{
  "totalJobs": 52,
  "analyzedAt": "2024-02-02T12:30:00Z",
  "topRequirements": [
    { "skill": "Python", "count": 38, "percentage": 73 },
    { "skill": "JavaScript", "count": 31, "percentage": 60 },
    { "skill": "AWS", "count": 28, "percentage": 54 }
  ],
  "categories": {
    "programmingLanguages": ["Python", "JavaScript", "TypeScript"],
    "cloudPlatforms": ["AWS", "GCP"],
    "softSkills": ["Communication", "Collaboration"]
  }
}
```

---

## LinkedIn DOM Selectors

These may change; designed to be easily updatable:

| Element | Selector |
|---------|----------|
| Job Title | `.job-details-jobs-unified-top-card__job-title` |
| Company | `.job-details-jobs-unified-top-card__company-name` |
| Location | `.job-details-jobs-unified-top-card__bullet` |
| Description | `.jobs-description__content` |
| Job ID | URL parameter or `data-job-id` attribute |

---

## Implementation Phases

### Phase 1: Extension Core
- [ ] Create manifest.json with Manifest V3 config
- [ ] Implement content.js for data extraction
- [ ] Implement background.js for storage
- [ ] Create basic popup UI

### Phase 2: Capture & Storage
- [ ] Job capture functionality
- [ ] Deduplication logic
- [ ] Job list display in popup
- [ ] Export to JSON/CSV

### Phase 3: Local Analysis
- [ ] Keyword extraction from descriptions
- [ ] Skill frequency counting
- [ ] Requirements ranking display

### Phase 4: LLM Integration
- [ ] Export format for LLM analysis
- [ ] API integration script
- [ ] Categorized summary output

---

## Verification Checklist

1. **Extension loads**: Load unpacked in Chrome, icon visible
2. **Content script runs**: Navigate to LinkedIn job, check console
3. **Capture works**: Click capture, job appears in popup list
4. **Deduplication**: Same job captured twice = one entry
5. **Export works**: JSON file downloads with correct structure
6. **Keyword analysis**: Analyze 5+ jobs, skill frequency shown
7. **LLM analysis**: Run with API key, get categorized summary

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LinkedIn DOM changes | Use flexible selectors, document update process |
| Storage limits | Chrome local storage = 5MB, ~500+ jobs easily |
| User forgets to capture | Add optional auto-capture mode |
| LLM costs | User provides own API key, show token estimate |

---

## Success Metrics

- User can capture 50+ jobs without account issues
- Analysis identifies top 10 common requirements
- Total time < 30 minutes for full workflow (vs hours of manual work)
