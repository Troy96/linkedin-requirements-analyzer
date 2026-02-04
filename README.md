# LinkedIn Job Requirements Analyzer

A Chrome extension that captures job data from LinkedIn as you browse, stores it locally, and analyzes common requirements using keyword extraction and optional LLM integration.

## Features

- **Capture Jobs**: Save job listings as you browse LinkedIn
- **Local Storage**: All data stored in your browser - no external servers
- **Deduplication**: Automatically prevents duplicate captures
- **Export Data**: Export to JSON or CSV formats
- **Keyword Analysis**: Built-in skill frequency analysis
- **Study Plan**: Generate prioritized learning paths based on your skill gaps
- **LLM Analysis**: Optional deep analysis using OpenAI or Anthropic APIs

## Installation

### Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. The extension icon should appear in your toolbar

### Analyzer Scripts (Optional)

The analyzer scripts require Node.js 14 or higher.

```bash
# No npm install needed - uses only built-in Node.js modules
node analyzer/keyword_analyzer.js --help
node analyzer/llm_analyzer.js --help
```

## Usage

### Capturing Jobs

1. Go to LinkedIn and navigate to a job listing
2. Click the extension icon in your toolbar
3. Click "Capture Current Job"
4. The job details will be saved locally

You can also browse through your saved jobs on LinkedIn and capture each one as you view it.

### Viewing Captured Jobs

Click the extension icon to see:

- Total number of captured jobs
- List of all captured jobs
- Storage usage

### Exporting Data

From the extension popup:

- **Export JSON**: Full job data including descriptions
- **Export CSV**: Spreadsheet-compatible format

### Analyzing Requirements

#### Built-in Analysis (Extension)

Click "Analyze Requirements" in the popup to see:

- Most common skills by category
- Frequency counts and percentages

#### Command-line Keyword Analysis

```bash
# Basic analysis
node analyzer/keyword_analyzer.js linkedin-jobs.json

# Show top 20 skills per category
node analyzer/keyword_analyzer.js linkedin-jobs.json --top 20

# Save results to JSON
node analyzer/keyword_analyzer.js linkedin-jobs.json --output results.json

# Output as CSV
node analyzer/keyword_analyzer.js linkedin-jobs.json --csv > skills.csv
```

#### LLM Analysis (Requires API Key)

For deeper insights using AI:

```bash
# Using Anthropic Claude (default)
export ANTHROPIC_API_KEY=your-api-key
node analyzer/llm_analyzer.js linkedin-jobs.json

# Using OpenAI
export OPENAI_API_KEY=your-api-key
node analyzer/llm_analyzer.js linkedin-jobs.json --provider openai

# Save analysis to file
node analyzer/llm_analyzer.js linkedin-jobs.json --output analysis.md
```

#### Prioritized Study Plan

Generate a structured learning path based on your current skills:

1. Enter your skills in the extension popup and click "Save Skills"
2. Click "Generate Study Plan" to export `jobs-and-skills.json`
3. Run the study plan generator:

```bash
# Using Anthropic (default)
export ANTHROPIC_API_KEY=your-api-key
node analyzer/study_plan.js jobs-and-skills.json

# Using OpenAI
export OPENAI_API_KEY=your-api-key
node analyzer/study_plan.js jobs-and-skills.json --provider openai --output study-plan.md
```

The study plan includes:

- **Skill Gap Analysis**: Comparing your skills against job requirements
- **Prioritized Path**: Learning order (High Impact, Foundational, Quick Wins)
- **Weekly Schedule**: 4-8 week structured study plan
- **Resources & Projects**: Curated learning materials and portfolio ideas

The LLM analyzer provides:

- Categorized technical skills analysis
- Experience requirements summary
- Soft skills identification
- Industry trends
- Personalized recommendations

### Export Utilities

Convert exported data to different formats:

```bash
# Convert to CSV
node analyzer/export.js linkedin-jobs.json --format csv --output jobs.csv

# Create Markdown table
node analyzer/export.js linkedin-jobs.json --format markdown --output jobs.md

# Plain text for LLM input
node analyzer/export.js linkedin-jobs.json --format text --output descriptions.txt

# Compact summary by company
node analyzer/export.js linkedin-jobs.json --format summary
```

## Project Structure

```
linkedin-optimizer/
├── extension/                 # Chrome extension
│   ├── manifest.json          # Extension configuration
│   ├── content.js             # LinkedIn page data extraction
│   ├── background.js          # Storage management
│   ├── popup/
│   │   ├── popup.html         # Extension popup UI
│   │   ├── popup.js           # Popup logic
│   │   └── popup.css          # Styling
│   └── icons/                 # Extension icons
├── analyzer/
│   ├── keyword_analyzer.js    # Local keyword frequency analysis
│   ├── llm_analyzer.js        # AI-powered deep analysis
│   └── export.js              # Data export utilities
├── package.json
└── README.md
```

## Data Privacy

- All job data is stored locally in your browser using Chrome's storage API
- No data is sent to external servers (except when using the optional LLM analyzer)
- You control your data - export or delete it anytime
- The LLM analyzer sends job descriptions to OpenAI/Anthropic APIs - review their privacy policies

## Troubleshooting

### Extension not capturing jobs

1. Make sure you're on a LinkedIn job detail page (URL contains `/jobs/view/` or `/jobs/collections/`)
2. Wait for the page to fully load before capturing
3. Check the browser console for error messages

### Selectors not working

LinkedIn occasionally updates their page structure. If extraction fails:

1. Open browser DevTools (F12)
2. Inspect the job title/company/description elements
3. Update the selectors in `content.js` if needed

### Storage full

Chrome extensions have storage limits. If you've captured many jobs:

1. Export your data
2. Clear captured jobs
3. Consider deleting jobs you no longer need

## LinkedIn DOM Selectors

The extension uses these selectors (may need updates if LinkedIn changes):

| Element     | Primary Selector                                   |
| ----------- | -------------------------------------------------- |
| Job Title   | `.job-details-jobs-unified-top-card__job-title`    |
| Company     | `.job-details-jobs-unified-top-card__company-name` |
| Location    | `.job-details-jobs-unified-top-card__bullet`       |
| Description | `.jobs-description__content`                       |

## License

MIT License - feel free to modify and use as needed.
