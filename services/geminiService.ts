
import { GoogleGenAI, Type, Schema, LiveServerMessage, Modality } from "@google/genai";
import { 
  MODEL_IMAGE_ANALYSIS, 
  MODEL_FAST, 
  MODEL_CHAT, 
  MODEL_TTS, 
  MODEL_LIVE, 
  SYSTEM_INSTRUCTION, 
  REALTIME_SYSTEM_INSTRUCTION 
} from "../constants";
import { AnalysisResult, LiveAnalysisResult, UserProfile, HistoryItem, ChatMessage } from "../types";

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY not found in environment");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

// Common sub-schemas
const findingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    label: { type: Type.STRING },
    category: { type: Type.STRING, enum: ["hazard", "task", "info", "medication", "form-field", "other"] },
    evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
    confidence: { type: Type.NUMBER },
    bbox: {
      type: Type.OBJECT,
      properties: {
        ymin: { type: Type.NUMBER },
        xmin: { type: Type.NUMBER },
        ymax: { type: Type.NUMBER },
        xmax: { type: Type.NUMBER },
      },
      nullable: true
    },
    ocr_text: { type: Type.STRING, nullable: true }
  }
};

const actionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    text: { type: Type.STRING },
    estimated_time_min: { type: Type.NUMBER },
    type: { type: Type.STRING, enum: ["safety", "task", "info", "medical_recommendation"] }
  }
};

const actionInstructionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ["create_task", "prefill_form", "highlight"] },
    text: { type: Type.STRING, nullable: true },
    due_date: { type: Type.STRING, nullable: true },
    field_id: { type: Type.STRING, nullable: true },
    value: { type: Type.STRING, nullable: true },
    object_id: { type: Type.STRING, nullable: true },
  }
};

const handwritingItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    due_date_suggestion: { type: Type.STRING, nullable: true }
  }
};

const riskSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING },
    severity: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
  }
};

// Main Analysis Schema
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } },
    urgency: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    findings: { type: Type.ARRAY, items: findingSchema },
    actions: { type: Type.ARRAY, items: actionSchema },
    explain_quick: { type: Type.STRING },
    explain_detail: { type: Type.ARRAY, items: { type: Type.STRING } },
    explain_teach: { type: Type.STRING },
    follow_up_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    
    // Advanced
    handwriting_detected: { type: Type.BOOLEAN, nullable: true },
    handwriting_items: { type: Type.ARRAY, items: handwritingItemSchema, nullable: true },
    emotion: { type: Type.STRING, nullable: true },
    response_adaptation: { type: Type.STRING, nullable: true },
    hypothetical_scenario: { type: Type.BOOLEAN, nullable: true },
    risks: { type: Type.ARRAY, items: riskSchema, nullable: true },
    alternatives: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    multi_image_reasoning: { type: Type.BOOLEAN, nullable: true },
    tts_summary: { type: Type.STRING, nullable: true },
    action_instructions: { type: Type.ARRAY, items: actionInstructionSchema, nullable: true },

    metadata: {
      type: Type.OBJECT,
      properties: {
        model: { type: Type.STRING },
        timestamp: { type: Type.STRING }
      }
    }
  },
  required: ["summary", "urgency", "findings", "actions", "explain_quick", "explain_detail", "explain_teach", "follow_up_questions"]
};

// Schema for Real-Time stream
const liveAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } },
    urgency: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
    changes_since_last_frame: { type: Type.STRING },
    new_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
    resolved_findings: { type: Type.ARRAY, items: { type: Type.STRING } },
    findings: { type: Type.ARRAY, items: findingSchema },
    actions: { type: Type.ARRAY, items: actionSchema },
    tts_summary: { type: Type.STRING, nullable: true },
    action_instructions: { type: Type.ARRAY, items: actionInstructionSchema, nullable: true },
    
    explain_quick: { type: Type.STRING },
    explain_detail: { type: Type.ARRAY, items: { type: Type.STRING } },
    explain_teach: { type: Type.STRING },
    follow_up_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    
    metadata: {
      type: Type.OBJECT,
      properties: {
        model: { type: Type.STRING },
        timestamp: { type: Type.STRING }
      }
    }
  },
  required: ["summary", "urgency", "changes_since_last_frame", "new_findings", "resolved_findings", "findings", "actions", "explain_quick"]
};

export const analyzeMedia = async (
  files: File[] | File | null, 
  userText: string = "",
  mediaData?: string, // Legacy support for single base64
  userProfile?: UserProfile | null,
  historyItems?: HistoryItem[]
): Promise<AnalysisResult> => {
  const ai = getClient();
  const parts: any[] = [];
  
  // Handle Multi-File (Images or Audio)
  if (Array.isArray(files)) {
     for (const file of files) {
        const reader = new FileReader();
        const data = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
        const base64 = data.split(',')[1];
        parts.push({ inlineData: { mimeType: file.type, data: base64 } });
     }
  } else if (files && mediaData) {
    // Single file legacy path
    const base64Data = mediaData.split(',')[1] || mediaData;
    parts.push({
      inlineData: {
        mimeType: files.type,
        data: base64Data
      }
    });
  }

  // Profile Context
  if (userProfile) {
    const profileText = `User Profile Context: 
    - Allergies: ${userProfile.allergies || "None"}
    - Medications: ${userProfile.medications || "None"}
    - Preferred Explanation Level: ${userProfile.explanationLevel}
    - Name: ${userProfile.name}
    Please adapt analysis to this profile.`;
    parts.push({ text: profileText });
  }

  // Session History Context
  if (historyItems && historyItems.length > 0) {
    const historyContext = historyItems.map(h => 
      `[${h.timestamp}] ${h.type.toUpperCase()}: ${h.summary} (Urgency: ${h.urgency})`
    ).join('\n');
    parts.push({ text: `Session History (Previous Context):\n${historyContext}\nReference these if relevant.` });
  }

  if (userText) {
    parts.push({ text: `User Note: ${userText}` });
  }

  parts.push({ text: "Analyze the input(s) and provide the JSON output as specified." });

  // Use Gemini 3 Pro for Image Analysis (Complex Tasks)
  const response = await ai.models.generateContent({
    model: MODEL_IMAGE_ANALYSIS,
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: analysisSchema,
      temperature: 0.2
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("JSON Parse Error", text);
    throw new Error("Failed to parse Gemini response");
  }
};

export const analyzeStreamFrame = async (
  base64Image: string,
  contextHistory: string[],
  userProfile?: UserProfile | null
): Promise<LiveAnalysisResult> => {
  const ai = getClient();
  
  const historyText = contextHistory.length > 0 
    ? `Short-term context (previous frames):\n${contextHistory.join("\n")}\n\n` 
    : "No previous context (first frame).\n\n";

  let profileText = "";
  if (userProfile) {
     profileText = `User Context: Allergies: ${userProfile.allergies}, Meds: ${userProfile.medications}.\n`;
  }

  const parts = [
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image.split(',')[1] || base64Image
      }
    },
    { text: `${profileText}${historyText}Analyze this current frame relative to the context.` }
  ];

  // Use Gemini Flash Lite for Low Latency
  const response = await ai.models.generateContent({
    model: MODEL_FAST,
    contents: { parts },
    config: {
      systemInstruction: REALTIME_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: liveAnalysisSchema,
      temperature: 0.3
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response");

  try {
    const result = JSON.parse(text) as LiveAnalysisResult;
    if (!result.explain_detail) result.explain_detail = [];
    if (!result.explain_teach) result.explain_teach = "";
    if (!result.follow_up_questions) result.follow_up_questions = [];
    return result;
  } catch (e) {
    console.error("Stream JSON Error", text);
    throw e;
  }
};

export const sendFollowUp = async (
  history: ChatMessage[],
  question: string,
  lastAnalysis: AnalysisResult | null
): Promise<{ text: string; groundingMetadata?: any }> => {
  const ai = getClient();
  
  let promptText = `User Question: "${question}"\n\n`;
  if (lastAnalysis) {
    promptText += `Context from previous analysis (JSON): ${JSON.stringify(lastAnalysis)}\n`;
  }
  promptText += `Answer the user question based on the context. If the user asks hypothetical questions ("What if"), provide a simulated outcome explanation and safety warnings. If the user asks about locations or external facts, use the provided tools.`;

  // Use Gemini 2.5 Flash with Grounding Tools
  const response = await ai.models.generateContent({
    model: MODEL_CHAT,
    contents: { parts: [{ text: promptText }] },
    config: {
      systemInstruction: "You are LifeLens. Answer follow-up questions. Use Google Search or Maps if relevant.",
      tools: [{ googleSearch: {} }, { googleMaps: {} }]
    }
  });

  return {
    text: response.text || "I couldn't generate a response.",
    groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
};

// Generate Speech (TTS)
export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL_TTS,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  return base64Audio;
};


// Live API Connection Helper
export const connectLiveSession = async (
  onAudioData: (base64: string) => void,
  onClose: () => void
): Promise<{ sendAudio: (blob: Blob) => void; close: () => void }> => {
  const ai = getClient();
  
  // Helper to convert float32 to pcm16
  const pcmToObj = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for(let i=0; i<bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
    return {
        mimeType: 'audio/pcm;rate=16000',
        data: btoa(binary)
    };
  };

  const sessionPromise = ai.live.connect({
    model: MODEL_LIVE,
    config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
        },
        systemInstruction: "You are LifeLens Live. Be helpful, concise, and safety-focused."
    },
    callbacks: {
        onopen: () => console.log("Live Session Opened"),
        onmessage: (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                onAudioData(audioData);
            }
        },
        onclose: () => {
            console.log("Live Session Closed");
            onClose();
        },
        onerror: (e) => console.error("Live Session Error", e)
    }
  });

  return {
    sendAudio: async (blob: Blob) => {
        // Convert blob/pcm data for sending
        // Assuming input blob is raw pcm or handled by caller to be correct format
        // For simplicity in this demo structure, we assume caller handles Worklet logic
        // and sends us raw PCM bytes or we use the prompt's recommended logic.
        // We will accept a Blob and convert it if needed, but the prompt example
        // uses direct pcm conversion in the audio processor. 
        // Here we just expose a method to send.
        
        // Actually, the best way for the caller is to just pass the PCM data object directly
        // But to keep interface simple:
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        
        const session = await sessionPromise;
        session.sendRealtimeInput({
            media: {
                mimeType: 'audio/pcm;rate=16000',
                data: base64
            }
        });
    },
    close: async () => {
        // No explicit close method on session object in types provided, 
        // usually strictly handled by closing socket, but SDK might handle it.
        // We can just stop sending.
        (await sessionPromise).close();
    }
  };
};

