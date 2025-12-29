
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bot, X, Mic, MicOff, Waves, Move, Loader2, Sparkles, TrendingUp, Target, Calendar, AlertCircle } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { User } from 'firebase/auth';
import { UserProfile, AttendanceDay, Reminder, WorkPlan } from '../types';
import { getUserProfile, getTodayAttendance, getReminders, getWorkPlans, getTodayDateId } from '../services/dbService';

interface Props {
    user: User;
}

// Audio Utilities as per @google/genai coding guidelines
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
    
    // Position state for floating button
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // AI Context Ref
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
            startSession();
        }
    };

    const stopSession = () => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
        activeSources.current.clear();
        
        if (audioContexts.current.input) {
            try { audioContexts.current.input.close(); } catch (e) {}
        }
        if (audioContexts.current.output) {
            try { audioContexts.current.output.close(); } catch (e) {}
        }
        
        audioContexts.current = {};
        setIsListening(false);
        setIsSpeaking(false);
        setIsConnecting(false);
    };

    const startSession = async () => {
        setIsConnecting(true);
        try {
            // 1. Check for Microphone Permission early
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (micError: any) {
                console.error("Microphone Error:", micError);
                throw new Error("ไมโครโฟนถูกปฏิเสธสิทธิ์การเข้าถึง หรือไม่พบอุปกรณ์ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์");
            }

            // 2. Fetch current app data for context
            const profile = await getUserProfile(user.uid);
            const todayAttendance = await getTodayAttendance(user.uid);
            const reminders = await getReminders(user.uid);
            const workplans = await getWorkPlans(user.uid);
            const todayStr = getTodayDateId();
            const todayPlan = workplans.find(p => p.date === todayStr);

            const contextData = `
                User Profile: ${profile?.name || user.email}, Area: ${profile?.area || 'N/A'}, Level: ${profile?.level}
                Today's Attendance: ${todayAttendance?.checkIns.length || 0} locations visited.
                Today's Plan: ${todayPlan ? `Title: ${todayPlan.title}, Itinerary: ${todayPlan.itinerary.map(i => i.location).join(', ')}` : 'No plan submitted yet.'}
                Active Pipeline Deals: ${profile?.activePipeline?.length || 0} deals. 
                Recent Reminders: ${reminders.slice(0, 3).map(r => r.title).join(', ')}.
            `;

            const systemInstruction = `
                You are "Happy Joby Sales Coach", an elite sales mentor AI. 
                Your goal is to help the user close more deals and manage their time perfectly.
                Be encouraging, sharp, and strategic. 
                
                CURRENT USER CONTEXT:
                ${contextData}

                When the user asks "What should I do today?", look at their plan and pipeline.
                If they have a deal in "Proposal", suggest follow-up tactics.
                If they haven't checked in yet, remind them to start their day.
                Talk naturally as a friend and a high-level manager. 
                Keep responses concise since this is a voice conversation.
            `;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // 3. Setup Audio Contexts (Using local variables to avoid closure issues)
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error("เบราว์เซอร์ของคุณไม่รองรับการประมวลผลเสียง (Web Audio API)");
            }

            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const outputCtx = new AudioContextClass({ sampleRate: 24000 });
            audioContexts.current = { input: inputCtx, output: outputCtx };
            
            const outputNode = outputCtx.createGain();
            outputNode.connect(outputCtx.destination);

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsListening(true);
                        
                        try {
                            const source = inputCtx.createMediaStreamSource(stream);
                            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                            
                            scriptProcessor.onaudioprocess = (e) => {
                                const inputData = e.inputBuffer.getChannelData(0);
                                const pcmBlob = createBlob(inputData);
                                sessionPromise.then((session) => {
                                    if (session) {
                                        session.sendRealtimeInput({ media: pcmBlob });
                                    }
                                }).catch(err => console.debug("Failed to send audio input", err));
                            };
                            
                            source.connect(scriptProcessor);
                            scriptProcessor.connect(inputCtx.destination);
                        } catch (err) {
                            console.error("Failed to setup audio input stream:", err);
                            setErrorMsg("ไม่สามารถตั้งค่าระบบบันทึกเสียงได้");
                            stopSession();
                        }
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputCtx) {
                            setIsSpeaking(true);
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            
                            try {
                                const audioBuffer = await decodeAudioData(
                                    decode(base64Audio),
                                    outputCtx,
                                    24000,
                                    1
                                );
                                
                                const source = outputCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputNode);
                                source.addEventListener('ended', () => {
                                    activeSources.current.delete(source);
                                    if (activeSources.current.size === 0) setIsSpeaking(false);
                                });
                                
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                activeSources.current.add(source);
                            } catch (err) {
                                console.error("Error playing back audio:", err);
                            }
                        }

                        if (message.serverContent?.interrupted) {
                            activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
                            activeSources.current.clear();
                            nextStartTimeRef.current = 0;
                            setIsSpeaking(false);
                        }
                    },
                    onerror: (e) => {
                        console.error("Live AI Session Error:", e);
                        setErrorMsg("การเชื่อมต่อ AI ขัดข้อง กรุณาลองใหม่อีกครั้ง");
                        stopSession();
                    },
                    onclose: () => {
                        if (!errorMsg) stopSession();
                    }
                }
            });

            sessionRef.current = await sessionPromise;

        } catch (error: any) {
            console.error("Failed to start AI session", error);
            setErrorMsg(error.message || "ไม่สามารถเริ่มเซสชัน AI ได้");
            setIsConnecting(false);
        }
    };

    // Drag Logic
    const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragOffset.current = {
            x: clientX - position.x,
            y: clientY - position.y
        };
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
                    {!isOpen && (
                        <div className="absolute inset-[-4px] border border-cyan-500/30 rounded-full animate-ping pointer-events-none"></div>
                    )}
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#020617]/95 backdrop-blur-2xl flex flex-col animate-enter p-8 text-white">
                    <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center space-y-12">
                        
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <div className={`absolute -inset-12 bg-cyan-500/20 rounded-full blur-[60px] transition-all duration-700 ${isSpeaking ? 'scale-150 opacity-60' : 'scale-100 opacity-20'}`}></div>
                                <div className={`w-32 h-32 rounded-[40px] bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/10 flex items-center justify-center relative shadow-2xl ${isSpeaking ? 'animate-pulse' : ''}`}>
                                    <Bot size={64} className={`${isSpeaking ? 'text-cyan-400' : 'text-slate-400'} transition-colors duration-500`} />
                                    {isConnecting && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-[40px]">
                                            <Loader2 className="animate-spin text-white" size={40} />
                                        </div>
                                    )}
                                    {errorMsg && (
                                        <div className="absolute -bottom-2 -right-2 bg-rose-500 p-2 rounded-full border-4 border-slate-900">
                                            <AlertCircle size={20} className="text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <h2 className="text-3xl font-black tracking-tighter">Happy Joby Coach</h2>
                            <p className={`font-bold text-xs uppercase tracking-[0.3em] ${errorMsg ? 'text-rose-400' : 'text-slate-400'}`}>
                                {errorMsg ? 'Session Blocked' : isConnecting ? 'Linking Intelligence...' : isSpeaking ? 'Coaching Active' : 'Listening for your questions'}
                            </p>
                        </div>

                        {errorMsg ? (
                            <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-[32px] text-center max-w-sm">
                                <p className="text-rose-400 text-sm font-medium leading-relaxed">{errorMsg}</p>
                                <button 
                                    onClick={() => { setErrorMsg(null); startSession(); }}
                                    className="mt-6 px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Retry Link
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="h-32 flex items-center justify-center gap-1.5 w-full">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div 
                                            key={i} 
                                            className={`w-2 bg-gradient-to-t from-cyan-600 to-blue-400 rounded-full transition-all duration-300 ${
                                                isSpeaking ? 'animate-bounce' : isListening ? 'opacity-40 scale-y-50' : 'opacity-10 scale-y-20'
                                            }`}
                                            style={{ 
                                                height: isSpeaking ? `${20 + Math.random() * 80}%` : '10px',
                                                animationDelay: `${i * 0.1}s` 
                                            }}
                                        ></div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-3">
                                        <Target className="text-amber-500" size={20} />
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Strategy</div>
                                            <div className="text-xs font-bold truncate">Closing Tactics</div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-3">
                                        <Calendar className="text-cyan-500" size={20} />
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Daily Ops</div>
                                            <div className="text-xs font-bold truncate">Day Optimizer</div>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-3">
                                        <TrendingUp className="text-emerald-500" size={20} />
                                        <div>
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Portfolio</div>
                                            <div className="text-xs font-bold truncate">Pipeline Review</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-auto flex justify-center py-10">
                        <button 
                            onClick={toggleAI}
                            className="bg-white/10 hover:bg-white/20 px-8 py-4 rounded-full border border-white/10 font-black text-xs uppercase tracking-widest transition-all"
                        >
                            End Coaching Session
                        </button>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce {
                    0%, 100% { transform: scaleY(1); }
                    50% { transform: scaleY(1.5); }
                }
            `}} />
        </>
    );
};
