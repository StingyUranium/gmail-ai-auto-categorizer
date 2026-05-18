// ============================================================
// CONFIG
// ============================================================
const PROCESSED_LABEL = "Processed";
const BATCH_SIZE = 5;
const DELAY_BETWEEN_CALLS_MS = 4000;
const LLM_MODEL = "gemini-3.1-flash-lite-preview";

const CATEGORIES = {
  "High Priority":      { markRead: false, archive: false },
  "College":            { markRead: false, archive: false },
  "School":             { markRead: false, archive: false },
  "Placement/Jobs":     { markRead: false, archive: false },
  "Finance":            { markRead: false, archive: false },
  "Security/Logins":    { markRead: false, archive: false },
  "OTPs":               { markRead: true,  archive: true  },
  "Newsletters":        { markRead: true,  archive: true  },
  "Promotions":         { markRead: true,  archive: true  },
  "Social Media":       { markRead: true,  archive: true  },
  "Travel":             { markRead: false, archive: false },
  "Shopping/Orders":    { markRead: false, archive: false },
  "Events":             { markRead: false, archive: false },
  "Health":             { markRead: false, archive: false },
  "Government/Legal":   { markRead: false, archive: false },
  "Subscriptions":      { markRead: true,  archive: true  },
  "Support/Tickets":    { markRead: false, archive: false },
  "Referrals/Rewards":  { markRead: true,  archive: true  },
  "Other":              { markRead: false, archive: false }
};

// ============================================================
// MAIN
// ============================================================
function autoCategorizeEmails() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in Script Properties.");

  const processedLabel = getOrCreateLabel(PROCESSED_LABEL);

  const threads = GmailApp.search(
    `in:inbox -label:"${PROCESSED_LABEL}"`,
    0,
    BATCH_SIZE
  );

  Logger.log(`Processing ${threads.length} threads...`);

  threads.forEach(thread => {
    try {
      const existingLabels = thread.getLabels().map(l => l.getName());
      const alreadyCategorized = existingLabels.some(l => Object.keys(CATEGORIES).includes(l));
      const alreadyProcessed = existingLabels.includes(PROCESSED_LABEL);

      if (alreadyCategorized && alreadyProcessed) return;

      const messages = thread.getMessages();
      const message = messages[0];

      const fullBody = extractCleanBody(message.getPlainBody());

      const category = classifyWithGemini(
        message.getFrom(),
        message.getSubject(),
        fullBody,
        apiKey
      );

      Logger.log(`[${category}] — ${message.getSubject()}`);
      applyCategory(thread, category);
      thread.addLabel(processedLabel);

    } catch (error) {
      Logger.log(`Error processing thread: ${error}`);
    }

    Utilities.sleep(DELAY_BETWEEN_CALLS_MS);
  });

  Logger.log("Done!");
}

// ============================================================
// BODY CLEANER
// ============================================================
function extractCleanBody(plainBody) {
  if (!plainBody) return "";

  const lines = plainBody.split("\n");
  const cleaned = [];
  let signatureStarted = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "--" || trimmed === "—" || trimmed.match(/^_{3,}$/)) {
      signatureStarted = true;
    }
    if (signatureStarted) continue;
    if (trimmed.startsWith(">")) continue;
    if (trimmed.match(/^On .+ wrote:$/)) continue;

    cleaned.push(line);
  }

  return cleaned
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// GEMINI 3.1 FLASH CLASSIFIER
// ============================================================
function classifyWithGemini(from, subject, fullBody, apiKey) {
  const categoryList = Object.keys(CATEGORIES).join(" | ");

  const prompt = `You are a strict email classifier. Your only job is to output exactly one category name from the list below. No explanation. No punctuation. No extra words. Just the category name.

CATEGORIES: ${categoryList}

DEFINITIONS:
- High Priority: A real human personally wrote this to YOU and needs a response. Must be hand-written, direct, personal. NOT automated. NOT bulk. NOT system-generated.
- College: University/college admin, faculty, or portals — exams, fees, results, attendance, timetables, hall tickets. Senders end in .ac.in or .edu.
- School: School teachers, principal, school portals — assignments, tests, report cards, PTM, school fee reminders.
- Placement/Jobs: Job offers, internship offers, interview calls, aptitude tests, campus drives, job alerts from LinkedIn, Naukri, Indeed, Internshala, Unstop, Superset.
- Finance: Bank transaction alerts, UPI confirmations (GPay/PhonePe/Paytm), credit/debit card alerts, loan EMIs, investment/mutual fund statements, invoices, refunds. Senders: HDFC, SBI, ICICI, Axis, Zerodha, Groww, SBM, Niyo.
- Security/Logins: Login attempt alerts, password reset, account recovery, suspicious sign-in, 2FA setup, device authorization. NOT OTPs.
- OTPs: Email contains a one-time numeric code for immediate use. Short email. Subject has "OTP", "code", "verify", or a number.
- Newsletters: Subscribed editorial content — blog digests, weekly roundups, creator newsletters, thought leadership. Sent on schedule to many.
- Promotions: Bulk marketing — discounts, sales, coupons, offers, "shop now", brand campaigns. NOT for services you pay for.
- Social Media: Automated notifications from Facebook, Instagram, Twitter/X, LinkedIn, YouTube, Snapchat, Reddit — likes, comments, followers, mentions.
- Travel: Train/flight/bus bookings, hotel reservations, cab receipts, PNR confirmations, boarding passes, travel insurance, trip itineraries. Senders: IRCTC, MakeMyTrip, GoIbibo, EaseMyTrip, Ola, Uber, Airbnb, redBus, Royal Sundaram travel policy.
- Shopping/Orders: Order placed, payment success, shipping, delivery, return/exchange updates. Senders: Amazon, Flipkart, Myntra, Meesho, Swiggy, Blinkit, Zepto, Nykaa, Ajio.
- Events: Webinar registrations, conference invites, workshop reminders, concert/movie tickets, hackathons, virtual event links.
- Health: Doctor appointments, lab reports, pharmacy orders, hospital bills, health insurance claims, diagnostic emails.
- Government/Legal: Government portals — Aadhaar, PAN, DigiLocker, income tax, GST, passport, EPFO, legal notices, RTI.
- Subscriptions: Renewal reminders and billing for services you already pay for — Netflix, Spotify, YouTube Premium, Amazon Prime, iCloud, Adobe, Notion, any SaaS.
- Support/Tickets: Customer support replies, helpdesk ticket updates, complaint acknowledgements, resolution emails.
- Referrals/Rewards: Referral bonus, cashback earned, loyalty points, reward redemption, scratch card, milestone rewards.
- Other: Truly ambiguous emails that fit none of the above. Use as last resort only.

STRICT RULES — follow these before deciding:
1. If the email is from IRCTC, MakeMyTrip, GoIbibo, EaseMyTrip, redBus, Ola, Uber, Airbnb, or mentions PNR/train/flight/hotel → ALWAYS Travel.
2. If the email mentions a bank transaction, UPI payment, credit/debit alert, or account statement → ALWAYS Finance.
3. If the sender is a bank (HDFC, SBI, ICICI, Axis, SBM, Niyo, Kotak, Yes Bank) → Finance (unless it's a login alert → Security/Logins).
4. If the subject contains "Transaction Alert", "Debited", "Credited", "Statement", "e-Statement" → ALWAYS Finance.
5. If it's an insurance policy for travel (Royal Sundaram, Bajaj Allianz travel policy, etc.) → ALWAYS Travel.
6. If the sender is Superset, LinkedIn, Naukri, Indeed, Internshala → ALWAYS Placement/Jobs.
7. Automated system emails are NEVER High Priority — even if subject says "urgent" or "important".
8. OTPs and Security/Logins are different — OTPs have a numeric code in the body; Security/Logins are about account activity alerts.
9. Subscriptions are for services you PAY for. Promotions are unsolicited marketing.
10. When two categories seem valid, always pick the MORE SPECIFIC one.

FROM: ${from}
SUBJECT: ${subject}
FULL BODY:
${fullBody}

Category:`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 15
    }
  };

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
        if (attempt < MAX_RETRIES) Utilities.sleep(1000 * attempt);
        continue;
      }

      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      const matched = Object.keys(CATEGORIES).find(cat =>
        raw.toLowerCase().includes(cat.toLowerCase())
      );

      return matched || "Other";

    } catch (e) {
      Logger.log(`Fetch failed (attempt ${attempt}): ${e}`);
      if (attempt < MAX_RETRIES) Utilities.sleep(1000 * attempt);
    }
  }

  return "Other";
}

// ============================================================
// APPLY CATEGORY ACTIONS
// ============================================================
function applyCategory(thread, category) {
  const config = CATEGORIES[category] || CATEGORIES["Other"];
  const label = getOrCreateLabel(category);

  thread.addLabel(label);
  if (config.markRead) thread.markRead();
  if (config.archive)  thread.moveToArchive();
}

// ============================================================
// LABEL HELPER
// ============================================================
function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
