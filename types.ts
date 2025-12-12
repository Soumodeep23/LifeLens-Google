
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export type FindingCategory = "hazard" | "task" | "info" | "medication" | "form-field" | "other";

export interface Finding {
  id: string;
  label: string;
  category: FindingCategory;
  evidence: string[];
  confidence: number;
  bbox: BoundingBox | null;
  ocr_text: string | null;
}

export type ActionType = "safety" | "task" | "info" | "medical_recommendation";

export interface Action {
  priority: "High" | "Medium" | "Low";
  text: string;
  estimated_time_min: number;
  type: ActionType;
}

export interface HandwritingItem {
  text: string;
  priority: "High" | "Medium" | "Low";
  due_date_suggestion?: string;
}

export interface Risk {
  description: string;
  severity: "High" | "Medium" | "Low";
}

export interface ActionInstruction {
  type: "create_task" | "prefill_form" | "highlight";
  text?: string;
  due_date?: string;
  field_id?: string;
  value?: string;
  object_id?: string;
}

export interface AnalysisResult {
  summary: { text: string };
  urgency: "High" | "Medium" | "Low";
  findings: Finding[];
  actions: Action[];
  explain_quick: string;
  explain_detail: string[];
  explain_teach: string;
  follow_up_questions: string[];
  
  // Advanced Features
  handwriting_detected?: boolean;
  handwriting_items?: HandwritingItem[];
  emotion?: string;
  response_adaptation?: string;
  hypothetical_scenario?: boolean;
  risks?: Risk[];
  alternatives?: string[];
  multi_image_reasoning?: boolean;
  tts_summary?: string;
  action_instructions?: ActionInstruction[];
  
  metadata: {
    model: string;
    timestamp: string;
  };
}

export interface LiveAnalysisResult extends AnalysisResult {
  changes_since_last_frame: string;
  new_findings: string[];
  resolved_findings: string[];
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  priority: "High" | "Medium" | "Low";
}

export interface GroundingChunk {
  web?: { uri: string; title: string };
  maps?: { uri: string; title: string; placeAnswerSources?: any[] };
}

export interface GroundingMetadata {
  groundingChunks: GroundingChunk[];
  webSearchQueries?: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  groundingMetadata?: GroundingMetadata;
}

export interface UserProfile {
  allergies: string;
  medications: string;
  explanationLevel: 'quick' | 'explain' | 'teach';
  enableTTS: boolean;
  name: string;
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  type: 'image' | 'audio' | 'video' | 'live';
  summary: string;
  thumbnailUrl?: string; // For images
  urgency: "High" | "Medium" | "Low";
}
