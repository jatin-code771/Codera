import axios from "axios";

const SANDBOX_API_URL = process.env.JUDGE0_API_URL || "https://sandboxapi.p.rapidapi.com/v1";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || "sandboxapi.p.rapidapi.com";

// Map numeric language IDs (from frontend) to Sandbox API string identifiers
const LANGUAGE_ID_TO_SANDBOX = {
  71: "python3",   // Python
  63: "javascript", // JavaScript (Node.js)
  62: "java",       // Java
  74: "typescript",  // TypeScript
};

// Map Sandbox API string identifiers back to display names
const SANDBOX_TO_LANGUAGE_NAME = {
  python3: "PYTHON",
  javascript: "JAVASCRIPT",
  java: "JAVA",
  typescript: "TYPESCRIPT",
};

export const getLanguageId = (language) => {
  const languageMap = {
    PYTHON: 71,
    JAVA: 62,
    JAVASCRIPT: 63,
    TYPESCRIPT: 74,
  };
  return languageMap[language.toUpperCase()] || 71;
};

/**
 * Execute a single submission against the Sandbox API.
 * The Sandbox API is synchronous — it returns results immediately, no polling needed.
 */
const executeSingle = async (sandboxLanguage, sourceCode, stdin) => {
  const response = await axios.post(
    `${SANDBOX_API_URL}/execute`,
    {
      language: sandboxLanguage,
      code: sourceCode,
      stdin: stdin || "",
      timeout: 10,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    }
  );
  return response.data;
};

/**
 * Submit a batch of test cases by executing each one against the Sandbox API.
 * Maps the results to a Judge0-compatible format so the controller doesn't need changes.
 *
 * @param {Array} submissions - Array of { source_code, language_id, stdin }
 * @returns {Array} Results in a shape compatible with the existing controller
 */
export const submitBatch = async (submissions) => {
  try {
    // Execute all test cases concurrently
    const results = await Promise.all(
      submissions.map(async (sub) => {
        const sandboxLang = LANGUAGE_ID_TO_SANDBOX[sub.language_id];
        if (!sandboxLang) {
          throw new Error(`Unsupported language_id: ${sub.language_id}`);
        }

        try {
          const result = await executeSingle(sandboxLang, sub.source_code, sub.stdin);

          // Map Sandbox API response → Judge0-compatible shape
          return {
            stdout: result.stdout || null,
            stderr: result.stderr || null,
            compile_output: null,
            status: {
              id: result.exit_code === 0 ? 3 : 11, // 3 = Accepted, 11 = Runtime Error
              description: result.status === "completed" && result.exit_code === 0
                ? "Accepted"
                : result.status === "timeout"
                  ? "Time Limit Exceeded"
                  : "Runtime Error (NZEC)",
            },
            memory: result.memory_used_kb || null,
            time: result.execution_time_ms
              ? (result.execution_time_ms / 1000).toFixed(3)
              : null,
          };
        } catch (execError) {
          // Handle per-submission errors gracefully
          const errMsg = execError.response?.data?.error || execError.message;
          return {
            stdout: null,
            stderr: errMsg,
            compile_output: execError.response?.data?.compile_output || null,
            status: {
              id: 13, // Internal Error
              description: "Internal Error",
            },
            memory: null,
            time: null,
          };
        }
      })
    );

    return results;
  } catch (error) {
    console.error(
      "Error submitting code:",
      error.response?.data || error.message
    );
    throw error;
  }
};

export function getLanguageName(languageId) {
  const LANGUAGE_NAMES = {
    71: "PYTHON",
    62: "JAVA",
    63: "JAVASCRIPT",
    74: "TYPESCRIPT",
  };
  return LANGUAGE_NAMES[languageId] || "unknown";
}