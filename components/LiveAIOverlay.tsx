
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Loader2, Sparkles, TrendingUp, Target, AlertCircle, Mic } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { User } from 'firebase/auth';
import { getUserProfile, getTodayAttendance, getReminders, addReminder, addInteractionByAi, finalizeCheckoutByAi } from '../services/dbService';

interface Props {
    user: User;
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
    const [inputVolume, setInputVolume] = useState(0); // Real-time mic volume (0-1)
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const sessionRef = useRef<any>(null);
    const audioContexts = useRef<{ input?: AudioContext, output?: AudioContext }>({});
    const micStreamRef = useRef<MediaStream | null>(null);
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
        
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }

        activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
        activeSources.current.clear();
        
        if (audioContexts.current.input) try { audioContexts.current.input.close(); } catch(e){}
        if (audioContexts.current.output) try { audioContexts.current.output.close(); } catch(e){}
        audioContexts.current = {};
        
        nextStartTimeRef.current = 0;
        setIsListening(false);
        setIsSpeaking(false);
        setIsConnecting(false);
        setInputVolume(0);
    };

    const startSession = async () => {
        setIsConnecting(true);
        setErrorMsg(null);
        nextStartTimeRef.current = 0;
        
        try {
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStreamRef.current = stream;
            } catch (micError: any) {
                throw new Error("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาตรวจสอบการตั้งค่าความปลอดภัย");
            }

            const profile = await getUserProfile(user.uid);
            const systemInstruction = `
                คุณคือ "Happy Joby AI Coach" เลขาส่วนตัวอัจฉริยะ
                หน้าที่: วิเคราะห์ดีล, บันทึกรายงาน, และเป็นที่ปรึกษาการขาย
                บริบทผู้ใช้: ${profile?.name || user.email}, พื้นที่: ${profile?.area || 'ทั่วไป'}
                เวลาปัจจุบัน: ${new Date().toLocaleTimeString('th-TH')}
            `;

            const effectiveApiKey = profile?.aiApiKey || process.env.API_KEY || "AIzaSyCVhjhj0Qv8NFA34U6IF49OayDRFr_Zd70";
            
            if (!effectiveApiKey) {
                throw new Error("ไม่พบ API Key ในระบบ กรุณาติดต่อแอดมิน");
            }

            const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
            
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
                            
                            // Calculate volume for visualization
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) {
                                sum += inputData[i] * inputData[i];
                            }
                            const rms = Math.sqrt(sum / inputData.length);
                            // Boost sensitivity for small sounds
                            const normalizedVol = Math.min(1, rms * 8);
                            setInputVolume(normalizedVol);

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
                        setErrorMsg("การเชื่อมต่อขัดข้อง: " + (e?.message || "โปรดลองใหม่อีกครั้ง"));
                        stopSession(); 
                    },
                    onclose: () => { if (!errorMsg) stopSession(); }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) {
            setErrorMsg(error.message);
            setIsConnecting(false);
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
                micStreamRef.current = null;
            }
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
                <div className="fixed inset-0 z-[999] bg-[#020617] backdrop-blur-3xl flex flex-col animate-enter text-white h-[100dvh] w-full overflow-hidden">
                    {/* Safe Area Padding for Top */}
                    <div className="pt-[max(2rem,env(safe-area-inset-top))] px-8 flex-1 flex flex-col">
                        <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col items-center justify-center space-y-10 text-center">
                            <div className="flex flex-col items-center space-y-4">
                                <div className="relative mb-4">
                                    {/* Pulse aura reacts to User input volume */}
                                    <div 
                                        className={`absolute -inset-12 bg-cyan-500/20 rounded-full blur-[60px] transition-all duration-150 ${isSpeaking ? 'scale-150 opacity-60' : 'scale-100 opacity-20'}`}
                                        style={{ transform: `scale(${1 + (isListening && !isSpeaking ? inputVolume * 0.5 : 0)})`, opacity: isListening && !isSpeaking ? 0.2 + inputVolume * 0.4 : 0.2 }}
                                    ></div>
                                    
                                    <div className={`w-32 h-32 rounded-[40px] bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/10 flex items-center justify-center relative shadow-2xl transition-transform duration-100 ${isSpeaking ? 'animate-pulse' : ''}`}
                                         style={{ transform: isListening && !isSpeaking ? `scale(${1 + inputVolume * 0.1})` : 'scale(1)' }}>
                                        <Bot size={64} className={`${isSpeaking ? 'text-cyan-400' : isListening ? 'text-emerald-400' : 'text-slate-400'} transition-colors duration-500`} />
                                        {isConnecting && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 rounded-[40px]"><Loader2 className="animate-spin text-white" size={40} /></div>}
                                        {errorMsg && <div className="absolute -bottom-2 -right-2 bg-rose-500 p-2 rounded-full border-4 border-slate-900"><AlertCircle size={20} className="text-white" /></div>}
                                        
                                        {/* Listening Indicator Dot */}
                                        {isListening && !isSpeaking && !isConnecting && (
                                            <div className="absolute -top-1 -right-1 flex h-4 w-4">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black tracking-tighter">Happy Joby AI</h2>
                                <div className="flex items-center gap-2">
                                    {isListening && !isSpeaking && !isConnecting && <Mic size={14} className="text-emerald-400 animate-pulse" />}
                                    <p className={`font-bold text-xs uppercase tracking-[0.3em] transition-colors duration-300 ${errorMsg ? 'text-rose-400' : isConnecting ? 'text-slate-400' : isSpeaking ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                        {errorMsg ? 'Connection Error' : isConnecting ? 'Initializing Intelligence...' : isSpeaking ? 'AI is Speaking' : 'Listening...'}
                                    </p>
                                </div>
                            </div>

                            {errorMsg ? (
                                <div className="bg-rose-500/10 border border-rose-500/30 p-8 rounded-[40px] text-center max-w-sm space-y-6">
                                    <p className="text-rose-400 text-sm font-medium leading-relaxed font-bold">{errorMsg}</p>
                                    <button onClick={startSession} className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95">Retry Connection</button>
                                </div>
                            ) : (
                                <div className="h-24 flex items-center justify-center gap-2 w-full max-w-xs mx-auto">
                                    {Array.from({ length: 15 }).map((_, i) => {
                                        // Bars react to AI speaking (predefined bounce) or User listening (real-time volume)
                                        let height;
                                        let opacity;
                                        let colorClass = "from-cyan-600 to-blue-400";

                                        if (isSpeaking) {
                                            height = `${30 + Math.random() * 70}%`;
                                            opacity = 'opacity-100';
                                        } else if (isListening && !isConnecting) {
                                            // Real-time user volume scaling with slight randomization per bar for organic feel
                                            const v = inputVolume * (0.8 + Math.random() * 0.4);
                                            height = `${10 + v * 90}%`;
                                            opacity = inputVolume > 0.05 ? 'opacity-100' : 'opacity-40';
                                            colorClass = "from-emerald-600 to-cyan-400";
                                        } else {
                                            height = '12px';
                                            opacity = 'opacity-10';
                                        }

                                        return (
                                            <div 
                                                key={i} 
                                                className={`w-2 bg-gradient-to-t ${colorClass} rounded-full transition-all duration-100 ${isSpeaking ? 'animate-bounce' : ''} ${opacity}`} 
                                                style={{ 
                                                    height: height, 
                                                    animationDelay: `${i * 0.08}s` 
                                                }}
                                            ></div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full px-4">
                                <div className="bg-white/5 border border-white/10 p-4 rounded-[24px] flex items-center gap-4">
                                    <Target className="text-cyan-500" size={24} />
                                    <div className="min-w-0 text-left">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Coach</div>
                                        <div className="text-xs font-bold truncate">ที่ปรึกษาส่วนตัว</div>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-4 rounded-[24px] flex items-center gap-4">
                                    <TrendingUp className="text-amber-500" size={24} />
                                    <div className="min-w-0 text-left">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Reports</div>
                                        <div className="text-xs font-bold truncate">สรุปรายงาน</div>
                                    </div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-4 rounded-[24px] flex items-center gap-4">
                                    <Sparkles className="text-emerald-500" size={24} />
                                    <div className="min-w-0 text-left">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Tasks</div>
                                        <div className="text-xs font-bold truncate">จัดการนัดหมาย</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-auto flex justify-center pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8">
                            <button onClick={toggleAI} className="bg-white/10 hover:bg-white/20 px-12 py-5 rounded-[24px] border border-white/10 font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl">Close Session</button>
                        </div>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{ __html: `@keyframes bounce { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.6); } }` }} />
        </>
    );
};
