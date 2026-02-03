#!/usr/bin/env node

/**
 * LinkedIn Job Requirements Analyzer - Keyword Analysis Script
 *
 * Analyzes exported job data to find the most common skills and requirements.
 *
 * Usage:
 *   node keyword_analyzer.js <jobs.json> [--top N] [--output output.json]
 *
 * Options:
 *   --top N        Show top N skills per category (default: 15)
 *   --output FILE  Save results to JSON file
 *   --csv          Output as CSV instead of table
 *   --help         Show this help message
 */

const fs = require('fs');
const path = require('path');

// Comprehensive skill keywords organized by category
const SKILL_KEYWORDS = {
  'Programming Languages': [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust',
    'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'bash', 'shell',
    'sql', 'html', 'css', 'sass', 'less', 'objective-c', 'dart', 'elixir', 'clojure',
    'haskell', 'lua', 'groovy', 'powershell', 'vba'
  ],
  'Frontend Frameworks': [
    'react', 'angular', 'vue', 'svelte', 'next.js', 'nextjs', 'nuxt', 'gatsby',
    'redux', 'mobx', 'vuex', 'pinia', 'jquery', 'backbone', 'ember',
    'webpack', 'vite', 'parcel', 'rollup', 'babel', 'esbuild'
  ],
  'Backend Frameworks': [
    'node.js', 'nodejs', 'express', 'fastify', 'nestjs', 'koa',
    'django', 'flask', 'fastapi', 'tornado',
    'spring', 'spring boot', 'quarkus', 'micronaut',
    '.net', 'asp.net', 'entity framework',
    'rails', 'ruby on rails', 'sinatra',
    'laravel', 'symfony', 'codeigniter',
    'gin', 'echo', 'fiber'
  ],
  'Cloud Platforms': [
    'aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudformation', 'ecs', 'eks',
    'azure', 'azure devops', 'azure functions',
    'gcp', 'google cloud', 'bigquery', 'cloud functions',
    'heroku', 'vercel', 'netlify', 'digitalocean', 'linode',
    'cloudflare', 'akamai'
  ],
  'DevOps & Infrastructure': [
    'docker', 'kubernetes', 'k8s', 'helm', 'istio',
    'terraform', 'pulumi', 'cloudformation', 'ansible', 'chef', 'puppet',
    'jenkins', 'gitlab ci', 'github actions', 'circleci', 'travis ci', 'teamcity',
    'ci/cd', 'continuous integration', 'continuous deployment',
    'linux', 'unix', 'ubuntu', 'centos', 'rhel',
    'nginx', 'apache', 'haproxy', 'traefik',
    'prometheus', 'grafana', 'datadog', 'new relic', 'splunk', 'elk'
  ],
  'Databases': [
    'postgresql', 'postgres', 'mysql', 'mariadb', 'sql server', 'oracle', 'sqlite',
    'mongodb', 'dynamodb', 'couchdb', 'cassandra', 'scylla',
    'redis', 'memcached', 'elasticsearch', 'opensearch',
    'neo4j', 'arangodb', 'dgraph',
    'firebase', 'supabase', 'planetscale', 'cockroachdb'
  ],
  'APIs & Integration': [
    'rest', 'restful', 'graphql', 'grpc', 'soap', 'webhooks',
    'api', 'api design', 'openapi', 'swagger',
    'oauth', 'jwt', 'saml', 'oidc',
    'kafka', 'rabbitmq', 'sqs', 'sns', 'pubsub', 'nats',
    'websocket', 'socket.io'
  ],
  'AI & Machine Learning': [
    'machine learning', 'ml', 'deep learning', 'neural network',
    'ai', 'artificial intelligence', 'generative ai', 'llm', 'large language model',
    'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn',
    'pandas', 'numpy', 'scipy', 'matplotlib',
    'nlp', 'natural language processing', 'computer vision', 'cv',
    'hugging face', 'openai', 'langchain', 'llamaindex',
    'mlops', 'mlflow', 'kubeflow', 'sagemaker'
  ],
  'Data Engineering': [
    'data engineering', 'data pipeline', 'etl', 'elt',
    'spark', 'pyspark', 'hadoop', 'hive', 'presto', 'trino',
    'airflow', 'dagster', 'prefect', 'dbt',
    'snowflake', 'databricks', 'redshift', 'bigquery',
    'data warehouse', 'data lake', 'data modeling'
  ],
  'Testing': [
    'unit testing', 'integration testing', 'e2e testing', 'end-to-end',
    'tdd', 'test-driven', 'bdd', 'behavior-driven',
    'jest', 'mocha', 'chai', 'jasmine', 'vitest',
    'pytest', 'unittest', 'nose',
    'junit', 'testng', 'mockito',
    'cypress', 'playwright', 'selenium', 'puppeteer',
    'postman', 'insomnia'
  ],
  'Mobile Development': [
    'ios', 'android', 'mobile', 'react native', 'flutter', 'xamarin',
    'swift', 'swiftui', 'uikit', 'kotlin', 'jetpack compose',
    'expo', 'ionic', 'cordova', 'capacitor'
  ],
  'Version Control & Collaboration': [
    'git', 'github', 'gitlab', 'bitbucket', 'svn',
    'code review', 'pull request', 'merge request',
    'jira', 'confluence', 'notion', 'linear', 'asana', 'trello'
  ],
  'Methodologies': [
    'agile', 'scrum', 'kanban', 'lean', 'waterfall',
    'devops', 'devsecops', 'sre', 'site reliability',
    'microservices', 'monolith', 'serverless', 'event-driven',
    'domain-driven', 'ddd', 'clean architecture', 'hexagonal'
  ],
  'Security': [
    'security', 'cybersecurity', 'appsec', 'application security',
    'owasp', 'penetration testing', 'vulnerability',
    'encryption', 'ssl', 'tls', 'https',
    'authentication', 'authorization', 'rbac', 'abac',
    'soc2', 'gdpr', 'hipaa', 'pci', 'compliance'
  ],
  'Soft Skills': [
    'communication', 'written communication', 'verbal communication',
    'leadership', 'team lead', 'tech lead', 'management',
    'teamwork', 'collaboration', 'cross-functional',
    'problem solving', 'analytical', 'critical thinking',
    'mentoring', 'coaching', 'training',
    'presentation', 'stakeholder', 'client-facing',
    'self-starter', 'self-motivated', 'autonomous',
    'fast-paced', 'deadline', 'prioritization'
  ],
  'Education & Experience': [
    'bachelor', 'master', 'phd', 'computer science', 'cs degree',
    'bootcamp', 'self-taught',
    'years experience', 'senior', 'junior', 'mid-level', 'staff', 'principal',
    'architect', 'lead', 'manager', 'director'
  ]
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputFile: null,
    topN: 15,
    outputFile: null,
    csv: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--top' || arg === '-n') {
      options.topN = parseInt(args[++i], 10) || 15;
    } else if (arg === '--output' || arg === '-o') {
      options.outputFile = args[++i];
    } else if (arg === '--csv') {
      options.csv = true;
    } else if (!arg.startsWith('-')) {
      options.inputFile = arg;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
LinkedIn Job Requirements Analyzer - Keyword Analysis

Usage:
  node keyword_analyzer.js <jobs.json> [options]

Arguments:
  jobs.json          Exported jobs JSON file from the extension

Options:
  --top N, -n N      Show top N skills per category (default: 15)
  --output FILE, -o  Save results to JSON file
  --csv              Output as CSV format
  --help, -h         Show this help message

Examples:
  node keyword_analyzer.js linkedin-jobs.json
  node keyword_analyzer.js linkedin-jobs.json --top 10
  node keyword_analyzer.js linkedin-jobs.json --output results.json
  node keyword_analyzer.js linkedin-jobs.json --csv > results.csv
`);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function analyzeJobs(jobs) {
  // Combine all job descriptions
  const allText = jobs
    .map(job => (job.descriptionText || '').toLowerCase())
    .join(' ');

  const results = {};
  const allSkills = [];

  for (const [category, skills] of Object.entries(SKILL_KEYWORDS)) {
    const categoryCounts = [];

    for (const skill of skills) {
      const pattern = new RegExp(`\\b${escapeRegex(skill)}\\b`, 'gi');
      const matches = allText.match(pattern);
      const count = matches ? matches.length : 0;

      if (count > 0) {
        const percentage = Math.round((count / jobs.length) * 100);
        categoryCounts.push({
          skill,
          count,
          percentage,
          avgPerJob: Math.round((count / jobs.length) * 10) / 10
        });
        allSkills.push({ skill, count, category, percentage });
      }
    }

    categoryCounts.sort((a, b) => b.count - a.count);

    if (categoryCounts.length > 0) {
      results[category] = categoryCounts;
    }
  }

  // Sort all skills by count
  allSkills.sort((a, b) => b.count - a.count);

  return { byCategory: results, overall: allSkills };
}

function printTable(results, topN) {
  const { byCategory, overall } = results;

  console.log('\n' + '='.repeat(70));
  console.log('TOP SKILLS OVERALL');
  console.log('='.repeat(70));

  const topOverall = overall.slice(0, 20);
  console.log('\n  Rank  Skill                          Count    % Jobs    Category');
  console.log('  ' + '-'.repeat(66));

  topOverall.forEach((item, index) => {
    const rank = String(index + 1).padStart(4);
    const skill = item.skill.padEnd(30);
    const count = String(item.count).padStart(5);
    const pct = String(item.percentage + '%').padStart(6);
    const cat = item.category.substring(0, 20);
    console.log(`  ${rank}  ${skill}  ${count}  ${pct}    ${cat}`);
  });

  for (const [category, skills] of Object.entries(byCategory)) {
    console.log('\n' + '='.repeat(70));
    console.log(category.toUpperCase());
    console.log('='.repeat(70));

    const topSkills = skills.slice(0, topN);
    console.log('\n  Skill                              Count    % of Jobs');
    console.log('  ' + '-'.repeat(50));

    topSkills.forEach(item => {
      const skill = item.skill.padEnd(32);
      const count = String(item.count).padStart(5);
      const pct = String(item.percentage + '%').padStart(10);
      console.log(`  ${skill}  ${count}  ${pct}`);
    });
  }
}

function printCSV(results) {
  console.log('category,skill,count,percentage,avg_per_job');

  for (const [category, skills] of Object.entries(results.byCategory)) {
    for (const item of skills) {
      console.log(`"${category}","${item.skill}",${item.count},${item.percentage},${item.avgPerJob}`);
    }
  }
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.inputFile) {
    console.error('Error: Please provide an input JSON file');
    console.error('Usage: node keyword_analyzer.js <jobs.json>');
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

  // Handle both direct array and wrapped format from export
  const jobs = Array.isArray(data) ? data : (data.jobs || []);

  if (jobs.length === 0) {
    console.error('Error: No jobs found in the input file');
    process.exit(1);
  }

  console.log(`\nAnalyzing ${jobs.length} job(s)...\n`);

  // Analyze
  const results = analyzeJobs(jobs);

  // Output
  if (options.csv) {
    printCSV(results);
  } else {
    printTable(results, options.topN);
  }

  // Save to file if requested
  if (options.outputFile) {
    const output = {
      analyzedAt: new Date().toISOString(),
      jobCount: jobs.length,
      results: results
    };
    fs.writeFileSync(options.outputFile, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to: ${options.outputFile}`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Jobs analyzed: ${jobs.length}`);
  console.log(`  Categories with matches: ${Object.keys(results.byCategory).length}`);
  console.log(`  Unique skills found: ${results.overall.length}`);
  console.log(`  Most common skill: ${results.overall[0]?.skill || 'N/A'} (${results.overall[0]?.count || 0} mentions)`);
  console.log('');
}

main();
