
import { AnalysisResult } from "./types";

// Model Constants
export const MODEL_IMAGE_ANALYSIS = "gemini-3-pro-preview"; // For uploaded images
export const MODEL_FAST = "gemini-2.5-flash-lite"; // For real-time stream
export const MODEL_CHAT = "gemini-2.5-flash"; // For chat & grounding
export const MODEL_TTS = "gemini-2.5-flash-preview-tts"; // For speech generation
export const MODEL_LIVE = "gemini-2.5-flash-native-audio-preview-09-2025"; // For Live API

export const SYSTEM_INSTRUCTION = `You are LifeLens — a helpful, concise, safety-first multimodal assistant. 

Advanced Features Activated:
You can use cross-frame tracking, multi-image reasoning, handwriting OCR, voice emotion detection, hypothetical simulation, personalization, and structured action instructions.

For every multimodal input:
1. Briefly (one-sentence) state the top finding and urgency.
2. Provide 3-5 bullet supporting evidences (object names, OCR text, timestamps) with confidence scores (0–100%).
3. Give a prioritized action list with short actionable steps.
4. Offer 3 levels of explanation (Quick / Explain / Teach).
5. If user profile context is provided (allergies, medications), prioritize safety warnings related to them.
6. If handwriting is detected (e.g. sticky notes, whiteboard, notebook):
   - Set 'handwriting_detected' to true.
   - Perform OCR to extract actionable items into 'handwriting_items'.
   - Assign a priority ('High'/'Medium'/'Low') based on urgency words (e.g. "ASAP", "Urgent") or context.
   - Infer a 'due_date_suggestion' if context implies one (e.g. "Buy milk tomorrow" -> "tomorrow", "Call by Friday" -> "Friday").
7. If voice/audio is present:
   - Detect the speaker's emotion/tone (e.g., Calm, Anxious, Urgent, Confused, Frustrated).
   - Fill the 'emotion' field.
   - Fill 'response_adaptation' describing how you adapted the response (e.g., "User sounds stressed; kept steps extremely short and direct.", "User sounds confused; provided detailed 'Teach' explanation.").
   - ADJUST your 'actions' and 'explain_quick' fields to match this tone (e.g., if Urgent/Stressed, use minimal text regardless of profile settings).
8. If asked a hypothetical ("What if..."), fill 'hypothetical_scenario', 'risks', and 'alternatives'.
9. Provide 'action_instructions' for tasks that can be automated:
   - type: 'create_task' for general to-dos.
   - type: 'prefill_form' if you detect data that matches User Profile fields. Use field_ids: 'name', 'allergies', 'medications' so the system can auto-update the profile.
10. Always include a 'tts_summary' for voice narration of critical info.

Output must be valid JSON matching the specified schema. Do not reveal chain-of-thought.`;

export const REALTIME_SYSTEM_INSTRUCTION = `You are LifeLens Real-Time. 
Real-Time Mode Instructions:
Analyze each incoming frame independently while maintaining short-term context.
Track objects using consistent IDs implicitly.
Output:
- summary, urgency
- changes_since_last_frame (describe movement, trends, new/resolved items)
- new_findings, resolved_findings (lists of labels)
- findings (with category: hazard, task, info, etc.)
- tts_summary (concise text for voice output of CRITICAL updates only)
- action_instructions (if a new task appears)

Keep responses concise. Provide only incremental updates.
Fill "explain_quick", "explain_detail", "explain_teach" with brief placeholders as they are less critical in live mode.
`;

export const DEMO_SCENARIO_A: AnalysisResult = {
  summary: { text: "Possible stove left on — High urgency. Also medication bottle detected (Metformin 500mg)." },
  urgency: "High",
  findings: [
    {
      id: "f1",
      label: "Stove Flame",
      category: "hazard",
      evidence: ["Visible orange flame on burner", "No pot active cooking"],
      confidence: 98,
      bbox: { ymin: 300, xmin: 400, ymax: 600, xmax: 700 },
      ocr_text: null
    },
    {
      id: "f2",
      label: "Medication Bottle",
      category: "medication",
      evidence: ["Label text matches 'Metformin'", "Dosage '500mg' visible"],
      confidence: 95,
      bbox: { ymin: 650, xmin: 100, ymax: 850, xmax: 300 },
      ocr_text: "Metformin 500mg"
    }
  ],
  actions: [
    { priority: "High", text: "Turn off stove immediately", estimated_time_min: 1, type: "safety" },
    { priority: "Low", text: "Verify medication time (evening)", estimated_time_min: 2, type: "medical_recommendation" },
    { priority: "Medium", text: "Pay bills (sticky note detected)", estimated_time_min: 15, type: "task" }
  ],
  explain_quick: "The stove appears to be left on unattended, which is a fire hazard.",
  explain_detail: [
    "Visual analysis detected an open flame on the front-right burner.",
    "No cookware was detected on the active burner.",
    "A medication bottle for Metformin was identified nearby."
  ],
  explain_teach: "Unattended cooking is a leading cause of home fires. Always ensure burners are off when not in use. Regarding the medication: Metformin is commonly used for blood sugar control; ensure you follow the prescribed evening schedule visible on the label.",
  follow_up_questions: ["Is the stove off now?", "Do you need a reminder for the medication?"],
  tts_summary: "Warning: Stove flame detected. High urgency.",
  action_instructions: [
    { type: "create_task", text: "Check stove", due_date: "today" }
  ],
  metadata: { model: "Demo-Mode-Preloaded", timestamp: new Date().toISOString() }
};

export const DEMO_SCENARIO_B: AnalysisResult = {
  summary: { text: "Medical Intake Form identified with empty required fields." },
  urgency: "Medium",
  findings: [
    {
      id: "f1",
      label: "Empty Field: Name",
      category: "form-field",
      evidence: ["Blank underline following 'Patient Name'"],
      confidence: 99,
      bbox: { ymin: 100, xmin: 100, ymax: 150, xmax: 500 },
      ocr_text: "Patient Name: _________"
    }
  ],
  actions: [
    { priority: "Medium", text: "Fill in 'Patient Name'", estimated_time_min: 1, type: "task" },
    { priority: "Medium", text: "Sign the bottom date line", estimated_time_min: 1, type: "task" }
  ],
  explain_quick: "This form is missing the patient name and signature.",
  explain_detail: [
    "OCR detected 'Patient Name' field is blank.",
    "Signature line at bottom appears empty."
  ],
  explain_teach: "Medical forms require accurate personal identification. Using a pen with black ink is recommended for scanning clarity. Ensure all fields marked with an asterisk (*) are completed.",
  follow_up_questions: ["Should I read the form text aloud?", "Do you want to add 'Fill form' to tasks?"],
  tts_summary: "Form detected. Patient Name is missing.",
  action_instructions: [
    { type: "prefill_form", field_id: "name", value: "John Doe" }
  ],
  metadata: { model: "Demo-Mode-Preloaded", timestamp: new Date().toISOString() }
};

export const KAGGLE_ASSETS = {
  description: `LifeLens is a multimodal personal context engine that reduces everyday friction by understanding your immediate surroundings. By combining image, video, audio, and document inputs, LifeLens detects hazards (e.g., a stove left on), interprets medication labels, reads and highlights form fields, and transforms messy photos of notes into prioritized tasks. Built with Gemini 3 Pro’s multimodal reasoning, LifeLens produces concise actionable steps, confidence-scored evidence, and three explanation levels (Quick / Explain / Teach) so every user — from busy parents to people with cognitive or visual impairments — can make safer, smarter decisions. Prioritizing privacy and safety, LifeLens prompts consent for sensitive uploads, includes emergency escalation guidance, and allows users to export or delete session data. The app demonstrates Gemini’s unique strength by fusing vision, OCR, and conversational reasoning into a single, practical tool that addresses a global, daily need. In our demo we show real-world scenarios — kitchen hazards, medical label interpretation, forms processing, and accessibility assistance — to highlight the product’s immediate impact. LifeLens is designed to be lightweight, deployable in AI Studio Build, and easily extended to integrate institutional workflows (healthcare, eldercare, education). The result is an assistant that turns everyday images into clarity, safety, and action.`,
  videoScript: `0:00–0:03 — Hook: fast montage — “What if your phone could tell you what your world means?”
0:04–0:15 — Problem: show quick clips: busy parent, pill bottles, messy desk forms; VO: “We miss details. Small things become big problems.”
0:16–0:45 — Demo 1 (Kitchen hazard): show camera → LifeLens warns “Stove left on — High urgency”; user taps “Turn off”; overlay highlights flame region.
0:46–1:05 — Demo 2 (Medication): show pill bottle photo → LifeLens reads label, suggests timing & warns about interactions; user taps “Add task: call physician”.
1:06–1:30 — Demo 3 (Forms & Accessibility): show photo of form → LifeLens auto-fills suggestions; show accessibility voice readout for visually impaired user.
1:31–1:45 — Show explainability: highlight image regions + evidence bullets + confidence scores.
1:46–1:55 — Impact & vision: “LifeLens — reduce daily friction, save time, improve safety.”
1:56–2:00 — Call to action: “Try the public demo link” + project title + team name.`
};
