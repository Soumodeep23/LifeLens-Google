import React, { useRef, useState } from 'react';

interface InputPanelProps {
  onMediaSelect: (files: File[], previewUrl: string) => void;
  onDemoSelect: (scenario: 'A' | 'B') => void;
  onStartLiveStream: () => void;
  onStopLiveStream: () => void;
  onStartCameraMode: () => void;
  onStartVoiceChat: () => void;
  onStopVoiceChat: () => void;
  onOpenProfile: () => void;
  onReset: () => void;
  isProcessing: boolean;
  isLiveMode: boolean;
  isCameraMode: boolean;
  isVoiceChatActive: boolean;
  hasActiveMode: boolean;
}

const InputPanel: React.FC<InputPanelProps> = ({ 
  onMediaSelect, 
  onDemoSelect, 
  onStartLiveStream, 
  onStopLiveStream,
  onStartCameraMode,
  onStartVoiceChat,
  onStopVoiceChat,
  onOpenProfile,
  onReset,
  isProcessing,
  isLiveMode,
  isCameraMode,
  isVoiceChatActive,
  hasActiveMode
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      onMediaSelect(Array.from(files), url);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], "voice_note.webm", { type: "audio/webm" });
        onMediaSelect([file], "https://cdn-icons-png.flaticon.com/512/305/305086.png"); // Simple mic icon URL
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error", err);
      alert("Could not access microphone.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-200 h-full relative">
      <div className="flex justify-between items-center">
        {hasActiveMode ? (
          <button 
            onClick={onReset}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition font-medium text-sm px-2 py-1 rounded hover:bg-slate-100"
          >
            <span>←</span> Back
          </button>
        ) : (
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="text-2xl">📷</span> Input
          </h2>
        )}
        
        <button 
          onClick={onOpenProfile}
          className="text-slate-500 hover:text-blue-600 p-2 rounded-full hover:bg-slate-100 transition"
          title="User Profile & Settings"
        >
          ⚙️
        </button>
      </div>

      {/* Main Actions - Vertically stacked on mobile, Grid on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Upload Button */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={hasActiveMode || isProcessing}
          className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 min-h-[100px]"
        >
          <span className="text-2xl mb-1">📂</span>
          <span className="text-xs font-medium text-slate-600">Upload</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*,video/*,application/pdf,audio/*"
            className="hidden" 
            multiple
          />
        </button>

        {/* Camera Button */}
        <button 
          onClick={onStartCameraMode}
          disabled={hasActiveMode || isProcessing}
          className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 min-h-[100px]"
        >
          <span className="text-2xl mb-1">📸</span>
          <span className="text-xs font-medium text-slate-600">Photo</span>
        </button>
      </div>

      {/* Microphone Button */}
      <button 
        onClick={isRecording ? stopAudioRecording : startAudioRecording}
        disabled={isLiveMode || isCameraMode || isVoiceChatActive || isProcessing || (hasActiveMode && !isRecording)}
        className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition border-2 min-h-[60px] ${
          isRecording 
            ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' 
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50'
        }`}
      >
        <span className="text-2xl">{isRecording ? '⏹' : '🎙️'}</span>
        <span className="text-sm">{isRecording ? 'Stop Recording' : 'Record Voice Note'}</span>
      </button>

       {/* Live Voice Chat Button */}
       <button 
        onClick={isVoiceChatActive ? onStopVoiceChat : onStartVoiceChat}
        disabled={isLiveMode || isRecording || isProcessing || isCameraMode || (hasActiveMode && !isVoiceChatActive)}
        className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition min-h-[60px] ${
          isVoiceChatActive 
            ? 'bg-purple-600 hover:bg-purple-700 text-white animate-pulse' 
            : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200 disabled:opacity-50'
        }`}
      >
        <span className="text-xl">{isVoiceChatActive ? '⏹' : '🗣️'}</span>
        <div className="text-left leading-tight">
             <div className="text-sm">{isVoiceChatActive ? 'End Call' : 'Start Voice Chat'}</div>
             <div className="text-[10px] opacity-80">Gemini Live API</div>
        </div>
      </button>

      {/* Live Stream Button */}
      <button 
        onClick={isLiveMode ? onStopLiveStream : onStartLiveStream}
        disabled={isRecording || isVoiceChatActive || isCameraMode || (hasActiveMode && !isLiveMode)}
        className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition min-h-[60px] ${
          isLiveMode 
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
            : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50'
        }`}
      >
        <span className="text-xl">{isLiveMode ? '⏹' : '🎥'}</span>
        <span>{isLiveMode ? 'Stop Stream' : 'Live Stream'}</span>
      </button>

      <div className="border-t border-slate-100 my-2"></div>

      {/* Demo Section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Demo Scenarios</h3>
        <div className="space-y-2">
          <button 
            onClick={() => onDemoSelect('A')}
            disabled={hasActiveMode || isProcessing}
            className="w-full text-left p-3 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-100 transition flex items-center gap-3 disabled:opacity-50"
          >
            <span className="text-xl">🔥</span>
            <div>
              <div className="font-semibold text-orange-900 text-sm">Kitchen Hazard</div>
            </div>
          </button>
          
          <button 
            onClick={() => onDemoSelect('B')}
            disabled={hasActiveMode || isProcessing}
            className="w-full text-left p-3 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-100 transition flex items-center gap-3 disabled:opacity-50"
          >
             <span className="text-xl">📝</span>
            <div>
              <div className="font-semibold text-blue-900 text-sm">Medical Form</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputPanel;
