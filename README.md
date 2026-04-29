# Gmail AI Auto Categorizer

Automatically classify unread Gmail emails using AI and organize them with labels, starring, marking as read, or archiving.

Built with **Google Apps Script + Gmail API + Google Generative AI (Gemma / Gemini models)**.

---

## Features

* Automatically scans unread Gmail emails
* Uses AI to classify emails into smart categories
* Creates Gmail labels automatically
* Stars high-priority emails
* Marks OTPs / promotions as read
* Archives newsletters / promotions / OTPs
* Prevents duplicate processing using tracking labels
* Retry logic for API failures

---

## Categories

* High Priority
* College
  n- School
* Placement/Jobs
* Finance
* Security/Logins
* OTPs
* Newsletters
* Promotions
* Social Media
* Other

---

## Tech Stack

* Google Apps Script
* GmailApp Service
* Google Generative Language API
* Gemma 3 27B IT Model

---

## How It Works

1. Finds unread inbox emails
2. Ignores already processed threads
3. Extracts sender, subject, and body preview
4. Sends data to AI model
5. Receives category
6. Applies Gmail actions (label, star, mark read, archive)

---

## Setup Guide

### 1. Create Google Apps Script Project

Go to [https://script.google.com/](https://script.google.com/) and create a new project.

### 2. Paste Script

Replace `Code.gs` with your script.

### 3. Add API Key

Open **Project Settings → Script Properties** and add:

```text
GEMINI_API_KEY=your_api_key_here
```

### 4. Enable API

Enable **Google Generative Language API** in Google Cloud Console.

### 5. Run Script

```javascript
autoCategorizeEmails();
```

Authorize Gmail permissions when prompted.

### 6. Automate (Recommended)

Create a time trigger in Apps Script:

* Every 5 minutes
* Every 15 minutes
* Hourly

---

## Configuration

```javascript
const BATCH_SIZE = 20;
const BODY_SNIPPET_LENGTH = 100;
const LLM_MODEL = "gemma-3-27b-it";
```

---

## Privacy Notes

Only minimal metadata is sent:

* Sender
* Subject
* Short body snippet (100 chars)

No full email body required.

---

## Example

**Input Email**

```text
From: hr@company.com
Subject: Interview Scheduled Tomorrow
```

**AI Output**

```text
Placement/Jobs
```

---

## Future Improvements

* Multi-language support
* Better priority detection
* Spam scoring
* Personal contacts whitelist
* Dashboard analytics
* Telegram alerts

---

## License

MIT License
