# SCORM Package Structure

This document describes exactly how the SCORM builder generates packages. **Do not change the structure below without testing in Adobe Learning Manager (ALM) first** — it is confirmed working.

---

## 1. SCORM Standard

**SCORM 1.2** (not 2004).

ALM confirmed compatibility with 1.2. The manifest, API calls, and CMI field names all follow the 1.2 spec.

---

## 2. ZIP File Contents

```
<quiz-title>_<date>.zip
├── imsmanifest.xml          ← SCORM entry point, required by all LMSes
├── index.html               ← The quiz UI (self-contained HTML)
├── js/
│   ├── scorm-api.js         ← SCORM 1.2 API wrapper (unused legacy, kept for completeness)
│   └── quiz-player.js       ← Quiz logic: state, scoring, interactions
├── data/
│   ├── questions.json       ← Question bank array
│   └── quiz-settings.json   ← Quiz configuration object
├── adlcp_rootv1p2.xsd       ← XSD stub (required by some LMS validators)
├── imscp_rootv1p1p2.xsd     ← XSD stub
└── ims_xml.xsd              ← XSD stub
```

The XSD files are **stubs** (valid but empty schemas). They satisfy LMS upload validators that check for their presence without actually using them.

---

## 3. imsmanifest.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="quiz_<uuid>" version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="ORG-<uuid>">
    <organization identifier="ORG-<uuid>">
      <title>{quiz title}</title>
      <item identifier="ITEM-<uuid>" identifierref="RES-<uuid>">
        <title>{quiz title}</title>
        <adlcp:masteryscore>{passingPercentage}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RES-<uuid>"
              type="webcontent"
              adlcp:scormtype="sco"
              href="index.html">
      <file href="index.html"/>
      <file href="js/scorm-api.js"/>
      <file href="js/quiz-player.js"/>
      <file href="data/questions.json"/>
      <file href="data/quiz-settings.json"/>
    </resource>
  </resources>
</manifest>
```

**Critical details:**
- `xmlns` = `http://www.imsproject.org/xsd/imscp_rootv1p1p2` (SCORM 1.2 namespace — different from 2004)
- `xmlns:adlcp` = `http://www.adlnet.org/xsd/adlcp_rootv1p2` (1.2 ADL namespace)
- `schemaversion` = `1.2`
- `adlcp:scormtype="sco"` — lowercase `s` in `sco` (not `SCO`)
- `adlcp:masteryscore` — the passing percentage (e.g. `70`), used by ALM to determine pass/fail threshold
- The resource `href` points to `index.html`

---

## 4. SCORM API (SCORM 1.2)

The quiz player uses **SCORM 1.2 API function names**:

| Action       | Function call          |
|--------------|------------------------|
| Initialize   | `LMSInitialize('')`    |
| Get value    | `LMSGetValue(key)`     |
| Set value    | `LMSSetValue(key, val)`|
| Commit       | `LMSCommit('')`        |
| Terminate    | `LMSFinish('')`        |
| Error code   | `LMSGetLastError()`    |

The API object is found by walking up the `window.parent` chain looking for `window.API` (1.2) or `window.API_1484_11` (2004 fallback).

**Not** `window.API_1484_11`, `Initialize()`, `Terminate()` etc. — those are SCORM 2004 names. The player calls both sets as a fallback, but ALM uses the `window.API` / `LMS*` path.

---

## 5. CMI Fields Written

These are the SCORM data model fields the quiz writes to the LMS:

### On initialization
```
cmi.core.lesson_status  = "incomplete"
cmi.core.score.min      = "0"
cmi.core.score.max      = "100"
```

### During a quiz attempt (per answer change)
```
cmi.suspend_data        = JSON string of full quiz state (attempt count, answers, elapsed time, etc.)
```

### On quiz submission (performSubmit)
```
cmi.core.score.raw      = "{percentage 0–100}"
cmi.core.score.min      = "0"
cmi.core.score.max      = "100"
cmi.core.lesson_status  = "passed" | "failed"
cmi.core.session_time   = "HH:MM:SS"   ← SCORM 1.2 format (NOT ISO 8601)

cmi.interactions.{n}.id               = question ID
cmi.interactions.{n}.type             = "choice"
cmi.interactions.{n}.student_response = "A" | "B,C"  (comma-separated for multi-select)
cmi.interactions.{n}.result           = "correct" | "incorrect"
```

### On page unload (beforeunload)
```
cmi.core.session_time   = "HH:MM:SS"
cmi.core.exit           = "suspend"    ← always "suspend" on unload (not "normal")
```

**Important:** `cmi.core.lesson_status` uses `passed`/`failed` (not `completed`/`failed`) — this is the SCORM 1.2 single-status model. There is no separate `cmi.completion_status`.

---

## 6. State Persistence (cmi.suspend_data)

The quiz stores all cross-session state in `cmi.suspend_data` as a JSON string:

```json
{
  "attemptCount": 2,
  "lastAttemptTimestamp": "2025-04-16T10:30:00.000Z",
  "hasPassed": false,
  "lastScore": null,
  "elapsedMs": 45000,
  "attemptQuestionIds": ["uuid1", "uuid2", "..."],
  "currentQuestionIndex": 3,
  "userAnswers": { "uuid1": "B", "uuid2": ["A", "C"] },
  "timeExpiredAt": null,
  "lastAttemptQuestionIds": ["uuid1", "uuid2", "..."],
  "lastAttemptAnswers": { "uuid1": "B", "uuid2": ["A", "C"] }
}
```

On reload, the quiz reads this data and resumes in-progress attempts or restores attempt history (for max attempt / cooldown enforcement).

**`lastAttemptQuestionIds` / `lastAttemptAnswers`** — only present after the learner has passed. Stores the question order and answers from the passing attempt so the "Review last attempt" button on the passed banner can reconstruct the review without needing an active attempt. These fields are only written on a pass (`performSubmit` when `passed === true`) and are never overwritten by subsequent failed attempts or page unloads.

---

## 7. QUIZ_CONFIG Object (runtime)

`index.html` injects a `window.QUIZ_CONFIG` object that the player reads:

```js
window.QUIZ_CONFIG = {
  title:               "Quiz Title",
  quizType:            "course_completion" | "topic_quiz",
  maxAttempts:         0,          // 0 = unlimited
  cooldownDays:        0,          // days between retries after max attempts
  randomizeQuestions:  true,
  passingPercentage:   70,
  timeLimitMinutes:    0,          // 0 = no limit
  totalQuestions:      0,          // 0 = use all questions
  allowBlankAnswers:   false,
  warnOnBlankAnswers:  true,
  passMessage:         "",         // custom pass heading (empty = default)
  failMessage:         "",         // custom fail heading
  passExitMessage:     "",         // message shown below pass result
  failExitMessage:     "",         // message shown below fail result
  showAnswerReview:    false,      // show "Review Answers" button after attempt + "Review last attempt" on passed banner
  showCorrectAnswers:  false       // highlight correct answers in review
};
```

---

## 8. Question Data Format (questions.json)

Each question object:

```json
{
  "id": "uuid",
  "question": "<p>HTML question text</p>",
  "questionType": "single" | "multiple",
  "options": [
    { "letter": "A", "text": "Option text" },
    { "letter": "B", "text": "Option text" }
  ],
  "correctAnswer": "A",              // string for single, array for multiple
  "images": [                        // optional
    { "data": "data:image/png;base64,..." }
  ],
  "imagePosition": "above" | "below",
  "imageLayout": "row" | "column",
  "codeBlock": "optional code string"
}
```

For multiple-select: `correctAnswer` is an array, e.g. `["A", "C"]`.

---

## 9. HTML Generation (index.html)

`buildQuizHTML()` assembles `index.html` by combining:

1. **Inline CSS** from `#tpl-css` template tag
2. **Config script block** — injects `window.QUIZ_CONFIG` as JSON
3. **SCORM API script** — external `js/scorm-api.js` (in production) or inlined (in test mode)
4. **Quiz player script** — external `js/quiz-player.js` (in production) or inlined (in test mode)

In production (downloaded zip), scripts are loaded from external files. In test mode (browser preview), all scripts are inlined into `srcdoc` since there's no server to serve files from.

---

## 10. Quiz Flow

```
Page load
  → LMSInitialize('')
  → Set cmi.core.lesson_status = "incomplete"
  → Set cmi.core.score.min/max = "0"/"100"
  → LMSCommit()
  → Read cmi.suspend_data → restore state

Start screen shown
  → If in-progress attempt detected → skip to quiz screen (resume)
  → If hasPassed → show "already passed" banner, hide Start button
            → If showAnswerReview + lastAttemptQuestionIds exist → show "Review last attempt" button
  → If maxAttempts reached → disable Start button

User starts quiz
  → Questions selected (randomized if enabled, subset if totalQuestions set)
  → Timer starts if timeLimitMinutes > 0

User answers questions
  → On each answer change → saveState() → LMSSetValue(cmi.suspend_data, ...) → LMSCommit()

User submits (or timer expires)
  → calculateScore()
  → LMSSetValue(cmi.core.score.raw, percentage)
  → LMSSetValue(cmi.core.lesson_status, "passed" | "failed")
  → LMSSetValue(cmi.core.session_time, "HH:MM:SS")
  → Write cmi.interactions.N for each question
  → LMSCommit()
  → Show results screen

User leaves page (beforeunload)
  → LMSSetValue(cmi.core.session_time, "HH:MM:SS")
  → LMSSetValue(cmi.core.exit, "suspend")
  → LMSCommit()
  → LMSFinish('')
```

---

## 11. What ALM Reads

Based on testing against Adobe Learning Manager:

| Field | What ALM uses it for |
|---|---|
| `cmi.core.lesson_status` | Pass/fail/incomplete status displayed in learner transcript |
| `cmi.core.score.raw` | Score percentage shown in reports |
| `cmi.core.session_time` | Time-on-task in reports |
| `adlcp:masteryscore` | The threshold ALM uses to decide pass/fail (must match `passingPercentage`) |
| `cmi.interactions.*` | Per-question response data in detailed reports |
| `cmi.suspend_data` | Preserved across sessions — enables attempt resumption |

`cmi.core.exit = "suspend"` on unload tells ALM the learner left mid-session (not a completed exit), so it preserves state for resumption.
