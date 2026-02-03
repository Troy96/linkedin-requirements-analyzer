#!/usr/bin/env node

/**
 * LinkedIn Job Requirements Analyzer - Export Utilities
 *
 * Utility functions for converting and exporting job data in different formats.
 *
 * Usage:
 *   node export.js <jobs.json> --format <format> [--output <file>]
 *
 * Formats:
 *   csv        Export as CSV
 *   markdown   Export as Markdown table
 *   text       Export as plain text (descriptions only, for LLM input)
 *   summary    Export job summaries only (no full descriptions)
 */

const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputFile: null,
    format: 'csv',
    outputFile: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
      options.inputFile = arg;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
LinkedIn Job Data Export Utility

Converts exported job JSON to various formats.

Usage:
  node export.js <jobs.json> --format <format> [options]

Arguments:
  jobs.json              Exported jobs JSON file from the extension

Options:
  --format, -f FORMAT    Output format: csv, markdown, text, summary (default: csv)
  --output, -o FILE      Save to file (otherwise prints to stdout)
  --help, -h             Show this help message

Formats:
  csv       Comma-separated values for spreadsheets
  markdown  Markdown table format
  text      Plain text with descriptions (ideal for LLM input)
  summary   Job titles and companies only (compact)

Examples:
  node export.js jobs.json --format csv --output jobs.csv
  node export.js jobs.json --format markdown
  node export.js jobs.json --format text > descriptions.txt
`);
}

function escapeCSV(field) {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function exportCSV(jobs) {
  const headers = ['id', 'title', 'company', 'location', 'workplaceType', 'url', 'capturedAt'];
  const rows = [headers.join(',')];

  for (const job of jobs) {
    const row = headers.map(header => escapeCSV(job[header]));
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function exportMarkdown(jobs) {
  let output = '# Captured LinkedIn Jobs\n\n';
  output += `*Exported on ${new Date().toISOString()}*\n\n`;
  output += `Total jobs: ${jobs.length}\n\n`;

  output += '| # | Title | Company | Location | Date |\n';
  output += '|---|-------|---------|----------|------|\n';

  jobs.forEach((job, index) => {
    const title = (job.title || 'Unknown').replace(/\|/g, '\\|');
    const company = (job.company || 'Unknown').replace(/\|/g, '\\|');
    const location = (job.location || '-').replace(/\|/g, '\\|');
    const date = job.capturedAt ? new Date(job.capturedAt).toLocaleDateString() : '-';
    output += `| ${index + 1} | ${title} | ${company} | ${location} | ${date} |\n`;
  });

  return output;
}

function exportText(jobs) {
  let output = `LinkedIn Job Descriptions Export\n`;
  output += `${'='.repeat(50)}\n`;
  output += `Total jobs: ${jobs.length}\n`;
  output += `Exported: ${new Date().toISOString()}\n`;
  output += `${'='.repeat(50)}\n\n`;

  jobs.forEach((job, index) => {
    output += `${'─'.repeat(50)}\n`;
    output += `JOB ${index + 1}: ${job.title || 'Unknown Title'}\n`;
    output += `Company: ${job.company || 'Unknown'}\n`;
    output += `Location: ${job.location || 'Not specified'}\n`;
    output += `URL: ${job.url || 'N/A'}\n`;
    output += `${'─'.repeat(50)}\n\n`;
    output += `${job.descriptionText || 'No description available.'}\n\n`;
  });

  return output;
}

function exportSummary(jobs) {
  let output = `LinkedIn Jobs Summary (${jobs.length} jobs)\n`;
  output += `${'='.repeat(50)}\n\n`;

  // Group by company
  const byCompany = {};
  for (const job of jobs) {
    const company = job.company || 'Unknown Company';
    if (!byCompany[company]) {
      byCompany[company] = [];
    }
    byCompany[company].push(job);
  }

  // Sort companies by job count
  const sortedCompanies = Object.entries(byCompany)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [company, companyJobs] of sortedCompanies) {
    output += `${company} (${companyJobs.length} job${companyJobs.length > 1 ? 's' : ''})\n`;
    for (const job of companyJobs) {
      output += `  • ${job.title || 'Unknown Title'}`;
      if (job.location) {
        output += ` - ${job.location}`;
      }
      output += '\n';
    }
    output += '\n';
  }

  return output;
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.inputFile) {
    console.error('Error: Please provide an input JSON file');
    console.error('Usage: node export.js <jobs.json> --format <format>');
    console.error('Run with --help for more options');
    process.exit(1);
  }

  // Load jobs data
  let data;
  try {
    const content = fs.readFileSync(options.inputFile, 'utf-8');
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }

  const jobs = Array.isArray(data) ? data : (data.jobs || []);

  if (jobs.length === 0) {
    console.error('Error: No jobs found in the input file');
    process.exit(1);
  }

  // Export based on format
  let output;
  switch (options.format.toLowerCase()) {
    case 'csv':
      output = exportCSV(jobs);
      break;
    case 'markdown':
    case 'md':
      output = exportMarkdown(jobs);
      break;
    case 'text':
    case 'txt':
      output = exportText(jobs);
      break;
    case 'summary':
      output = exportSummary(jobs);
      break;
    default:
      console.error(`Error: Unknown format "${options.format}"`);
      console.error('Valid formats: csv, markdown, text, summary');
      process.exit(1);
  }

  // Output
  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, output);
    console.error(`Exported ${jobs.length} jobs to ${options.outputFile}`);
  } else {
    console.log(output);
  }
}

main();
