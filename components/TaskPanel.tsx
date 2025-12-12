
import React, { useState, useEffect, useRef } from 'react';
import { Task, ChatMessage, HistoryItem } from '../types';

interface TaskPanelProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  chatHistory: ChatMessage[];
  onSendChat: (text: string) => void;
  isChatLoading: boolean;
  onExport: () => void;
  historyItems?: HistoryItem[]; // New prop
}

const TaskPanel: React.FC<TaskPanelProps> = ({ 
  tasks, onToggleTask, onDeleteTask, 
  chatHistory, onSendChat, isChatLoading, onExport,
  historyItems = []
}) => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'history'>('tasks');
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendChat(chatInput);
      setChatInput('');
    }
  };

  const simulateWhatIf = () => {
    onSendChat("What if I ignore the hazard identified? Simulate the outcome.");
  };

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-3 text-sm font-medium transition relative ${activeTab === 'tasks' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Tasks
          {activeTab === 'tasks' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-medium transition relative ${activeTab === 'chat' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Chat
          {activeTab === 'chat' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-sm font-medium transition relative ${activeTab === 'history' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          History
          {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 relative">
        
        {/* TASKS VIEW */}
        {activeTab === 'tasks' && (
          <div className="p-4 space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center text-slate-400 py-10 text-sm">
                No tasks yet.<br/>Analyze something to get suggestions.
              </div>
            ) : (
              tasks.map(task => (
                <div key={task.id} className="group flex items-start gap-3 p-3 bg-white rounded-lg shadow-sm border border-slate-200 transition hover:border-blue-300">
                  <input 
                    type="checkbox" 
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                      {task.text}
                    </p>
                    <div className="flex gap-2 mt-1">
                       <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                         task.priority === 'High' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-100 border-slate-200 text-slate-500'
                       }`}>
                         {task.priority}
                       </span>
                    </div>
                  </div>
                  <button onClick={() => onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1">
                    ✕
                  </button>
                </div>
              ))
            )}
             <div className="pt-4 flex justify-center">
                 <button onClick={onExport} className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                    <span>📥</span> Export Session
                 </button>
             </div>
          </div>
        )}

        {/* CHAT VIEW */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {chatHistory.length === 0 && (
                <div className="text-center text-slate-400 py-10 text-sm">
                  Ask me anything about the analysis.
                  <div className="mt-4">
                      <button 
                        onClick={simulateWhatIf}
                        className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-200 transition"
                      >
                         🔮 Simulate "What If?"
                      </button>
                  </div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 text-sm flex flex-col gap-2 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                  }`}>
                    <div>{msg.text}</div>
                    
                    {/* Grounding Metadata Display */}
                    {msg.groundingMetadata?.groundingChunks?.length && (
                        <div className="mt-2 pt-2 border-t border-slate-100/20 text-xs">
                            <strong className="opacity-70">Sources:</strong>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {msg.groundingMetadata.groundingChunks.map((chunk, idx) => {
                                    if (chunk.web) {
                                        return (
                                            <a key={idx} href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="bg-black/5 hover:bg-black/10 px-2 py-1 rounded truncate max-w-[150px] inline-flex items-center gap-1">
                                                <span>🌐</span> {chunk.web.title}
                                            </a>
                                        );
                                    }
                                    if (chunk.maps) {
                                        return (
                                            <a key={idx} href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="bg-black/5 hover:bg-black/10 px-2 py-1 rounded truncate max-w-[150px] inline-flex items-center gap-1">
                                                <span>📍</span> {chunk.maps.title}
                                            </a>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-slate-200">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask follow-up or type 'What if...'"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isChatLoading}
                />
                <button 
                  type="submit" 
                  disabled={isChatLoading || !chatInput.trim()}
                  className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isChatLoading ? '...' : '➤'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* HISTORY VIEW */}
        {activeTab === 'history' && (
            <div className="p-4 space-y-3">
                {historyItems.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 text-sm">
                        No history yet.
                    </div>
                ) : (
                    historyItems.map((item) => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 flex gap-3 shadow-sm">
                             {item.thumbnailUrl ? (
                                 <img src={item.thumbnailUrl} alt="History thumbnail" className="w-16 h-16 object-cover rounded bg-slate-100" />
                             ) : (
                                 <div className="w-16 h-16 bg-slate-100 rounded flex items-center justify-center text-xl">
                                     {item.type === 'audio' ? '🎙️' : '📄'}
                                 </div>
                             )}
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-start">
                                     <div className="text-xs text-slate-400">{item.timestamp}</div>
                                     <span className={`text-[10px] px-1.5 rounded ${item.urgency === 'High' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                         {item.urgency}
                                     </span>
                                 </div>
                                 <div className="text-sm font-medium text-slate-800 line-clamp-2 mt-1">
                                     {item.summary}
                                 </div>
                             </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default TaskPanel;
