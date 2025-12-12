import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult, LiveAnalysisResult, Finding, FindingCategory, ActionInstruction } from '../types';

interface AnalysisPanelProps {
  mediaUrl: string | null;
  analysis: AnalysisResult | LiveAnalysisResult | null;
  isLoading: boolean;
  onAddTask: (text: string, priority?: "High" | "Medium" | "Low", dueDate?: string) => void;
  onExecuteAction: (action: ActionInstruction) => void;
  isLiveMode: boolean;
  isCameraMode: boolean;
  liveStream: MediaStream | null;
  onCapturePhoto: (file: File, url: string) => void;
}

const getCategoryColor = (category: FindingCategory) => {
  switch (category) {
    case 'hazard': return 'border-red-500 bg-red-500/20';
    case 'task': return 'border-yellow-500 bg-yellow-500/20';
    case 'form-field': return 'border-yellow-400 bg-yellow-400/20';
    case 'medication': return 'border-purple-500 bg-purple-500/20';
    case 'info': return 'border-blue-500 bg-blue-500/20';
    default: return 'border-slate-500 bg-slate-500/20';
  }
};

const getCategoryBadge = (category: FindingCategory) => {
  switch (category) {
    case 'hazard': return 'bg-red-100 text-red-700';
    case 'task': return 'bg-yellow-100 text-yellow-800';
    case 'medication': return 'bg-purple-100 text-purple-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  mediaUrl, 
  analysis, 
  isLoading, 
  onAddTask,
  onExecuteAction,
  isLiveMode,
  isCameraMode,
  liveStream,
  onCapturePhoto
}) => {
  const [explanationLevel, setExplanationLevel] = useState<'quick' | 'explain' | 'teach'>('quick');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showExplanations, setShowExplanations] = useState(true);
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-play live stream or camera feed
  useEffect(() => {
    if ((isLiveMode || isCameraMode) && liveStream && liveVideoRef.current) {
      liveVideoRef.current.srcObject = liveStream;
      liveVideoRef.current.play().catch(e => console.error("Auto-play failed", e));
    }
  }, [isLiveMode, isCameraMode, liveStream]);

  const handleCapture = () => {
    if (liveVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = liveVideoRef.current.videoWidth;
      canvas.height = liveVideoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(liveVideoRef.current, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          const url = URL.createObjectURL(file);
          onCapturePhoto(file, url);
        }
      }, 'image/jpeg');
    }
  };

  const isLiveResult = (a: any): a is LiveAnalysisResult => {
    return !!a && 'changes_since_last_frame' in a;
  };

  if (isLoading && !isLiveMode && !isCameraMode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl border border-slate-200 min-h-[300px]">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h3 className="text-lg font-semibold text-slate-700">Analyzing Scene...</h3>
        <p className="text-slate-500 text-sm mt-2">Checking for hazards, handwriting, voice tone, and tasks.</p>
      </div>
    );
  }

  if (!mediaUrl && !isLiveMode && !isCameraMode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 min-h-[300px]">
        <span className="text-4xl mb-4 text-slate-300">👁️</span>
        <p className="text-slate-400">Upload an image, audio, or start a live stream.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Media Preview Area */}
      <div className="relative bg-black w-full aspect-video md:h-80 flex-shrink-0 flex items-center justify-center overflow-hidden group">
        
        {isLiveMode || isCameraMode ? (
          <>
            <video 
              ref={liveVideoRef} 
              className="w-full h-full object-cover transform scale-x-[-1]" 
              muted 
              playsInline
            />
            
            {isLiveMode && (
                <>
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse flex items-center gap-1 z-10">
                        <span className="w-2 h-2 bg-white rounded-full"></span> LIVE
                    </div>
                    {/* Toggle Overlay in Live Mode */}
                    <div className="absolute top-2 right-2 z-10">
                        <button 
                            onClick={() => setShowExplanations(!showExplanations)}
                            className="bg-black/50 text-white text-xs px-2 py-1 rounded hover:bg-black/70"
                        >
                            {showExplanations ? 'Hide Overlay' : 'Show Overlay'}
                        </button>
                    </div>
                </>
            )}

            {isCameraMode && (
                 <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20">
                     <button 
                        onClick={handleCapture}
                        className="w-16 h-16 rounded-full bg-white border-4 border-slate-200 flex items-center justify-center shadow-lg hover:scale-105 transition active:scale-95"
                        aria-label="Capture Photo"
                     >
                        <div className="w-12 h-12 rounded-full bg-red-500"></div>
                     </button>
                 </div>
            )}
          </>
        ) : (
          <img 
            src={mediaUrl!} 
            alt="Analysis Target" 
            className="w-full h-full object-contain" 
            onError={(e) => {
               // Fallback for audio files which don't have a visual preview
               e.currentTarget.style.display = 'none';
               e.currentTarget.parentElement!.innerHTML = `<div class="text-white flex flex-col items-center gap-2"><span class="text-6xl">🎙️</span><span class="text-sm text-slate-400">Audio Analysis</span></div>`;
            }}
          />
        )}
        
        {/* Bounding Boxes Overlay - Visual Explainability (Not for Camera Mode) */}
        {!isCameraMode && showExplanations && analysis?.findings.map((finding) => (
          finding.bbox && (
            <div
              key={finding.id}
              className={`absolute border-2 transition-all cursor-pointer ${getCategoryColor(finding.category)} ${selectedFindingId === finding.id ? 'z-20 border-white' : ''}`}
              style={{
                top: `${finding.bbox.ymin / 10}%`,
                left: isLiveMode ? `${100 - (finding.bbox.xmax / 10)}%` : `${finding.bbox.xmin / 10}%`,
                width: `${(finding.bbox.xmax - finding.bbox.xmin) / 10}%`,
                height: `${(finding.bbox.ymax - finding.bbox.ymin) / 10}%`,
              }}
              onClick={() => setSelectedFindingId(finding.id)}
            >
              <span className={`absolute -top-6 ${isLiveMode ? 'right-0' : 'left-0'} bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded truncate max-w-full flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${finding.category === 'hazard' ? 'bg-red-500' : 'bg-blue-400'}`}></span>
                {finding.label} ({Math.round(finding.confidence)}%)
              </span>
            </div>
          )
        ))}
      </div>

      {/* Analysis Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {analysis ? (
          <>
            {/* Summary & Live Timeline */}
            <div className={`p-4 rounded-lg border-l-4 ${
              analysis.urgency === 'High' ? 'bg-red-50 border-red-500' :
              analysis.urgency === 'Medium' ? 'bg-orange-50 border-orange-500' :
              'bg-green-50 border-green-500'
            }`}>
               <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide mb-2 ${
                      analysis.urgency === 'High' ? 'bg-red-200 text-red-800' :
                      analysis.urgency === 'Medium' ? 'bg-orange-200 text-orange-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {analysis.urgency} Urgency
                    </span>
                    <h2 className="text-lg font-bold text-slate-800 leading-tight">{analysis.summary.text}</h2>
                    
                    {/* Live Mode Updates */}
                    {isLiveResult(analysis) && (
                      <div className="mt-3 space-y-1">
                        {analysis.new_findings.length > 0 && (
                            <div className="text-xs text-green-700 bg-green-50 p-1 rounded">
                                <strong>+ New:</strong> {analysis.new_findings.join(", ")}
                            </div>
                        )}
                         {analysis.resolved_findings.length > 0 && (
                            <div className="text-xs text-slate-500 bg-slate-100 p-1 rounded">
                                <strong>✔ Resolved:</strong> {analysis.resolved_findings.join(", ")}
                            </div>
                        )}
                        {analysis.changes_since_last_frame && (
                           <div className="text-sm text-slate-600 bg-white/60 p-2 rounded italic">
                             "{analysis.changes_since_last_frame}"
                           </div>
                        )}
                      </div>
                    )}

                    {/* Handwriting Badge */}
                    {analysis.handwriting_detected && (
                         <div className="mt-2 text-xs bg-indigo-100 text-indigo-700 inline-block px-2 py-1 rounded">
                            ✍ Handwriting Detected
                         </div>
                    )}
               </div>
            </div>

            {/* Action Instructions (Action Executor) */}
            {analysis.action_instructions && analysis.action_instructions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 shadow-sm">
                     <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <span>⚡</span> Suggested Automations
                     </h3>
                     <div className="space-y-2">
                         {analysis.action_instructions.map((inst, i) => (
                             <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-2 rounded border border-amber-100 shadow-sm gap-2">
                                 <div className="flex-1">
                                    <span className="text-sm text-amber-900 font-medium block">
                                        {inst.type === 'create_task' && "Add Task"}
                                        {inst.type === 'prefill_form' && "Update Profile"}
                                        {inst.type === 'highlight' && "Highlight Info"}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {inst.type === 'create_task' && inst.text}
                                        {inst.type === 'prefill_form' && `Set ${inst.field_id} to "${inst.value}"`}
                                        {inst.type === 'highlight' && `Found: ${inst.object_id}`}
                                    </span>
                                 </div>
                                 <button 
                                    onClick={() => onExecuteAction(inst)}
                                    className={`text-xs px-3 py-1.5 rounded font-medium transition whitespace-nowrap ${
                                        inst.type === 'prefill_form' 
                                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                                            : 'bg-amber-200 text-amber-900 hover:bg-amber-300'
                                    }`}
                                 >
                                    {inst.type === 'prefill_form' ? 'Apply Update' : 'Execute'}
                                 </button>
                             </div>
                         ))}
                     </div>
                </div>
            )}

            {/* Voice Emotion Analysis */}
            {analysis.emotion && (
                <div className="bg-fuchsia-50 border-l-4 border-fuchsia-400 p-4 rounded-r-lg shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🎙️</span>
                        <h3 className="text-sm font-bold text-fuchsia-900 uppercase tracking-wide">Voice Analysis Detected</h3>
                        <span className="text-xs px-2 py-0.5 bg-white text-fuchsia-700 border border-fuchsia-200 rounded-full font-bold capitalize shadow-sm">
                            {analysis.emotion}
                        </span>
                    </div>
                    <p className="text-sm text-fuchsia-800 ml-7">
                        <span className="font-semibold">Adaptation:</span> {analysis.response_adaptation}
                    </p>
                </div>
            )}

            {/* Handwriting Extraction Section */}
            {analysis.handwriting_items && analysis.handwriting_items.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <span className="text-6xl">✍️</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-2">
                           <span>📝</span> Handwriting Understanding Mode
                        </h3>
                        <button 
                            onClick={() => {
                                analysis.handwriting_items?.forEach(item => {
                                    onAddTask(item.text, item.priority, item.due_date_suggestion);
                                });
                            }}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded shadow-sm transition flex items-center gap-1"
                        >
                            <span>+</span> Add All Tasks
                        </button>
                    </div>
                    
                    <div className="space-y-2 relative z-10">
                        {analysis.handwriting_items.map((item, i) => (
                             <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded border border-indigo-100 shadow-sm gap-2">
                                <div className="flex-1">
                                    <div className="italic font-serif text-slate-800 text-lg leading-snug">"{item.text}"</div>
                                    {item.due_date_suggestion && (
                                        <div className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                                            <span>🗓</span> Due: {item.due_date_suggestion}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                                        item.priority === 'High' ? 'bg-red-50 text-red-600 border-red-100' : 
                                        item.priority === 'Medium' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 
                                        'bg-slate-50 text-slate-500 border-slate-100'
                                    }`}>
                                        {item.priority}
                                    </span>
                                    <button 
                                        onClick={() => onAddTask(item.text, item.priority, item.due_date_suggestion)}
                                        className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1.5 rounded transition border border-indigo-200"
                                    >
                                        + Add
                                    </button>
                                </div>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Explanation Toggle */}
            {!isLiveMode && (
              <div>
                 <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg inline-flex mb-2 flex-wrap">
                    {(['quick', 'explain', 'teach'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setExplanationLevel(level)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition capitalize ${explanationLevel === level ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {level}
                      </button>
                    ))}
                 </div>
                 <div className="text-slate-700 bg-slate-50 p-3 rounded-lg text-sm border border-slate-100">
                    {explanationLevel === 'quick' && <p>{analysis.explain_quick}</p>}
                    {explanationLevel === 'explain' && (
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.explain_detail.map((pt, i) => <li key={i}>{pt}</li>)}
                      </ul>
                    )}
                    {explanationLevel === 'teach' && <p className="leading-relaxed">{analysis.explain_teach}</p>}
                 </div>
              </div>
            )}

            {/* Actions Grid */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Recommended Actions</h3>
              <div className="grid gap-2">
                {analysis.actions.map((action, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition group">
                    <div className="flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full ${action.priority === 'High' ? 'bg-red-500' : action.priority === 'Medium' ? 'bg-orange-400' : 'bg-green-400'}`}></div>
                       <div>
                         <div className="text-sm font-medium text-slate-800">{action.text}</div>
                         <div className="text-xs text-slate-500 capitalize">{action.type} • ~{action.estimated_time_min} min</div>
                       </div>
                    </div>
                    <button 
                      onClick={() => onAddTask(action.text)}
                      className="text-xs bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded transition whitespace-nowrap"
                    >
                      + Task
                    </button>
                  </div>
                ))}
              </div>
            </div>

             {/* Findings Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">
                {isLiveMode ? "Live Objects Detected" : "Detailed Findings"}
              </h3>
              <div className="space-y-2">
                 {analysis.findings.map((finding) => (
                   <div 
                    key={finding.id} 
                    className={`p-3 rounded-lg border text-sm transition ${selectedFindingId === finding.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}
                    onMouseEnter={() => setSelectedFindingId(finding.id)}
                    onMouseLeave={() => setSelectedFindingId(null)}
                   >
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 rounded ${getCategoryBadge(finding.category)}`}>
                                {finding.category}
                            </span>
                            <span className="font-semibold text-slate-700">{finding.label}</span>
                        </div>
                        <span className="text-xs text-slate-400">{Math.round(finding.confidence)}%</span>
                      </div>
                      {finding.ocr_text && (
                        <div className="font-mono text-xs bg-slate-100 p-1.5 rounded text-slate-600 mb-1">
                          "{finding.ocr_text}"
                        </div>
                      )}
                   </div>
                 ))}
                 {analysis.findings.length === 0 && (
                   <div className="text-slate-400 italic text-sm">Scanning...</div>
                 )}
              </div>
            </div>
          </>
        ) : (
          isLiveMode && (
            <div className="text-center text-slate-400 py-10">
              <p>Initializing stream analysis...</p>
            </div>
          )
        )}
        
        {isCameraMode && !analysis && (
            <div className="text-center text-slate-400 py-10">
                <p>Press the red button to capture a photo.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
