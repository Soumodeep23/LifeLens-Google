import React, { useState, useEffect, useRef } from 'react';
import InputPanel from './components/InputPanel';
import AnalysisPanel from './components/AnalysisPanel';
import TaskPanel from './components/TaskPanel';
import { analyzeMedia, analyzeStreamFrame, sendFollowUp, generateSpeech, connectLiveSession } from './services/geminiService';
import { AnalysisResult, LiveAnalysisResult, Task, ChatMessage, UserProfile, HistoryItem, ActionInstruction } from './types';
import { DEMO_SCENARIO_A, DEMO_SCENARIO_B, KAGGLE_ASSETS } from './constants';

const DEMO_IMAGE_A = "https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=800&q=80"; // Kitchen
const DEMO_IMAGE_B = "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=800&q=80"; // Form

const App: React.FC = () => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | LiveAnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  
  // Profile State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "User",
    allergies: "",
    medications: "",
    explanationLevel: "quick",
    enableTTS: true
  });

  // Live Stream & Voice Chat State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isCameraMode, setIsCameraMode] = useState(false); // For Photo Capture
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [liveInterval, setLiveInterval] = useState(1500);
  const contextWindow = useRef<string[]>([]);
  const voiceSessionRef = useRef<{ sendAudio: (b: Blob) => void; close: () => void } | null>(null);
  
  // Audio Playback Context
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  const playAudio = async (base64Audio: string) => {
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;

        // Decode Base64 to Binary
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert Int16 PCM (Gemini Standard) to Float32 for Web Audio API
        const int16Data = new Int16Array(bytes.buffer);
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / 32768.0;
        }

        // Create Buffer (1 channel, 24kHz)
        const buffer = ctx.createBuffer(1, float32Data.length, 24000);
        buffer.getChannelData(0).set(float32Data);

        // Schedule Playback
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const currentTime = ctx.currentTime;
        // Ensure we don't schedule in the past
        if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
        }
        
        source.start(nextStartTimeRef.current);
        nextStartTimeRef.current += buffer.duration;

    } catch (e) {
        console.error("Audio playback failed", e);
    }
  };

  useEffect(() => {
    console.log("LifeLens Mounted");
    // Resume AudioContext on user interaction if needed
    const unlockAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // Update narration state based on profile preference initially
  useEffect(() => {
    setNarrationEnabled(userProfile.enableTTS);
  }, [userProfile.enableTTS]);

  // Live Visual Stream Loop (Visual Analysis)
  useEffect(() => {
    // Only run analysis loop if isLiveMode is true. 
    // isCameraMode uses liveStream but does NOT trigger this loop.
    if (!isLiveMode || !liveStream) return;

    let isActive = true;
    const offscreenVideo = document.createElement('video');
    offscreenVideo.srcObject = liveStream;
    offscreenVideo.muted = true;
    offscreenVideo.play().catch(e => console.error("Offscreen video play error", e));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const processFrame = async () => {
      if (!isActive) return;

      if (offscreenVideo.readyState >= 2 && ctx) {
        canvas.width = offscreenVideo.videoWidth || 640;
        canvas.height = offscreenVideo.videoHeight || 480;
        ctx.drawImage(offscreenVideo, 0, 0, canvas.width, canvas.height);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.6); // Compress for speed
        
        try {
          // Pass User Profile for personalization
          const result = await analyzeStreamFrame(base64Data, contextWindow.current, userProfile);
          
          if (isActive) {
            setAnalysis(result);
            
            // Update context window
            const summaryEntry = `[${new Date().toLocaleTimeString()}] ${result.summary.text}`;
            contextWindow.current = [summaryEntry, ...contextWindow.current].slice(0, 5);

            // Voice Narration using Gemini TTS
            if (narrationEnabled && result.tts_summary) {
               try {
                   const audioBase64 = await generateSpeech(result.tts_summary);
                   playAudio(audioBase64);
               } catch(e) {
                   console.error("TTS Error", e);
               }
            }
          }
        } catch (e) {
          console.warn("Frame drop/error", e);
        }
      }

      if (isActive) {
        setTimeout(processFrame, liveInterval); 
      }
    };

    const initialTimer = setTimeout(processFrame, 1000);

    return () => {
      isActive = false;
      clearTimeout(initialTimer);
      offscreenVideo.pause();
      offscreenVideo.srcObject = null;
    };
  }, [isLiveMode, liveStream, liveInterval, narrationEnabled, userProfile]);

  const startLiveStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 } } 
      });
      setLiveStream(stream);
      setIsLiveMode(true);
      setIsCameraMode(false);
      setAnalysis(null);
      setMediaUrl(null);
      contextWindow.current = [];
    } catch (err) {
      console.error(err);
      alert("Could not start live stream. Check camera permissions.");
    }
  };

  const startCameraMode = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 } } 
      });
      setLiveStream(stream);
      setIsCameraMode(true);
      setIsLiveMode(false);
      setAnalysis(null);
      setMediaUrl(null);
    } catch (err) {
      console.error(err);
      alert("Camera access denied. Please allow camera permission to capture a photo, or upload an image instead.");
    }
  };

  const stopLiveStream = () => {
    if (liveStream) {
      liveStream.getTracks().forEach(track => track.stop());
    }
    setLiveStream(null);
    setIsLiveMode(false);
    setIsCameraMode(false);
  };

  // Live Voice Chat Logic (Audio-only Live API)
  const startVoiceChat = async () => {
     if (voiceSessionRef.current) return;

     try {
         // Reset audio timing
         if (audioContextRef.current) {
             nextStartTimeRef.current = audioContextRef.current.currentTime;
         }

         setIsVoiceChatActive(true);
         setAnalysis(null);
         
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         
         // Audio Context Setup for processing
         const audioContext = new AudioContext({ sampleRate: 16000 });
         const source = audioContext.createMediaStreamSource(stream);
         const processor = audioContext.createScriptProcessor(4096, 1, 1);
         
         processor.onaudioprocess = (e) => {
             const inputData = e.inputBuffer.getChannelData(0);
             // Create PCM blob
             // This logic simplifies the data transfer to match the service requirement
             const l = inputData.length;
             const int16 = new Int16Array(l);
             for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
             }
             const blob = new Blob([int16], { type: 'audio/pcm' });
             
             if (voiceSessionRef.current) {
                 voiceSessionRef.current.sendAudio(blob);
             }
         };
         
         source.connect(processor);
         processor.connect(audioContext.destination);

         const session = await connectLiveSession(
             (audioBase64) => {
                 playAudio(audioBase64);
             },
             () => {
                 stopVoiceChat();
             }
         );
         
         voiceSessionRef.current = session;

     } catch (e) {
         console.error("Failed to start voice chat", e);
         alert("Could not start voice chat.");
         setIsVoiceChatActive(false);
     }
  };

  const stopVoiceChat = () => {
      if (voiceSessionRef.current) {
          voiceSessionRef.current.close();
          voiceSessionRef.current = null;
      }
      setIsVoiceChatActive(false);
  };

  // Reset App Function (Back Button Logic)
  const resetApp = () => {
    stopLiveStream(); // Handles live and camera modes
    stopVoiceChat();
    setMediaUrl(null);
    setAnalysis(null);
    setIsProcessing(false);
    // Note: We deliberately do NOT clear tasks, history, or user profile
  };

  const handleMediaSelect = async (files: File[], url: string) => {
    stopLiveStream(); // Ensure any active stream is stopped
    setMediaUrl(url); // Preview first image (or microphone icon if audio)
    setAnalysis(null);
    setIsProcessing(true);

    try {
      // Pass User Profile AND History Items for deep context
      const result = await analyzeMedia(files, "", undefined, userProfile, historyItems);
      setAnalysis(result);
      
      // Auto-TTS with Gemini
      if (userProfile.enableTTS && result.tts_summary) {
         try {
             const audioBase64 = await generateSpeech(result.tts_summary);
             playAudio(audioBase64);
         } catch(e) {
             console.error("TTS Failed", e);
         }
      }

      // Add to History
      const isAudio = files[0].type.startsWith('audio');
      const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          type: isAudio ? 'audio' : 'image',
          summary: result.summary.text,
          urgency: result.urgency,
          thumbnailUrl: isAudio ? undefined : url
      };
      setHistoryItems(prev => [newHistoryItem, ...prev]);

      setIsProcessing(false);
    } catch (err) {
      console.error(err);
      alert("Analysis failed. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleCapturePhoto = (file: File, url: string) => {
    handleMediaSelect([file], url);
  };

  const handleDemoSelect = (scenario: 'A' | 'B') => {
    stopLiveStream();
    setIsProcessing(true);
    setAnalysis(null);
    setTimeout(() => {
      if (scenario === 'A') {
        setMediaUrl(DEMO_IMAGE_A);
        setAnalysis(DEMO_SCENARIO_A);
      } else {
        setMediaUrl(DEMO_IMAGE_B);
        setAnalysis(DEMO_SCENARIO_B);
      }
      setIsProcessing(false);
    }, 1500);
  };

  const addTask = (text: string, priority: "High" | "Medium" | "Low" = 'Medium', dueDate?: string) => {
    const newTask: Task = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      completed: false,
      priority,
      dueDate
    };
    setTasks(prev => [...prev, newTask]);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Action Executor Logic
  const handleActionExecution = (instruction: ActionInstruction) => {
    if (instruction.type === 'create_task' && instruction.text) {
      addTask(instruction.text, 'Medium', instruction.due_date);
    } else if (instruction.type === 'prefill_form' && instruction.field_id && instruction.value) {
      const field = instruction.field_id.toLowerCase();
      // Only allow updates to known profile fields for safety/demo purposes
      if (['name', 'allergies', 'medications'].includes(field)) {
          setUserProfile(prev => ({...prev, [field]: instruction.value!}));
          alert(`✅ Profile Updated: Set ${field} to "${instruction.value}"`);
      } else {
          // Fallback for unknown fields: Create a task
          addTask(`Fill form field '${instruction.field_id}' with '${instruction.value}'`, 'Medium');
      }
    }
  };

  const handleChat = async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const result = await sendFollowUp(chatHistory, text, analysis as AnalysisResult);
      const modelMsg: ChatMessage = { 
          role: 'model', 
          text: result.text, 
          timestamp: Date.now(),
          groundingMetadata: result.groundingMetadata
      };
      setChatHistory(prev => [...prev, modelMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = { role: 'model', text: "Sorry, I encountered an error.", timestamp: Date.now() };
      setChatHistory(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExport = () => {
    const data = {
      timestamp: new Date().toISOString(),
      userProfile,
      analysis,
      tasks,
      chatHistory,
      historyItems
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifelens_session.json';
    a.click();
  };

  const hasActiveMode = !!(mediaUrl || isLiveMode || isCameraMode || isVoiceChatActive);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shadow-sm z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">L</div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">LifeLens</h1>
          {isLiveMode && (
             <span className="flex items-center gap-1 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span> LIVE
             </span>
          )}
          {isCameraMode && (
             <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">
                <span>📸</span> CAM
             </span>
          )}
          {isVoiceChatActive && (
             <span className="flex items-center gap-1 bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                <span className="w-2 h-2 bg-purple-600 rounded-full"></span> VOICE
             </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
            {isLiveMode && (
              <div className="hidden sm:flex items-center gap-2 mr-4 bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setNarrationEnabled(!narrationEnabled)}
                  className={`text-xs px-2 py-1 rounded transition ${narrationEnabled ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                >
                  {narrationEnabled ? '🔊' : '🔇'}
                </button>
                <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>
                <select 
                  value={liveInterval}
                  onChange={(e) => setLiveInterval(Number(e.target.value))}
                  className="text-xs bg-transparent border-none text-slate-600 focus:ring-0"
                >
                  <option value={500}>0.5s</option>
                  <option value={1500}>1.5s</option>
                  <option value={3000}>3.0s</option>
                </select>
              </div>
            )}
            <button onClick={() => setShowPublishModal(true)} className="text-sm text-slate-600 hover:text-blue-600 font-medium whitespace-nowrap">
                Publish
            </button>
        </div>
      </header>

      {/* Main Grid - Responsive Layout */}
      {/* Mobile: Vertical Stack with Scroll | Desktop: Fixed Grid with Internal Scroll */}
      <main className="flex-1 overflow-y-auto md:overflow-hidden p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">
        
        {/* Left: Input */}
        {/* Mobile: Top Section */}
        <div className="md:col-span-3 flex-shrink-0">
          <InputPanel 
            onMediaSelect={handleMediaSelect} 
            onDemoSelect={handleDemoSelect} 
            onStartLiveStream={startLiveStream}
            onStopLiveStream={stopLiveStream}
            onStartCameraMode={startCameraMode}
            onStartVoiceChat={startVoiceChat}
            onStopVoiceChat={stopVoiceChat}
            onOpenProfile={() => setShowProfileModal(true)}
            onReset={resetApp}
            isProcessing={isProcessing}
            isLiveMode={isLiveMode}
            isCameraMode={isCameraMode}
            isVoiceChatActive={isVoiceChatActive}
            hasActiveMode={hasActiveMode}
          />
        </div>

        {/* Center: Analysis */}
        {/* Mobile: Middle Section */}
        <div className="md:col-span-5 h-[500px] md:h-full overflow-hidden flex flex-col">
          <AnalysisPanel 
            mediaUrl={mediaUrl} 
            analysis={analysis} 
            isLoading={isProcessing} 
            onAddTask={addTask}
            onExecuteAction={handleActionExecution}
            isLiveMode={isLiveMode}
            isCameraMode={isCameraMode}
            liveStream={liveStream}
            onCapturePhoto={handleCapturePhoto}
          />
        </div>

        {/* Right: Tasks & Chat */}
        {/* Mobile: Bottom Section */}
        <div className="md:col-span-4 h-[600px] md:h-full overflow-hidden flex flex-col">
          <TaskPanel 
            tasks={tasks}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            chatHistory={chatHistory}
            onSendChat={handleChat}
            isChatLoading={isChatLoading}
            onExport={handleExport}
            historyItems={historyItems}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-2 text-center text-[10px] text-slate-400 flex-shrink-0">
        LifeLens is an AI assistant. Call 911 for emergencies.
      </footer>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl text-slate-900">
             <h2 className="text-xl font-bold mb-4">Personal Profile</h2>
             <div className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-slate-700">Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-white text-black border border-gray-300 rounded-md p-2 mt-1 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition-colors" 
                    value={userProfile.name} 
                    onChange={e => setUserProfile({...userProfile, name: e.target.value})} 
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700">Allergies</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Penicillin, Peanuts" 
                    className="w-full bg-white text-black border border-gray-300 rounded-md p-2 mt-1 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition-colors" 
                    value={userProfile.allergies} 
                    onChange={e => setUserProfile({...userProfile, allergies: e.target.value})} 
                  />
               </div>
               <div>
                  <label className="block text-sm font-medium text-slate-700">Medications</label>
                  <textarea 
                    placeholder="e.g. Metformin 500mg (Evening)" 
                    className="w-full bg-white text-black border border-gray-300 rounded-md p-2 mt-1 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition-colors h-24 resize-none" 
                    value={userProfile.medications} 
                    onChange={e => setUserProfile({...userProfile, medications: e.target.value})} 
                  />
               </div>
               <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-700">Enable Voice Narration</label>
                  <input 
                    type="checkbox" 
                    checked={userProfile.enableTTS} 
                    onChange={e => setUserProfile({...userProfile, enableTTS: e.target.checked})} 
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                  />
               </div>
             </div>
             <div className="mt-6 flex justify-end">
                <button onClick={() => setShowProfileModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Save Profile</button>
             </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
             <h2 className="text-xl font-bold mb-4">Publishing Your App</h2>
             <div className="space-y-4 text-sm text-slate-700">
                <p>1. Click the <b>"Share"</b> button in the top right.</p>
                <p>2. Select <b>"Publish your app"</b>.</p>
                <p>3. Copy the generated public URL.</p>
                <div className="bg-slate-100 p-3 rounded text-xs font-mono overflow-auto max-h-32">
                   {KAGGLE_ASSETS.description}
                </div>
             </div>
             <div className="mt-6 flex justify-end">
                <button onClick={() => setShowPublishModal(false)} className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700">Close</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
