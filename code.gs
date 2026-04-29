// ============================================================
// CONFIG
// ============================================================
const PROCESSED_LABEL = "AutoCat/Processed";
const BATCH_SIZE = 20;
const LLM_MODEL = "gemma-3-27b-it";
const BODY_SNIPPET_LENGTH = 100; // chars — enough context, minimal privacy exposure

const CATEGORIES = {
  "High Priority":   { starEmail: true,  markRead: false, archive: false },
  "College":         { starEmail: false, markRead: false, archive: false },
  "School":          { starEmail: false, markRead: false, archive: false },
  "Placement/Jobs":  { starEmail: false, markRead: false, archive: false },
  "Finance":         { starEmail: false, markRead: false, archive: false },
  "Security/Logins": { starEmail: false, markRead: false, archive: false },
  "OTPs":            { starEmail: false, markRead: true,  archive: true  },
  "Newsletters":     { starEmail: false, markRead: true,  archive: true  },
  "Promotions":      { starEmail: false, markRead: true,  archive: true  },
  "Social Media":    { starEmail: false, markRead: true,  archive: true  },
  "Other":           { starEmail: false, markRead: false, archive: false  }
};

// ============================================================
// MAIN
// ============================================================
function autoCategorizeEmails() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in Script Properties.");

  const processedLabel = getOrCreateLabel(PROCESSED_LABEL);

  const threads = GmailApp.search(
    `in:inbox is:unread -label:"${PROCESSED_LABEL}"`,
    0,
    BATCH_SIZE
  );

  Logger.log(`Processing ${threads.length} threads...`);

  threads.forEach(thread => {
    try {
      // Skip if already categorized AND processed
      const existingLabels = thread.getLabels().map(l => l.getName());
      const alreadyCategorized = existingLabels.some(l => Object.keys(CATEGORIES).includes(l));
      const alreadyProcessed = existingLabels.includes(PROCESSED_LABEL);

      if (alreadyCategorized && alreadyProcessed) return; // truly done, skip

      const messages = thread.getMessages();
      const message = messages[0]; // First message — best original context

      // Extract a short body snippet, stripping quoted replies and extra whitespace
      const bodySnippet = extractBodySnippet(message.getPlainBody());

      const category = classifyWithGemma(
        message.getFrom(),
        message.getSubject(),
        bodySnippet,
        apiKey
      );

      Logger.log(`[${category}] — ${message.getSubject()}`);
      applyCategory(thread, category);
      thread.addLabel(processedLabel);

    } catch (error) {
      Logger.log(`Error processing thread: ${error}`);
    }
  });

  Logger.log("Done!");
}

// ============================================================
// BODY SNIPPET EXTRACTOR
// Strips quoted replies (lines starting with >) and collapses
// whitespace, then trims to BODY_SNIPPET_LENGTH characters.
// ============================================================
function extractBodySnippet(plainBody) {
  if (!plainBody) return "";

  const cleaned = plainBody
    .split("\n")
    .filter(line => !line.trim().startsWith(">"))  // strip quoted reply lines
    .join(" ")
    .replace(/\s+/g, " ")                           // collapse whitespace
    .trim();

  return cleaned.substring(0, BODY_SNIPPET_LENGTH);
}

// ============================================================
// GEMMA 3 27B CLASSIFIER (sender + subject + 100-char snippet)
// ============================================================
function classifyWithGemma(from, subject, bodySnippet, apiKey) {
  const categoryList = Object.keys(CATEGORIES).join(" | ");

  const prompt = `Classify this email into exactly one category. Reply with ONLY the category name, nothing else.

Categories: ${categoryList}

Definitions:
- High Priority: Urgent email from a real person needing immediate action (boss, manager, HR, professor, deadline-related)
- College: University or college administration, exams, fees, results, attendance, hall tickets (.ac.in or .edu senders)
- School: School teachers, principal, assignments, tests, report cards, parent meetings
- Placement/Jobs: Job offers, internships, interview calls, campus recruitment, LinkedIn job alerts, Naukri, Indeed
- Finance: Bank transactions, UPI payments (GPay, PhonePe, Paytm), invoices, receipts, refunds, credit/debit alerts
- Security/Logins: Login alerts, password reset requests, unusual account activity, 2FA setup emails
- OTPs: One-time passwords, verification codes, authentication codes (usually very short subjects like "OTP" or "Your code")
- Newsletters: Blog digests, weekly roundups, subscription content, editorial emails
- Promotions: Sales, discounts, coupons, % off offers, marketing emails, flash sales, shop now
- Social Media: Facebook, Instagram, Twitter/X, LinkedIn activity notifications (likes, comments, followers)
- Other: Personal emails, replies, or anything that doesn't clearly fit the above

FROM: ${from}
SUBJECT: ${subject}
BODY PREVIEW: ${bodySnippet}

Category:`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.05,  // Near-deterministic output
      maxOutputTokens: 15 // Only need the label name
    }
  };

  // Retry up to 3 times with exponential backoff
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const json = JSON.parse(response.getContentText());

      if (json.error) {
        Logger.log(`API Error (attempt ${attempt}): ${json.error.message}`);
        if (attempt < MAX_RETRIES) Utilities.sleep(1000 * attempt); // 1s, 2s backoff
        continue;
      }

      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      // Match against valid categories (handles minor formatting variations)
      const matched = Object.keys(CATEGORIES).find(cat =>
        raw.toLowerCase().includes(cat.toLowerCase())
      );

      return matched || "Other";

    } catch (e) {
      Logger.log(`Fetch failed (attempt ${attempt}): ${e}`);
      if (attempt < MAX_RETRIES) Utilities.sleep(1000 * attempt);
    }
  }

  return "Other"; // All retries exhausted
}

// ============================================================
// APPLY CATEGORY ACTIONS
// ============================================================
function applyCategory(thread, category) {
  const config = CATEGORIES[category] || CATEGORIES["Other"];
  const label = getOrCreateLabel(category);

  thread.addLabel(label);
  if (config.starEmail) thread.star();
  if (config.markRead)  thread.markRead();
  if (config.archive)   thread.moveToArchive();
}

// ============================================================
// LABEL HELPER
// ============================================================
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}