#!/usr/bin/env node

/**
 * LinkedIn Job Requirements Analyzer - Study Plan Generator
 *
 * Generates a prioritized study plan based on job requirements and user skills.
 *
 * Usage:
 *   node study_plan.js <jobs-and-skills.json> [options]
 */

const fs = require("fs");
const https = require("https");

// Configuration - same as llm_analyzer.js
const CONFIG = {
  anthropic: {
    baseUrl: "api.anthropic.com",
    path: "/v1/messages",
    defaultModel: "claude-3-haiku-20240307",
    envKey: "ANTHROPIC_API_KEY",
  },
  openai: {
    baseUrl: "api.openai.com",
    path: "/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputFile: null,
    provider: "anthropic",
    model: null,
    outputFile: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--provider" || arg === "-p") {
      options.provider = args[++i];
    } else if (arg === "--model" || arg === "-m") {
      options.model = args[++i];
    } else if (arg === "--output" || arg === "-o") {
      options.outputFile = args[++i];
    } else if (!arg.startsWith("-")) {
      options.inputFile = arg;
    }
  }

  if (!options.model) {
    options.model =
      CONFIG[options.provider]?.defaultModel || CONFIG.anthropic.defaultModel;
  }

  return options;
}

function showHelp() {
  console.log(`
LinkedIn Job Requirements Analyzer - Prioritized Study Plan Generator

Generates a learning path based on skill gaps identified from job descriptions.

Usage:
  node study_plan.js <jobs-and-skills.json> [options]

Arguments:
  jobs-and-skills.json         JSON file exported from the extension (includes user skills)

Options:
  --provider openai|anthropic  API provider (default: anthropic)
  --model MODEL                Model to use
  --output FILE, -o            Save results to file
  --help, -h                   Show this help message

Environment Variables:
  ANTHROPIC_API_KEY            Required for Anthropic provider
  OPENAI_API_KEY               Required for OpenAI provider
`);
}

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(
              new Error(`API Error ${res.statusCode}: ${JSON.stringify(json)}`),
            );
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function callAnthropic(apiKey, model, prompt) {
  const config = CONFIG.anthropic;
  const response = await makeRequest(
    {
      hostname: config.baseUrl,
      path: config.path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    },
    {
      model: model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    },
  );
  return response.content[0].text;
}

async function callOpenAI(apiKey, model, prompt) {
  const config = CONFIG.openai;
  const response = await makeRequest(
    {
      hostname: config.baseUrl,
      path: config.path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    },
    {
      model: model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    },
  );
  return response.choices[0].message.content;
}

function buildPrompt(jobs, userSkills) {
  const jobSummaries = jobs
    .map((job, i) => {
      const desc = (job.descriptionText || "").substring(0, 2000);
      return `### Job ${i + 1}: ${job.title} at ${job.company}\n${desc}\n---`;
    })
    .join("\n");

  return `You are an expert career coach and technical mentor. 
I have captured ${jobs.length} job descriptions and identified my current skills.

My Current Skills:
${userSkills.join(", ")}

Job Descriptions:
${jobSummaries}

Based on the job requirements and my current skills, please generate a **Prioritized Study Plan** in Markdown format.

The study plan should include:

## 1. Skill Gap Analysis
Identify the key technical and soft skills that are frequently mentioned in the job descriptions but are missing from my current skills.

## 2. Prioritized Learning Path
Organize the missing skills into a learning order based on:
- **High Impact (P0):** Most frequently requested skills that are essential for these roles.
- **Foundational (P1):** Skills that unlock other skills or are prerequisites.
- **Quick Wins (P2):** Skills that are relatively easy to pick up but add immediate value.

## 3. Weekly Study Schedule
Create a suggested 4-8 week study plan (assuming 10-15 hours/week).

## 4. Recommended Resources
For each major skill gap, suggest 2-3 high-quality learning resources (e.g., specific courses, documentation, or projects).

## 5. Project Ideas
Suggest 2 portfolio projects that would demonstrate the most important missing skills.

Format the output as a clear, actionable Markdown checklist.`;
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.inputFile) {
    console.error("Error: Please provide an input JSON file");
    process.exit(1);
  }

  const apiKey = process.env[CONFIG[options.provider].envKey];
  if (!apiKey) {
    console.error(
      `Error: ${CONFIG[options.provider].envKey} environment variable not set.`,
    );
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(options.inputFile, "utf-8"));
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }

  const jobs = data.jobs || [];
  const userSkills = data.userSkills || [];

  if (jobs.length === 0) {
    console.error("Error: No jobs found in the input file");
    process.exit(1);
  }

  console.log(
    `\nGenerating Study Plan based on ${jobs.length} jobs and ${userSkills.length} skills...\n`,
  );

  try {
    const prompt = buildPrompt(jobs, userSkills);
    let result;
    if (options.provider === "anthropic") {
      result = await callAnthropic(apiKey, options.model, prompt);
    } else {
      result = await callOpenAI(apiKey, options.model, prompt);
    }

    console.log("=".repeat(70));
    console.log("PRIORITIZED STUDY PLAN");
    console.log("=".repeat(70));
    console.log("\n" + result + "\n");

    if (options.outputFile) {
      fs.writeFileSync(options.outputFile, result);
      console.log(`\nStudy plan saved to: ${options.outputFile}`);
    }
  } catch (error) {
    console.error("Error during generation:", error.message);
    process.exit(1);
  }
}

main();
