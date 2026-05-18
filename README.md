# Gmail Auto-Categorizer

A Google Apps Script that automatically classifies Gmail inbox threads into predefined categories using the Gemini AI API. Runs entirely within Google's infrastructure — no external servers or dependencies required.

## Features

- Classifies emails into 19 categories including Finance, OTPs, Travel, Placement/Jobs, and more
- Automatically marks low-priority emails as read and archives them
- Strips email signatures and quoted replies before classification
- Retry logic with exponential backoff for API failures
- Respects batch size and rate limits to stay within Google Apps Script quotas
- Applies a "Processed" label to prevent duplicate processing

## Categories

| Category | Auto-Read | Auto-Archive |
|---|---|---|
| High Priority | No | No |
| College | No | No |
| School | No | No |
| Placement/Jobs | No | No |
| Finance | No | No |
| Security/Logins | No | No |
| Travel | No | No |
| Shopping/Orders | No | No |
| Events | No | No |
| Health | No | No |
| Government/Legal | No | No |
| Support/Tickets | No | No |
| Other | No | No |
| OTPs | Yes | Yes |
| Newsletters | Yes | Yes |
| Promotions | Yes | Yes |
| Social Media | Yes | Yes |
| Subscriptions | Yes | Yes |
| Referrals/Rewards | Yes | Yes |

## Requirements

- A Google account with Gmail access
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)

## Setup

### 1. Create a Google Apps Script Project

1. Navigate to [script.google.com](https://script.google.com)
2. Create a new project
3. Paste the contents of `autoCategorize.gs` into the editor

### 2. Add Your Gemini API Key

1. In the Apps Script editor, open **Project Settings → Script Properties**
2. Add a new property:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Your Gemini API key

### 3. Configure Script Parameters (Optional)

Edit the configuration block at the top of the script to adjust behavior:

```js
const BATCH_SIZE = 5;                          // Number of threads processed per run
const DELAY_BETWEEN_CALLS_MS = 4000;           // Delay between API calls in milliseconds
const LLM_MODEL = "gemini-3.1-flash-lite-preview"; // Gemini model identifier
```

### 4. Authorize Permissions

On first run, Google will prompt you to grant Gmail read/write and URL fetch permissions. Both are required for the script to function.

### 5. Run Manually or Schedule a Trigger

**Manual:** Select `autoCategorizeEmails` from the function dropdown and click Run.

**Scheduled:**
1. Open the **Triggers** panel (clock icon in the left sidebar)
2. Add a new trigger for `autoCategorizeEmails`
3. Set it to time-driven (e.g., every 15 minutes)

## How It Works

1. The script searches for inbox threads that do not have the `Processed` label
2. For each thread, it extracts the sender, subject, and a cleaned version of the email body
3. The data is sent to Gemini with a strict classification prompt and deterministic settings (`temperature: 0.0`)
4. The appropriate Gmail label is applied, and the thread is marked read or archived based on the category configuration
5. The `Processed` label is added to prevent the thread from being evaluated again

## Notes

- Only the first message of each thread is used for classification
- If the Gemini API fails after three retries, the thread is labeled `Other`
- The `Processed` label is applied regardless of the classification outcome
- Subscription-based services (Netflix, Spotify, etc.) are distinguished from unsolicited promotional emails

## License

MIT License. Free to use, modify, and distribute.
