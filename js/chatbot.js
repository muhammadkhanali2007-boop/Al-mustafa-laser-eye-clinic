/**
 * Al-Mustafa Laser Eye Clinic — professional virtual receptionist, fixed FAQ routing,
 * emergency triage cues, and step-by-step booking (Sheet + WhatsApp fallback). No external AI.
 */

const CLINIC = {
  name: "Al-Mustafa Laser Eye Clinic",
  doctor: "Dr. Nusrat Ullah Khan",
  role: "Senior Consultant Ophthalmologist & Eye Specialist",
  address: "Khan Zaman Street, Ballo Khel Road, Mianwali, Pakistan",
  city: "Mianwali, Pakistan",
  whatsapp: "0309-2580226",
};

/** wa.me destination for staff intake (international, no +). */
const BOOKING_NOTIFY_WHATSAPP = "923092580226";

/** Clinic Google Apps Script Web App — sole booking POST endpoint. */
const BOOKING_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbyRYWnlRKiPxnhUmEuiQOhtwcLO2Pq63l8ctG5UWha8TlE6m2bqkLjwnyTj4XGSvRR4lg/exec";

/** After successful Google Sheet save — fixed confirmation (not sent to any model). */
const BOOKING_SHEET_SUCCESS =
  "Your appointment has been successfully booked.\n\n" +
  "Please arrive 10 minutes early at the clinic.\n" +
  "Bring previous reports if available.\n" +
  "Our team will contact you shortly.";

/** Legacy name kept for clarity in code paths that expect sheet success copy. */
const SHEET_SUCCESS = BOOKING_SHEET_SUCCESS;

const BOOK_CTA = " Would you like me to book a consultation for you?";

/** Cooldown (ms) before starting another full booking after a successful sheet save — same session. */
const BOOKING_REPEAT_COOLDOWN_MS = 3 * 60 * 1000;

/** Fixed clinic hours — returned locally only; never sent to any API or sheet. */
const CLINIC_TIMINGS_STATIC =
  "Clinic Timings:\n\n" +
  "🗓 Monday – Thursday:\n" +
  "8:30 AM to 2:30 PM (Doctor Available)\n\n" +
  "🗓 Friday:\n" +
  "Closed (Holiday)\n\n" +
  "🗓 Saturday:\n" +
  "8:30 AM to 2:30 PM (Doctor Available)\n\n" +
  "🗓 Sunday:\n" +
  "Surgery Day (surgeries only)\n\n" +
  "For appointments or urgent queries, you can book through the chatbot or call the clinic.";

const BOOKING = {
  step1: "I can help you book an appointment. May I have your full name, please?",
  askPhone(name) {
    return `Thank you ${name}. Please share your phone number for confirmation.`;
  },
  askIssue: "Briefly tell us your eye issue (optional).",
  askPreferredTime:
    "At what time would you like to visit the clinic? (e.g. 1:00 PM, 3:30 PM)",
  timeRetry: "Please share your preferred visit time — for example 2:00 PM or morning.",
  done(name) {
    return `Thank you ${name}! Your appointment request has been received. Our clinic team will contact you shortly on your number to confirm your consultation timing.`;
  },
  nameRetry: "Could I have your name again, please? Two or more letters is enough.",
  phoneRetry: "That number looks a bit short. Please share your mobile number again (with country code if you like).",
  cancel: "No problem — I've cancelled the booking form. Whenever you're ready, just say book appointment again.",
};

function hasUrduScript(text) {
  return /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function urduHelpLine() {
  return " Aap WhatsApp par " + CLINIC.whatsapp + " par message kar sakte hain — hum aap ki madad karen ge.";
}

function localize(body, originalText) {
  if (!hasUrduScript(originalText)) return body;
  return body + urduHelpLine();
}

const MSG = {
  /** Exact wording — do not route to other intents. */
  emergencyUrgent:
    "This may be urgent. Please visit the clinic immediately or contact the doctor for emergency consultation.",

  escalateContact:
    "Please contact clinic via WhatsApp or call for immediate assistance.\n\nWhatsApp or call: " +
    CLINIC.whatsapp +
    ".",

  bookingCooldown:
    "We have just received a booking from you. Our team will contact you shortly. If you need to change the time or have an urgent question, please WhatsApp or call " +
    CLINIC.whatsapp +
    ".",

  priceGeneral:
    "Charges vary depending on the condition. For exact pricing, please contact the clinic or book a consultation. A short in-person visit is the safest way to plan care.",

  consultationFee:
    "The consultation fee is 500 PKR. Treatment options are discussed only after the doctor examines you in clinic." +
    BOOK_CTA,

  booking:
    "I can start a short booking here — say book appointment — or you may WhatsApp or call " +
    CLINIC.whatsapp +
    " anytime." +
    BOOK_CTA,

  contact:
    "You can reach us on WhatsApp or phone: " +
    CLINIC.whatsapp +
    ". We're happy to help with timings, directions, or appointments." +
    BOOK_CTA,

  location:
    CLINIC.name +
    " is in Mianwali at " +
    CLINIC.address +
    ". For directions, WhatsApp " +
    CLINIC.whatsapp +
    "." +
    BOOK_CTA,

  doctor:
    "Dr. Nusrat Ullah Khan is a Senior Eye Specialist with over 30+ years of experience in ophthalmology. He specializes in cataract surgery, laser treatment, and glaucoma management." +
    BOOK_CTA,

  services:
    "Our services include cataract surgery, laser eye treatment, glaucoma treatment, general eye consultation, and eye diagnostics. For any concern, we recommend booking a consultation so the doctor can advise you properly." +
    BOOK_CTA,

  medicalSafe:
    "I'm sorry you're dealing with that. I can't diagnose or prescribe here — only " +
    CLINIC.doctor +
    " can give safe advice after seeing your eyes. Please book a consultation or contact us on WhatsApp " +
    CLINIC.whatsapp +
    " so we can help you arrange a visit." +
    BOOK_CTA,

  unsure:
    "Thank you for your message. For personal eye concerns, a consultation is best. WhatsApp or call " +
    CLINIC.whatsapp +
    " — we're here to help." +
    BOOK_CTA,

  greeting:
    "Assalam-o-Alaikum. Welcome to " +
    CLINIC.name +
    ". I'm your reception desk assistant — ask about services, timings, the doctor, or fees. Say book appointment to start a booking." +
    BOOK_CTA,

  thanks: "You're welcome. For anything else, we're on WhatsApp " + CLINIC.whatsapp + ".",
};

function normalizeInput(text) {
  return String(text).trim().toLowerCase();
}

function containsAny(haystack, needles) {
  return needles.some((n) => haystack.includes(n));
}

/** Opening hours / doctor availability — keyword router (no backend). */
const TIMING_INTENT_PHRASES = [
  "timing",
  "timings",
  "availability",
  "working hours",
  "opening hours",
  "when doctor",
  "clinic open",
  "doctor free",
];

/**
 * @param {string} t — normalized lowercase user text
 * @returns {boolean}
 */
function matchesClinicTimingQuery(t) {
  if (!t) return false;
  if (containsAny(t, TIMING_INTENT_PHRASES)) return true;
  if (/\bopen\b/.test(t)) return true;
  if (/\bschedule\b/.test(t)) return true;
  if (/\bavailable\b/.test(t) && !/\bunavailable\b/.test(t)) return true;
  return false;
}

/** Possible emergency — fixed triage reply only; no booking/FAQ branching. */
const EMERGENCY_TRIAGE_PHRASES = [
  "eye pain",
  "pain in eye",
  "pain in the eye",
  "pain in my eye",
  "my eye hurts",
  "hurts my eye",
  "vision loss",
  "loss of vision",
  "lost vision",
  "losing vision",
  "sudden vision",
  "eye injury",
  "injured my eye",
  "injured eye",
  "injury to my eye",
  "bleeding eye",
  "blood in eye",
  "blood from eye",
  "eye bleeding",
  "bleeding from eye",
  "sudden blindness",
  "suddenly blind",
  "suddenly can't see",
  "suddenly cant see",
];

function matchesEmergencyTriage(t) {
  if (!t) return false;
  if (containsAny(t, EMERGENCY_TRIAGE_PHRASES)) return true;
  if (/\b(sudden|suddenly)\b/.test(t) && /\b(blind|blindness)\b/.test(t)) return true;
  if (/\b(pain|hurt|aching|aches)\b/.test(t) && /\beye(s)?\b/.test(t)) return true;
  return false;
}

const ESCALATION_CONFUSED_PHRASES = [
  "i don't understand",
  "dont understand",
  "don't understand",
  "confused",
  "not clear",
  "doesn't make sense",
  "does not make sense",
  "what are you saying",
  "i'm lost",
  "i am lost",
  "too complicated",
  "not making sense",
];

const ESCALATION_URGENT_HELP_PHRASES = [
  "urgent help",
  "need help urgently",
  "help urgently",
  "need immediate help",
  "immediate help",
  "asap help",
  "help asap",
];

function matchesEscalationIntent(t) {
  if (!t) return false;
  return containsAny(t, ESCALATION_CONFUSED_PHRASES) || containsAny(t, ESCALATION_URGENT_HELP_PHRASES);
}

function isConsultationFeeQuery(t) {
  return (
    containsAny(t, ["consultation fee", "checkup fee", "visit fee", "opd fee", "registration fee"]) ||
    (t.includes("consultation") && containsAny(t, ["fee", "fees", "cost", "price", "how much"])) ||
    (t.includes("500") && containsAny(t, ["fee", "consult", "check"]))
  );
}

/** Surgery / general pricing (not the fixed 500 PKR consultation fee). */
function isGeneralPriceOrSurgeryCostQuery(t) {
  if (!t || isConsultationFeeQuery(t)) return false;
  if (
    containsAny(t, [
      "how much",
      "cost",
      "price",
      "charge",
      "expensive",
      "rate",
      "package",
      "packages",
      "fee for surgery",
      "surgery cost",
      "surgery charges",
      "laser cost",
      "cataract cost",
      "charges for",
      "pricing",
      "kitna",
      "قیمت",
    ])
  ) {
    return true;
  }
  if (t.includes("fee") && !t.includes("consultation")) return true;
  return false;
}

/**
 * Starts guided intake (not the same as asking "consultation fee").
 */
function isBookingFlowTrigger(t) {
  if (t.includes("consultation fee")) return false;
  if (t.includes("consultation") && containsAny(t, ["fee", "fees", "cost", "price", "how much", "charge"])) return false;

  if (t.includes("book appointment") || t.includes("online booking") || t.includes("i want to book")) return true;
  if (t.includes("book") && t.includes("appointment")) return true;
  if (/\bconsultation\b/.test(t)) return true;
  return false;
}

function digitsOnly(s) {
  return String(s).replace(/\D/g, "");
}

function isValidName(name) {
  const n = String(name).trim();
  if (n.length < 2) return false;
  if (digitsOnly(n).length === n.replace(/\s/g, "").length && n.replace(/\s/g, "").length > 0) return false;
  return true;
}

function isValidPhone(raw) {
  const d = digitsOnly(raw);
  return d.length >= 10 && d.length <= 15;
}

function buildStaffWhatsAppBody(data) {
  const issue = data.issue && data.issue.trim() ? data.issue.trim() : "Not specified";
  let body =
    "New Online Appointment Request:\n" +
    "Name: " +
    data.name.trim() +
    "\nPhone: " +
    data.phone.trim() +
    "\nIssue: " +
    issue;
  if (data.timeOfVisit) {
    body += "\nTime of visit: " + data.timeOfVisit;
  }
  return body;
}

function openPrefilledWhatsApp(body) {
  const url = "https://wa.me/" + BOOKING_NOTIFY_WHATSAPP + "?text=" + encodeURIComponent(body);
  window.open(url, "_blank", "noopener,noreferrer");
}

/** CTAs that should open the reception chat with a booking intent (not plain “Contact”). */
function isBookingCtaElement(el) {
  if (!el || !(el instanceof Element)) return false;
  if (el.closest("#clinic-chat-panel")) return false;
  if (el.getAttribute("data-chat-intent") === "booking") return true;
  if (el.classList.contains("fab-book")) return true;
  const aria = (el.getAttribute("aria-label") || "").toLowerCase();
  if (aria.includes("book") && (aria.includes("appointment") || aria.includes("consultation"))) return true;
  const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (t.includes("book appointment") || t.includes("book consultation")) return true;
  if (t.includes("book") && t.includes("appointment")) return true;
  return false;
}

function wireGlobalBookingIntentCtasOnce() {
  if (typeof document === "undefined" || window.__clinicBookingCtaWired) return;
  window.__clinicBookingCtaWired = true;
  document.addEventListener(
    "click",
    function (ev) {
      const el = ev.target && ev.target.closest ? ev.target.closest("a, button") : null;
      if (!isBookingCtaElement(el)) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof window.openChatbotWithIntent === "function") {
        window.openChatbotWithIntent("booking");
      }
    },
    true
  );
}

/** Global entry: opens embedded panel (if present) and sends booking intent after init. */
window.openChatbotWithIntent = function (type) {
  if (typeof window.__openChatbotWithIntentImpl === "function") {
    window.__openChatbotWithIntentImpl(type);
  }
};

/**
 * @param {string} userText
 * @param {{ bookingCooldownUntil?: number }} [opts]
 */
function getBotReply(userText, opts) {
  opts = opts || {};
  const bookingCooldownUntil = Number(opts.bookingCooldownUntil) || 0;

  const raw = String(userText).trim();
  const t = normalizeInput(raw);
  if (!t) return localize(MSG.unsure, raw);

  if (matchesEmergencyTriage(t)) {
    return MSG.emergencyUrgent;
  }

  if (matchesClinicTimingQuery(t)) {
    return CLINIC_TIMINGS_STATIC;
  }

  if (containsAny(t, ["thank", "thanks", "shukriya", "shukria", "mersi", "meharbani"])) {
    return localize(MSG.thanks, raw);
  }

  if (matchesEscalationIntent(t)) {
    return localize(MSG.escalateContact, raw);
  }

  const medicalHints = [
    "pain",
    "hurt",
    "hurting",
    "emergency",
    "red eye",
    "itch",
    "discharge",
    "blind",
    "blurry",
    "blurred",
    "floaters",
    "flashes",
    "double vision",
    "injury",
    "chemical",
    "diagnos",
    "symptom",
    "infection",
    "pus",
    "cannot see",
    "can't see",
    "cant see",
    "is it serious",
    "what disease",
    "which disease",
    "do i have",
    "medicine for",
    "tablet for",
    "drops for",
    "dard",
    "dukh",
    "ansu",
    "نظر",
    "درد",
  ];
  if (containsAny(t, medicalHints)) {
    return localize(MSG.medicalSafe, raw);
  }

  if (isConsultationFeeQuery(t)) {
    return localize(MSG.consultationFee, raw);
  }

  if (isGeneralPriceOrSurgeryCostQuery(t)) {
    return localize(MSG.priceGeneral, raw);
  }

  if (isBookingFlowTrigger(t)) {
    if (Date.now() < bookingCooldownUntil) {
      return localize(MSG.bookingCooldown, raw);
    }
    return "__START_BOOKING__";
  }

  if (containsAny(t, ["book", "booking", "appointment", "schedule", "slot", "register", "reserve", "visit"])) {
    return localize(MSG.booking, raw);
  }

  if (containsAny(t, ["where", "address", "location", "map", "direction", "mianwali", "ballo khel", "khan zaman", "kahan", "کہاں"])) {
    return localize(MSG.location, raw);
  }

  if (containsAny(t, ["whatsapp", "phone", "call", "contact", "number", "reach you", "رابطہ"])) {
    return localize(MSG.contact, raw);
  }

  if (containsAny(t, ["doctor", "dr.", "dr ", "nusrat", "ophthalm", "experience", "qualification", "mbbs", "doms", "who is"])) {
    return localize(MSG.doctor, raw);
  }

  if (
    containsAny(t, [
      "service",
      "services",
      "treatment",
      "treatments",
      "laser",
      "cataract",
      "glaucoma",
      "lens",
      "checkup",
      "check-up",
      "surgery",
      "diagnostic",
      "what do you",
      "what you offer",
      "eye clinic",
    ])
  ) {
    return localize(MSG.services, raw);
  }

  if (
    /^(hi|hello|hey|salam|assalam|aoa|asalam|good morning|good afternoon|good evening)\b/.test(t) ||
    (t.length < 28 && containsAny(t, ["salam", "assalam"]))
  ) {
    return localize(MSG.greeting, raw);
  }

  return localize(MSG.unsure, raw);
}

function createMessageRow(text, role) {
  const row = document.createElement("div");
  row.className = `chat-row chat-row--${role}`;

  const bubble = document.createElement("div");
  bubble.className = `chat-msg chat-msg--${role}`;
  bubble.textContent = text;

  row.appendChild(bubble);
  return row;
}

/** Speak assistant text aloud (cancels any in-progress utterance first). */
function speak(message) {
  if (!("speechSynthesis" in window)) return;
  const plain = String(message || "").trim();
  if (!plain) return;

  const speech = new SpeechSynthesisUtterance(plain);
  speech.lang = "en-US";
  speech.rate = 1;
  speech.pitch = 1;

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {
    /* ignore */
  }

  window.setTimeout(function () {
    try {
      window.speechSynthesis.speak(speech);
    } catch {
      /* blocked or unsupported */
    }
  }, 0);
}

function initChatbot() {
  const messagesEl = document.getElementById("chat-messages");
  const formEl = document.getElementById("chat-form");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const micBtn = document.getElementById("chat-mic");

  if (!messagesEl || !formEl || !inputEl || !sendBtn) {
    window.__openChatbotWithIntentImpl = function () {};
    window.setChatbotOpen = function () {};
    window.sendChatbotMessage = function () {};
    return;
  }

  const chatPanel = document.getElementById("clinic-chat-panel");
  const chatOverlay = document.getElementById("clinic-chat-overlay");
  const chatCloseBtn = document.getElementById("clinic-chat-close");

  /** @type {'idle'|'name'|'phone'|'issue'|'time'|'sending'} */
  let bookingState = "idle";
  const bookingData = { name: "", phone: "", issue: "", userSelectedTime: "" };

  /** True for the current user turn when the message was sent via mic (voice in → voice out for bot replies). */
  let isVoiceMode = false;

  /** Blocks starting a new booking immediately after a successful sheet save (same browser session). */
  let bookingCooldownUntil = 0;

  /** Counts consecutive general pricing questions (excludes fixed consultation fee) for escalation. */
  let consecutivePriceAsks = 0;

  /** Dedupes rapid duplicate programmatic sends (e.g. double‑click on Book). */
  let lastAutoProgrammaticText = "";
  let lastAutoProgrammaticAt = 0;

  let bookingIntentTimer = null;

  function onEscapeClosePanel(e) {
    if (e.key === "Escape") setChatbotPanelOpen(false);
  }

  function setChatbotPanelOpen(open) {
    if (!chatPanel) return;
    chatPanel.classList.toggle("is-open", open);
    if (chatOverlay) {
      chatOverlay.classList.toggle("is-open", open);
      chatOverlay.setAttribute("aria-hidden", open ? "false" : "true");
    }
    chatPanel.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("clinic-chat-open", open);
    if (open) {
      document.removeEventListener("keydown", onEscapeClosePanel);
      document.addEventListener("keydown", onEscapeClosePanel);
      inputEl.focus();
    } else {
      document.removeEventListener("keydown", onEscapeClosePanel);
    }
  }

  /** Exposed for host pages (embedded panel). */
  window.setChatbotOpen = setChatbotPanelOpen;

  function openChatbotUI() {
    setChatbotPanelOpen(true);
  }

  function sendMessage(text, opts) {
    inputEl.value = String(text || "").trim();
    handleSend(Object.assign({ auto: true, voice: false }, opts || {}));
  }

  /** Programmatic send (same pipeline as typing + Send). */
  window.sendChatbotMessage = sendMessage;

  window.__openChatbotWithIntentImpl = function (type) {
    openChatbotUI();
    if (type === "booking") {
      if (bookingIntentTimer) window.clearTimeout(bookingIntentTimer);
      bookingIntentTimer = window.setTimeout(function () {
        bookingIntentTimer = null;
        sendMessage("Hi, I want to book an appointment.", { auto: true });
      }, 300);
    }
  };

  if (chatCloseBtn) {
    chatCloseBtn.addEventListener("click", function () {
      setChatbotPanelOpen(false);
    });
  }
  if (chatOverlay) {
    chatOverlay.addEventListener("click", function () {
      setChatbotPanelOpen(false);
    });
  }

  function resetBooking() {
    bookingState = "idle";
    bookingData.name = "";
    bookingData.phone = "";
    bookingData.issue = "";
    bookingData.userSelectedTime = "";
  }

  messagesEl.setAttribute("role", "log");
  messagesEl.setAttribute("aria-live", "polite");
  messagesEl.setAttribute("aria-relevant", "additions");

  function scrollToLatest() {
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      requestAnimationFrame(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    });
  }

  /**
   * @param {string} text
   * @param {"user"|"bot"} role
   * @param {boolean} [voiceMode] — when role is bot, speak aloud only if true (snapshot from user turn; survives async).
   */
  function appendMessage(text, role, voiceMode = false) {
    messagesEl.appendChild(createMessageRow(text, role));
    scrollToLatest();
    if (role === "bot") {
      if (voiceMode) {
        requestAnimationFrame(function () {
          speak(text);
        });
      }
    }
  }

  function startBookingFlow(voiceSnapshot) {
    bookingState = "name";
    bookingData.name = "";
    bookingData.phone = "";
    bookingData.issue = "";
    bookingData.userSelectedTime = "";
    appendMessage(BOOKING.step1, "bot", voiceSnapshot);
  }

  function processBookingInput(raw, trimmed, voiceSnapshot) {
    const t = normalizeInput(trimmed);

    if (t === "cancel" || t === "stop" || t === "exit") {
      resetBooking();
      appendMessage(BOOKING.cancel, "bot", voiceSnapshot);
      return;
    }

    if (bookingState === "name") {
      if (!isValidName(trimmed)) {
        appendMessage(BOOKING.nameRetry, "bot", voiceSnapshot);
        return;
      }
      bookingData.name = trimmed.trim();
      bookingState = "phone";
      appendMessage(BOOKING.askPhone(bookingData.name), "bot", voiceSnapshot);
      return;
    }

    if (bookingState === "phone") {
      if (!isValidPhone(trimmed)) {
        appendMessage(BOOKING.phoneRetry, "bot", voiceSnapshot);
        return;
      }
      bookingData.phone = trimmed.trim();
      bookingState = "issue";
      appendMessage(BOOKING.askIssue, "bot", voiceSnapshot);
      return;
    }

    if (bookingState === "issue") {
      const issueText = trimmed ? trimmed : "Not specified";
      bookingData.issue = issueText;
      bookingState = "time";
      appendMessage(BOOKING.askPreferredTime, "bot", voiceSnapshot);
      return;
    }

    if (bookingState === "time") {
      if (!trimmed) {
        appendMessage(BOOKING.timeRetry, "bot", voiceSnapshot);
        return;
      }
      bookingData.userSelectedTime = trimmed.trim();
      bookingState = "sending";
      finalizeBookingToSheetAndMaybeWhatsApp(bookingData, sendBtn, inputEl, voiceSnapshot);
    }
  }

  /**
   * POST intake to private Google Sheet via Apps Script; on failure keep WhatsApp fallback.
   */
  function finalizeBookingToSheetAndMaybeWhatsApp(data, submitBtn, input, voiceSnapshot) {
    const userSelectedTime = String(data.userSelectedTime || "").trim();
    const snapshot = {
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
      issue: String(data.issue || "").trim() || "Not specified",
      timeOfVisit: userSelectedTime,
    };

    submitBtn.disabled = true;
    input.disabled = true;

    void (async () => {
      let isSuccess = false;

      const data = {
        name: snapshot.name,
        phone: snapshot.phone,
        issue: snapshot.issue,
        timeOfVisit: snapshot.timeOfVisit,
      };

      try {
        const res = await fetch(BOOKING_WEBAPP_URL, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const text = (await res.text()).trim().toLowerCase();
        isSuccess = res.ok && !text.startsWith("error") && text.includes("success");
      } catch {
        isSuccess = false;
      }

      if (isSuccess) {
        bookingCooldownUntil = Date.now() + BOOKING_REPEAT_COOLDOWN_MS;
        appendMessage(BOOKING_SHEET_SUCCESS, "bot", voiceSnapshot);
      } else {
        appendMessage(BOOKING.done(snapshot.name), "bot", voiceSnapshot);
        openPrefilledWhatsApp(buildStaffWhatsAppBody(snapshot));
      }

      resetBooking();
      submitBtn.disabled = false;
      input.disabled = false;
      input.focus();
      scrollToLatest();
    })();
  }

  /**
   * @param {{ voice?: boolean }} [options] — pass `{ voice: true }` when send originates from speech recognition.
   */
  function handleSend(options) {
    if (sendBtn.disabled || bookingState === "sending") return;

    const currentVoiceMode = Boolean(options && options.voice);
    isVoiceMode = currentVoiceMode;
    const voiceSnapshot = isVoiceMode;

    const raw = String(inputEl.value);
    const trimmed = raw.trim();
    const allowEmptySend = bookingState === "issue";

    if (!trimmed && !allowEmptySend) return;

    if (options && options.auto && trimmed) {
      const now = Date.now();
      if (trimmed === lastAutoProgrammaticText && now - lastAutoProgrammaticAt < 2500) {
        inputEl.value = "";
        return;
      }
      lastAutoProgrammaticText = trimmed;
      lastAutoProgrammaticAt = now;
    }

    const userDisplay = trimmed || (allowEmptySend ? "(skipped)" : "");
    appendMessage(userDisplay, "user");

    const normalizedForIntent = normalizeInput(trimmed);

    if (matchesEmergencyTriage(normalizedForIntent)) {
      resetBooking();
      consecutivePriceAsks = 0;
      appendMessage(MSG.emergencyUrgent, "bot", voiceSnapshot);
      inputEl.value = "";
      inputEl.focus();
      scrollToLatest();
      return;
    }

    if (matchesClinicTimingQuery(normalizedForIntent)) {
      appendMessage(CLINIC_TIMINGS_STATIC, "bot", voiceSnapshot);
      inputEl.value = "";
      inputEl.focus();
      scrollToLatest();
      return;
    }

    if (matchesEscalationIntent(normalizedForIntent)) {
      resetBooking();
      consecutivePriceAsks = 0;
      appendMessage(localize(MSG.escalateContact, raw), "bot", voiceSnapshot);
      inputEl.value = "";
      inputEl.focus();
      scrollToLatest();
      return;
    }

    if (bookingState === "idle") {
      if (isGeneralPriceOrSurgeryCostQuery(normalizedForIntent)) {
        consecutivePriceAsks += 1;
      } else {
        consecutivePriceAsks = 0;
      }
      if (consecutivePriceAsks >= 3) {
        consecutivePriceAsks = 0;
        appendMessage(localize(MSG.escalateContact, raw), "bot", voiceSnapshot);
        inputEl.value = "";
        inputEl.focus();
        scrollToLatest();
        return;
      }
    }

    if (bookingState !== "idle") {
      processBookingInput(raw, trimmed, voiceSnapshot);
      inputEl.value = "";
      inputEl.focus();
      scrollToLatest();
      return;
    }

    const reply = getBotReply(trimmed, { bookingCooldownUntil });
    if (reply === "__START_BOOKING__") {
      startBookingFlow(voiceSnapshot);
    } else {
      appendMessage(reply, "bot", voiceSnapshot);
    }

    inputEl.value = "";
    inputEl.focus();
    scrollToLatest();
  }

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSend();
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    handleSend();
  });

  if (micBtn) {
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let micListening = false;

      function setMicListening(on) {
        micListening = on;
        micBtn.classList.toggle("is-active", on);
        micBtn.setAttribute("aria-pressed", on ? "true" : "false");
        micBtn.setAttribute(
          "aria-label",
          on ? "Listening… click to stop" : "Speak your message"
        );
      }

      recognition.onresult = function (event) {
        setMicListening(false);
        const raw = event.results[0] && event.results[0][0] ? event.results[0][0].transcript : "";
        const text = String(raw).trim().slice(0, 2000);
        if (!text) return;
        inputEl.value = text;
        handleSend({ voice: true });
      };

      recognition.onerror = function (event) {
        setMicListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          appendMessage(
            "Microphone access was blocked. Please allow the microphone for this site in your browser settings, or type your message.",
            "bot"
          );
          scrollToLatest();
        } else if (event.error !== "aborted" && event.error !== "no-speech") {
          appendMessage("Voice input had a problem. Please try again or type your message.", "bot");
          scrollToLatest();
        }
      };

      recognition.onend = function () {
        setMicListening(false);
      };

      micBtn.addEventListener("click", function () {
        if (sendBtn.disabled || bookingState === "sending") return;

        if (micListening) {
          try {
            recognition.stop();
          } catch (_) {
            /* ignore */
          }
          setMicListening(false);
          return;
        }

        try {
          setMicListening(true);
          recognition.start();
        } catch (_) {
          setMicListening(false);
          appendMessage("Could not start voice input. Please try again or type your message.", "bot");
          scrollToLatest();
        }
      });
    } else {
      micBtn.disabled = true;
      micBtn.title = "Voice input is not supported in this browser";
      micBtn.setAttribute("aria-label", "Voice input not supported in this browser");
    }
  }

  const welcome =
    "Assalam-o-Alaikum — welcome to " +
    CLINIC.name +
    ". I'm your virtual reception desk. Ask about Dr. Nusrat Ullah Khan, services, timings, or the 500 PKR consultation fee. Say book appointment to start a short booking (saved securely, with WhatsApp as backup if needed). WhatsApp or call " +
    CLINIC.whatsapp +
    " anytime.";

  appendMessage(welcome, "bot");
  inputEl.focus();
  scrollToLatest();

  if (typeof window !== "undefined" && window.location) {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("book") === "1" || sp.get("intent") === "booking") {
      window.setTimeout(function () {
        if (chatPanel) setChatbotPanelOpen(true);
        sendMessage("Hi, I want to book an appointment.", { auto: true });
      }, chatPanel ? 450 : 400);
    }
  }
}

wireGlobalBookingIntentCtasOnce();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChatbot);
} else {
  initChatbot();
}
