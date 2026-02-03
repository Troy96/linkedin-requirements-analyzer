#!/usr/bin/env node

/**
 * LinkedIn Job Requirements Analyzer - LLM Analysis Script
 *
 * Uses OpenAI or Anthropic APIs for deep analysis of job requirements.
 * Requires your own API key.
 *
 * Usage:
 *   node llm_analyzer.js <jobs.json> [options]
 *
 * Options:
 *   --provider openai|anthropic  API provider (default: anthropic)
 *   --model MODEL               Model to use (default: claude-3-haiku-20240307 or gpt-4o-mini)
 *   --output FILE               Save results to file
 *   --help                      Show help message
 *
 * Environment Variables:
 *   ANTHROPIC_API_KEY           Anthropic API key
 *   OPENAI_API_KEY              OpenAI API key
 */

const fs = require('fs');
const https = require('https');

// Configuration
const CONFIG = {
  anthropic: {
    baseUrl: 'api.anthropic.com',
    path: '/v1/messages',
    defaultModel: 'claude-3-haiku-20240307',
    envKey: 'ANTHROPIC_API_KEY'
  },
  openai: {
    baseUrl: 'api.openai.com',
    path: '/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY'
  }
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputFile: null,
    provider: 'anthropic',
    model: null,
    outputFile: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--provider' || arg === '-p') {
      options.provider = args[++i];
    } else if (arg === '--model' || arg === '-m') {
      options.model = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
      options.inputFile = arg;
    }
  }

  // Set default model based on provider
  if (!options.model) {
    options.model = CONFIG[options.provider]?.defaultModel || CONFIG.anthropic.defaultModel;
  }

  return options;
}

function showHelp() {
  console.log(`
LinkedIn Job Requirements Analyzer - LLM Deep Analysis

Uses AI to provide categorized insights from job descriptions.

Usage:
  node llm_analyzer.js <jobs.json> [options]

Arguments:
  jobs.json                    Exported jobs JSON file from the extension

Options:
  --provider openai|anthropic  API provider (default: anthropic)
  --model MODEL                Model to use
                               Anthropic: claude-3-haiku-20240307, claude-3-5-sonnet-20241022
                               OpenAI: gpt-4o-mini, gpt-4o
  --output FILE, -o            Save results to file
  --help, -h                   Show this help message

Environment Variables:
  ANTHROPIC_API_KEY            Required for Anthropic provider
  OPENAI_API_KEY               Required for OpenAI provider

Examples:
  # Using Anthropic (default)
  export ANTHROPIC_API_KEY=your-key
  node llm_analyzer.js linkedin-jobs.json

  # Using OpenAI
  export OPENAI_API_KEY=your-key
  node llm_analyzer.js linkedin-jobs.json --provider openai

  # Save output to file
  node llm_analyzer.js linkedin-jobs.json --output analysis.md
`);
}

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(json)}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function callAnthropic(apiKey, model, prompt) {
  const config = CONFIG.anthropic;

  const response = await makeRequest({
    hostname: config.baseUrl,
    path: config.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  }, {
    model: model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text;
}

async function callOpenAI(apiKey, model, prompt) {
  const config = CONFIG.openai;

  const response = await makeRequest({
    hostname: config.baseUrl,
    path: config.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  }, {
    model: model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.choices[0].message.content;
}

function buildPrompt(jobs) {
  // Prepare job summaries (truncate very long descriptions)
  const jobSummaries = jobs.map((job, i) => {
    const desc = (job.descriptionText || '').substring(0, 3000);
    return `
## Job ${i + 1}: ${job.title || 'Unknown'} at ${job.company || 'Unknown'}
Location: ${job.location || 'Not specified'}

${desc}
---`;
  }).join('\n');

  return `You are an expert career advisor and job market analyst. Analyze the following ${jobs.length} job descriptions and provide comprehensive insights.

${jobSummaries}

Please provide a detailed analysis with the following sections:

## 1. Required Technical Skills
List the most commonly required technical skills, technologies, and tools. Group them by category (programming languages, frameworks, cloud platforms, databases, etc.) and indicate how many jobs mention each skill.

## 2. Required Experience & Qualifications
Summarize the common experience requirements (years of experience, education level, certifications).

## 3. Soft Skills & Cultural Fit
Identify the soft skills and cultural attributes these employers are looking for.

## 4. Common Responsibilities
What are the typical day-to-day responsibilities across these roles?

## 5. Industry Trends
What trends do you notice in these job requirements? What skills seem to be emerging as important?

## 6. Recommendations for Job Seekers
Based on this analysis, what should candidates focus on to be competitive for these types of roles?

## 7. Skills Gap Analysis
If someone has basic programming skills, what key areas should they develop to match these job requirements?

Provide specific, actionable insights based on the actual content of these job descriptions.`;
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.inputFile) {
    console.error('Error: Please provide an input JSON file');
    console.error('Usage: node llm_analyzer.js <jobs.json>');
    console.error('Run with --help for more options');
    process.exit(1);
  }

  // Validate provider
  if (!CONFIG[options.provider]) {
    console.error(`Error: Unknown provider "${options.provider}". Use "openai" or "anthropic".`);
    process.exit(1);
  }

  // Get API key
  const apiKey = process.env[CONFIG[options.provider].envKey];
  if (!apiKey) {
    console.error(`Error: ${CONFIG[options.provider].envKey} environment variable not set.`);
    console.error(`\nSet it with: export ${CONFIG[options.provider].envKey}=your-api-key`);
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

  console.log(`\nAnalyzing ${jobs.length} job(s) using ${options.provider} (${options.model})...\n`);
  console.log('This may take a moment...\n');

  try {
    const prompt = buildPrompt(jobs);

    let result;
    if (options.provider === 'anthropic') {
      result = await callAnthropic(apiKey, options.model, prompt);
    } else {
      result = await callOpenAI(apiKey, options.model, prompt);
    }

    console.log('='.repeat(70));
    console.log('LLM ANALYSIS RESULTS');
    console.log('='.repeat(70));
    console.log(`Provider: ${options.provider}`);
    console.log(`Model: ${options.model}`);
    console.log(`Jobs analyzed: ${jobs.length}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log('='.repeat(70));
    console.log('\n' + result + '\n');

    // Save to file if requested
    if (options.outputFile) {
      const output = `# LinkedIn Job Analysis Results

- **Provider:** ${options.provider}
- **Model:** ${options.model}
- **Jobs Analyzed:** ${jobs.length}
- **Date:** ${new Date().toISOString()}

---

${result}
`;
      fs.writeFileSync(options.outputFile, output);
      console.log(`\nResults saved to: ${options.outputFile}`);
    }

  } catch (error) {
    console.error('Error during analysis:', error.message);
    process.exit(1);
  }
}

main();
