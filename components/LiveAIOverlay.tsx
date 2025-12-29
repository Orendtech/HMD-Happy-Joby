
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Loader2, Sparkles, TrendingUp, Target, AlertCircle, Key, Link as LinkIcon } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { User } from 'firebase/auth';
import { getUserProfile, getTodayAttendance, getReminders, getTodayDateId, addReminder, addInteractionByAi, finalizeCheckoutByAi } from '../services/dbService';

interface Props {
    user: User;
}

// Global declaration for AI Studio environment methods
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fix: Removed readonly to ensure compatibility with identical modifier requirements in interface merging
    aistudio: AIStudio;
  }
}

// Audio Utilities
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

export const LiveAIOverlay: React.FC<Props> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [needKeySelection, setNeedKeySelection] = useState(false);
    
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const sessionRef = useRef<any>(null);
    const audioContexts = useRef<{ input?: AudioContext, output?: AudioContext }>({});
    const nextStartTimeRef = useRef(0);
    const activeSources = useRef(new Set<AudioBufferSourceNode>());

    const toggleAI = async () => {
        if (isOpen) {
            stopSession();
            setIsOpen(false);
            setErrorMsg(null);
        } else {
            setIsOpen(true);
            setErrorMsg(null);
            checkKeyAndStart();
        }
    };

    const checkKeyAndStart = async () => {
        setIsConnecting(true);
        try {
            // Step 1: Check if environment already has a selected key (PWA/Browser memory)
            if (window.aistudio) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    setNeedKeySelection(true);
                    setIsConnecting(false);
                    return;
                }
            }
            setNeedKeySelection(false);
            startSession();
        } catch (e) {
            // Fallback to normal start if aistudio helper is missing
            startSession();
        }
    };

    const handleSelectKey = async () => {
        try {
            if (window.aistudio) {
                await window.aistudio.openSelectKey();
                // Rule: Proceed immediately after trigger
                setNeedKeySelection(false);
                startSession();
            }
        } catch (e) {
            setErrorMsg("Could not open Key Selector");
        }
    };

    const stopSession = () => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
        activeSources.current.clear();
        if (audioContexts.current.input) try { audioContexts.current.input.close(); } catch(e){}
        if (audioContexts.current.output) try { audioContexts.current.output.close(); } catch(e){}
        audioContexts.current = {};
        setIsListening(false);
        setIsSpeaking(false);
        setIsConnecting(false);
    };

    const startSession = async () => {
        setIsConnecting(true);
        setErrorMsg(null);
        
        try {
            // Check microphone permission
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (micError: any) {
                throw new Error("กรุณาอนุญาตสิทธิ์การใช้ไมโครโฟน เพื่อเริ่มการสนทนา");
            }

            const profile = await getUserProfile(user.uid);
            const todayAttendance = await getTodayAttendance(user.uid);
            const reminders = await getReminders(user.uid);

            const systemInstruction = `
                คุณคือ "Happy Joby Elite Coach" เลขาส่วนตัวอัจฉริยะ
                หน้าที่: วิเคราะห์ดีลการขาย, บันทึกรายงาน, ทำนัดหมาย
                บริบท: ${profile?.name || user.email}, เขต: ${profile?.area || 'N/A'}
                เวลา: ${new Date().toLocaleTimeString('th-TH')}
            `;

            // Create fresh instance per rules
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const outputCtx = new AudioContextClass({ sampleRate: 24000 });
            audioContexts.current = { input: inputCtx, output: outputCtx };

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsListening(true);
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(s => s?.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputCtx) {
                            setIsSpeaking(true);
                            if (outputCtx.state === 'suspended') await outputCtx.resume();
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => {
                                activeSources.current.delete(source);
                                if (activeSources.current.size === 0) setIsSpeaking(false);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            activeSources.current.add(source);
                        }
                    },
                    onerror: (e: any) => { 
                        const msg = e?.message || "";
                        if (msg.includes("API Key must be set") || msg.includes("Requested entity was not found")) {
                            setNeedKeySelection(true);
                        } else {
                            setErrorMsg("เชื่อมต่อไม่สำเร็จ: " + msg); 
                        }
                        stopSession(); 
                    },
                    onclose: () => { if (!errorMsg) stopSession(); }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) {
            if (error.message.includes("API Key must be set")) {
                setNeedKeySelection(true);
            } else {
                setErrorMsg(error.message);
            }
            setIsConnecting(false);
        }
    };

    // Drag Logic
    const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragOffset.current = { x: clientX - position.x, y: clientY - position.y };
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            const newX = Math.max(20, Math.min(window.innerWidth - 80, clientX - dragOffset.current.x));
            const newY = Math.max(20, Math.min(window.innerHeight - 80, clientY - dragOffset.current.y));
            setPosition({ x: newX, y: newY });
        };
        const onMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchmove', onMouseMove);
            window.addEventListener('touchend', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDragging]);

    return (
        <>
            <div 
                className={`fixed z-[1000] cursor-grab active:cursor-grabbing transition-transform ${isDragging ? '' : 'duration-300'}`}
                style={{ left: position.x, top: position.y }}
                onMouseDown={onMouseDown}
                onTouchStart={onMouseDown}
            >
                <button 
                    onClick={toggleAI}
                    className={`group relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 overflow-hidden
                        ${isOpen ? 'bg-rose-500 border-white/30 scale-90' : 'bg-slate-900 border-cyan-500/50 hover:scale-110'}
                    `}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 animate-pulse"></div>
                    {isOpen ? <X className="text-white" size={28} /> : <Bot className="text-cyan-400 group-hover:text-white transition-colors" size={32} />}
                    {!isOpen && <div className="absolute inset-[-4px] border border-cyan-500/30 rounded-full animate-ping pointer-events-none"></div>}
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#020617]/98 backdrop-blur-3xl flex flex-col animate-enter p-8 text-white">
                    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center space-y-12">
                        <div className="flex flex-col items-center space-y-4 text-center">
                            <div className="relative mb-4">
                                <div className={`absolute -inset-12 bg-cyan-500/20 rounded-full blur-[60px] transition-all duration-700 ${isSpeaking ? 'scale-150 opacity-60' : 'scale-100 opacity-20'}`}></div>
                                <div className={`w-32 h-32 rounded-[40px] bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/10 flex items-center justify-center relative shadow-2xl ${isSpeaking ? 'animate-pulse' : ''}`}>
                                    <Bot size={64} className={`${isSpeaking ? 'text-cyan-400' : 'text-slate-400'} transition-colors duration-500`} />
                                    {isConnecting && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-[40px]"><Loader2 className="animate-spin text-white" size={40} /></div>}
                                    {(errorMsg || needKeySelection) && <div className="absolute -bottom-2 -right-2 bg-rose-500 p-2 rounded-full border-4 border-slate-900"><AlertCircle size={20} className="text-white" /></div>}
                                </div>
                            </div>
                            <h2 className="text-3xl font-black tracking-tighter">Happy Joby AI</h2>
                            <p className={`font-bold text-xs uppercase tracking-[0.3em] ${errorMsg || needKeySelection ? 'text-rose-400' : 'text-slate-400'}`}>
                                {needKeySelection ? 'Identity Link Required' : errorMsg ? 'Connection Blocked' : isConnecting ? 'Initializing Intelligence...' : isSpeaking ? 'Coach is Speaking' : 'Waiting for voice command'}
                            </p>
                        </div>

                        {needKeySelection ? (
                            <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] text-center max-w-sm space-y-8 animate-enter">
                                <div className="flex justify-center"><div className="p-5 bg-indigo-500/10 rounded-3xl"><LinkIcon className="text-indigo-400" size={32} /></div></div>
                                <div className="space-y-2">
                                    <p className="text-slate-200 font-bold text-lg">เชื่อมต่อบริการ AI</p>
                                    <p className="text-slate-500 text-sm leading-relaxed">ตรวจไม่พบ API Key ในโหมด PWA กรุณากดปุ่มด้านล่างเพื่อเลือก Key ของคุณและเริ่มใช้งาน</p>
                                </div>
                                <button 
                                    onClick={handleSelectKey}
                                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <Key size={18} /> Connect API Key
                                </button>
                                <p className="text-[10px] text-slate-600 italic">* ระบบจะจดจำสิทธิ์นี้ไว้ในเครื่องของคุณอย่างปลอดภัย</p>
                            </div>
                        ) : errorMsg ? (
                            <div className="bg-rose-500/10 border border-rose-500/30 p-8 rounded-[40px] text-center max-w-sm space-y-6">
                                <p className="text-rose-400 text-sm font-medium leading-relaxed font-bold">{errorMsg}</p>
                                <button onClick={checkKeyAndStart} className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95">Retry Link</button>
                            </div>
                        ) : (
                            <div className="h-32 flex items-center justify-center gap-2 w-full">
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <div key={i} className={`w-2 bg-gradient-to-t from-cyan-600 to-blue-400 rounded-full transition-all duration-300 ${isSpeaking ? 'animate-bounce' : isListening ? 'opacity-40' : 'opacity-10'}`} style={{ height: isSpeaking ? `${30 + Math.random() * 70}%` : '12px', animationDelay: `${i * 0.08}s` }}></div>
                                ))}
                            </div>
                        )}

                        {!needKeySelection && !errorMsg && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                                <div className="bg-white/5 border border-white/10 p-5 rounded-[28px] flex items-center gap-4">
                                    <Target className="text-cyan-500" size={24} />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Portfolio</div>
                                        <div className="text-xs font-bold truncate">วิเคราะห์ดีลการขาย</div>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-5 rounded-[28px] flex items-center gap-4">
                                    <TrendingUp className="text-amber-500" size={24} />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Reports</div>
                                        <div className="text-xs font-bold truncate">สรุปรายงานประจำวัน</div>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-5 rounded-[28px] flex items-center gap-4">
                                    <Sparkles className="text-emerald-500" size={24} />
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Elite Coach</div>
                                        <div className="text-xs font-bold truncate">ปรึกษาแผนงาน</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-auto flex justify-center py-10">
                        <button onClick={toggleAI} className="bg-white/10 hover:bg-white/20 px-10 py-5 rounded-[24px] border border-white/10 font-black text-xs uppercase tracking-[0.2em] transition-all">End Session</button>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{ __html: `@keyframes bounce { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.6); } }` }} />
        </>
    );
};