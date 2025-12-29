
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Loader2, Sparkles, TrendingUp, Target, AlertCircle, Mic, Cpu, Zap, Radio } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { User } from 'firebase/auth';
import { getUserProfile, getTodayAttendance, getReminders, addReminder, addInteractionByAi, finalizeCheckoutByAi, createContactByAi } from '../services/dbService';

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

// Tool Definitions for AI
const tools: { functionDeclarations: FunctionDeclaration[] }[] = [{
    functionDeclarations: [
        {
            name: 'add_interaction',
            description: 'บันทึกรายงานการเข้าพบลูกค้าหรือกิจกรรมที่ทำในโรงพยาบาล/สถานที่นั้นๆ',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    locationName: { type: Type.STRING, description: 'ชื่อโรงพยาบาลหรือสถานที่ที่เข้าพบ (เช่น รพ.จุฬา)' },
                    customerName: { type: Type.STRING, description: 'ชื่อลูกค้าหรือผู้ติดต่อที่คุยด้วย' },
                    department: { type: Type.STRING, description: 'แผนกของผู้ติดต่อ (ถ้าทราบ)' },
                    summary: { type: Type.STRING, description: 'สรุปเนื้อหาการสนทนาหรือกิจกรรมที่ทำ' }
                },
                required: ['locationName', 'customerName', 'summary']
            }
        },
        {
            name: 'create_new_contact',
            description: 'สร้างรายชื่อผู้ติดต่อใหม่ลงในฐานข้อมูลถาวรของผู้ใช้งาน',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'ชื่อ-นามสกุล ของผู้ติดต่อใหม่' },
                    hospital: { type: Type.STRING, description: 'โรงพยาบาลหรือสถานที่ต้นสังกัด' },
                    department: { type: Type.STRING, description: 'แผนกหรือตำแหน่ง (เช่น จัดซื้อ, วิสัญญี)' },
                    phone: { type: Type.STRING, description: 'เบอร์โทรศัพท์ (ถ้ามี)' }
                },
                required: ['name', 'hospital', 'department']
            }
        },
        {
            name: 'finalize_checkout',
            description: 'ทำการเช็คเอาท์ (Check-out) เพื่อสรุปงานและเลิกงานสำหรับวันนี้',
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: 'get_today_context',
            description: 'ดึงข้อมูลว่าวันนี้เช็คอินไปที่ไหนแล้วบ้าง เพื่อใช้ประกอบการตัดสินใจ',
            parameters: { type: Type.OBJECT, properties: {} }
        }
    ]
}];

export const LiveAIOverlay: React.FC<Props> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [inputVolume, setInputVolume] = useState(0);
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

    const handleToolCall = async (fc: any) => {
        try {
            switch (fc.name) {
                case 'add_interaction':
                    const result = await addInteractionByAi(user.uid, fc.args.locationName, fc.args.customerName, fc.args.summary, fc.args.department || '');
                    return { result };
                case 'create_new_contact':
                    const cResult = await createContactByAi(user.uid, fc.args.name, fc.args.hospital, fc.args.department, fc.args.phone || '');
                    return { result: cResult };
                case 'finalize_checkout':
                    const coResult = await finalizeCheckoutByAi(user.uid);
                    return { result: coResult };
                case 'get_today_context':
                    const att = await getTodayAttendance(user.uid);
                    const list = att?.checkIns.map(ci => ci.location).join(', ') || 'ยังไม่มีการเช็คอิน';
                    return { result: `วันนี้คุณเช็คอินที่: ${list}` };
                default:
                    return { result: "ไม่พบคำสั่งนี้" };
            }
        } catch (e: any) {
            return { error: e.message };
        }
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
                คุณคือ "Happy Joby AI Coach" เลขาส่วนตัวอัจฉริยะที่เข้าถึงฐานข้อมูลของผู้ใช้ได้จริง
                รายชื่อผู้ติดต่อปัจจุบันของผู้ใช้: ${JSON.stringify(profile?.customers || [])}
                
                หน้าที่: 
                1. หากผู้ใช้ระบุชื่อบุคคลที่ไม่มีใน "รายชื่อผู้ติดต่อปัจจุบัน" ให้คุณถามแผนกของเขา แล้วใช้เครื่องมือ "create_new_contact" เพื่อบันทึกเขาเข้าสู่ระบบถาวรก่อน
                2. บันทึกรายงาน (add_interaction) โดยระบุสถานที่, ชื่อลูกค้า, แผนก และสรุปกิจกรรมให้ครบถ้วน
                3. สรุปงานและเช็คเอาท์ (finalize_checkout) เมื่อได้รับคำสั่ง
                4. ตรวจสอบบริบท (get_today_context) เสมอหากผู้ใช้พูดว่า "ที่นี่" เพื่อดูว่าล่าสุดเขาอยู่ที่ไหน
                
                แนวทางการตอบ: 
                - กระตือรือร้น, เป็นกันเองแต่เป็นมืออาชีพ
                - หากสร้างผู้ติดต่อใหม่ ให้บอกผู้ใช้ด้วยว่า "บันทึกชื่อคุณ... ลงในฐานข้อมูลผู้ติดต่อเรียบร้อยแล้วครับ"
                
                เวลาปัจจุบัน: ${new Date().toLocaleTimeString('th-TH')}
            `;

            const effectiveApiKey = profile?.aiApiKey || process.env.API_KEY || "AIzaSyCVhjhj0Qv8NFA34U6IF49OayDRFr_Zd70";
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
                    tools: tools
                },
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsListening(true);
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                            const rms = Math.sqrt(sum / inputData.length);
                            setInputVolume(Math.min(1, rms * 8));
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(s => s?.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                const toolResult = await handleToolCall(fc);
                                sessionPromise.then(s => s.sendToolResponse({
                                    functionResponses: {
                                        id: fc.id,
                                        name: fc.name,
                                        response: toolResult
                                    }
                                }));
                            }
                        }

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
            {/* FLOATING TRIGGER BUTTON */}
            <div 
                className={`fixed z-[1000] cursor-grab active:cursor-grabbing transition-transform ${isDragging ? '' : 'duration-300'} group`}
                style={{ left: position.x, top: position.y }}
                onMouseDown={onMouseDown}
                onTouchStart={onMouseDown}
            >
                <div className={`relative w-20 h-20 flex items-center justify-center animate-float`}>
                    {!isOpen && (
                        <>
                            <div className="absolute inset-0 border-2 border-dashed border-cyan-500/40 rounded-full animate-rotate-slow"></div>
                            <div className="absolute inset-2 border border-cyan-400/20 rounded-full animate-rotate-reverse"></div>
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100 pointer-events-none">
                                <div className="bg-slate-900/90 backdrop-blur-md text-cyan-400 text-[10px] font-black px-3 py-1 rounded-full border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)] uppercase tracking-widest">Ask Coach</div>
                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-cyan-500/30 mx-auto mt-[-1px]"></div>
                            </div>
                        </>
                    )}

                    <button 
                        onClick={toggleAI}
                        className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all duration-500 border-2 overflow-hidden
                            ${isOpen ? 'bg-rose-500 border-white/30 scale-90 rotate-90' : 'bg-slate-900/80 backdrop-blur-xl border-cyan-500/50 hover:scale-110 hover:border-cyan-400'}
                        `}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${isOpen ? 'from-rose-400 to-rose-600' : 'from-cyan-400/20 to-blue-600/30'} animate-pulse`}></div>
                        {!isOpen && <Sparkles className="absolute top-2 right-2 text-cyan-300 opacity-50 animate-pulse" size={12} />}
                        {isOpen ? (
                            <X className="text-white relative z-10" size={24} />
                        ) : (
                            <div className="relative z-10 flex flex-col items-center">
                                <Bot className="text-cyan-400 group-hover:text-white transition-colors drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" size={32} />
                                <div className="absolute -bottom-1 w-4 h-1 bg-cyan-400/50 blur-[2px] rounded-full animate-pulse"></div>
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* FULLSCREEN IMMERSIVE OVERLAY */}
            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col animate-enter text-white h-[100dvh] w-full overflow-hidden">
                    {/* Atmospheric Background Animations */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
                        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px] animate-nebula-slow"></div>
                        <div className="absolute bottom-[0%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[100px] animate-nebula-reverse"></div>
                        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[80px] animate-nebula-float"></div>
                    </div>

                    <div className="relative z-10 pt-[max(2rem,env(safe-area-inset-top))] px-8 flex-1 flex flex-col items-center">
                        {/* Top Context Bar */}
                        <div className="w-full max-w-lg flex justify-between items-center opacity-60 mb-12">
                            <div className="flex items-center gap-2">
                                <Radio size={14} className="text-cyan-400 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Neural Link Active</span>
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest">{new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>

                        {/* Central AI Entity */}
                        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl space-y-16">
                            <div className="relative flex flex-col items-center">
                                {/* Waveform Container */}
                                <div className="relative w-72 h-72 flex items-center justify-center">
                                    {/* Multi-layered Reactive Blob */}
                                    <div className={`absolute inset-0 bg-cyan-500/20 rounded-full blur-[60px] transition-all duration-300 ${isSpeaking ? 'scale-150 opacity-40' : isListening ? 'scale-125 opacity-20' : 'scale-100 opacity-10'}`}></div>
                                    
                                    {/* The Neural Core */}
                                    <div className={`relative w-48 h-48 flex items-center justify-center transition-transform duration-200 ${isSpeaking ? 'scale-105' : ''}`}>
                                        {/* Waveform Layers */}
                                        <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-600 to-blue-400 rounded-full opacity-30 animate-neural-wave ${isListening || isSpeaking ? '' : 'paused'}`}></div>
                                        <div className={`absolute inset-4 bg-gradient-to-bl from-blue-500 to-indigo-400 rounded-full opacity-40 animate-neural-wave-reverse ${isListening || isSpeaking ? '' : 'paused'}`}></div>
                                        <div className={`absolute inset-8 bg-gradient-to-br from-indigo-600 to-purple-500 rounded-full opacity-50 animate-neural-pulse ${isListening || isSpeaking ? '' : 'paused'}`}></div>
                                        
                                        <div className="relative z-20 w-24 h-24 bg-slate-900 border-2 border-white/20 rounded-full flex items-center justify-center shadow-2xl overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent"></div>
                                            {isConnecting ? (
                                                <Loader2 size={40} className="text-white animate-spin" />
                                            ) : (
                                                <Bot size={48} className={`transition-all duration-500 ${isSpeaking ? 'text-cyan-400 scale-110 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]' : isListening ? 'text-emerald-400' : 'text-slate-500'}`} />
                                            )}
                                        </div>

                                        {/* Audio Visualizer Rings */}
                                        {(isListening || isSpeaking) && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-full h-full border border-white/5 rounded-full animate-ring-expand-1"></div>
                                                <div className="w-full h-full border border-white/5 rounded-full animate-ring-expand-2"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-12 text-center space-y-3">
                                    <h2 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 drop-shadow-xl">Happy Joby AI</h2>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md transition-all duration-500 ${errorMsg ? 'bg-rose-500/20 border-rose-500/30' : isSpeaking ? 'bg-cyan-500/10 border-cyan-500/20' : isListening ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
                                            {isListening && !isSpeaking && !isConnecting && <Mic size={14} className="text-emerald-400 animate-pulse" />}
                                            {isSpeaking && <Radio size={14} className="text-cyan-400 animate-bounce" />}
                                            <span className={`text-[11px] font-black uppercase tracking-[0.3em] ${errorMsg ? 'text-rose-400' : isSpeaking ? 'text-cyan-400' : isListening ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                {errorMsg ? 'Neural Disruption' : isConnecting ? 'Initializing Link...' : isSpeaking ? 'AI Speaking' : isListening ? 'Listening' : 'Standby'}
                                            </span>
                                        </div>
                                        {errorMsg && <p className="text-rose-400/80 text-[10px] font-bold max-w-xs">{errorMsg}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Gemini Style Animated Spectrum Bar */}
                            <div className="w-full max-w-sm h-[2px] relative flex items-center justify-center overflow-hidden rounded-full">
                                <div className="absolute inset-0 bg-white/5"></div>
                                <div 
                                    className={`absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-500 transition-all duration-300 ${isListening || isSpeaking ? 'opacity-100 scale-x-100' : 'opacity-20 scale-x-0'}`}
                                    style={{ transform: `scaleX(${isListening ? Math.max(0.1, inputVolume * 2) : 1})` }}
                                ></div>
                                {(isListening || isSpeaking) && (
                                    <div className="absolute inset-0 animate-spectrum-sweep bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] w-[50%]"></div>
                                )}
                            </div>

                            {/* HUD Intelligence Grid */}
                            <div className="grid grid-cols-3 gap-6 w-full px-4 pt-4">
                                <div className="flex flex-col items-center space-y-2 group">
                                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-500">
                                        <Target className="text-cyan-500 group-hover:animate-pulse" size={20} />
                                    </div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Strategy</span>
                                </div>
                                <div className="flex flex-col items-center space-y-2 group">
                                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-all duration-500">
                                        <Cpu className="text-amber-500 group-hover:rotate-90 transition-transform duration-700" size={20} />
                                    </div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Processor</span>
                                </div>
                                <div className="flex flex-col items-center space-y-2 group">
                                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all duration-500">
                                        <Zap className="text-emerald-500 group-hover:scale-125 transition-transform" size={20} />
                                    </div>
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Agility</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Footer Control */}
                        <div className="w-full max-w-lg mt-auto flex justify-center pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-8">
                            <button 
                                onClick={toggleAI} 
                                className="group relative px-16 py-5 rounded-[24px] border border-white/10 font-black text-[10px] uppercase tracking-[0.4em] transition-all overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                                <span className="relative z-10 text-white/60 group-hover:text-white transition-colors">Disconnect Link</span>
                                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes nebula-slow { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(10%, 5%) scale(1.1); } }
                @keyframes nebula-reverse { 0%, 100% { transform: translate(0, 0) scale(1.1); } 50% { transform: translate(-10%, -10%) scale(1); } }
                @keyframes nebula-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20%); } }
                
                @keyframes neural-wave { 0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: rotate(0deg); } 50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; transform: rotate(180deg); } }
                @keyframes neural-wave-reverse { 0%, 100% { border-radius: 40% 60% 70% 30% / 50% 60% 30% 60%; transform: rotate(360deg); } 50% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: rotate(180deg); } }
                @keyframes neural-pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.1); opacity: 0.7; } }
                
                @keyframes ring-expand { 0% { transform: scale(1); opacity: 0.5; border-width: 2px; } 100% { transform: scale(1.8); opacity: 0; border-width: 0.5px; } }
                @keyframes spectrum-sweep { 0% { transform: translateX(-200%); } 100% { transform: translateX(200%); } }
                
                .animate-nebula-slow { animation: nebula-slow 15s ease-in-out infinite; }
                .animate-nebula-reverse { animation: nebula-reverse 18s ease-in-out infinite; }
                .animate-nebula-float { animation: nebula-float 12s ease-in-out infinite; }
                
                .animate-neural-wave { animation: neural-wave 8s linear infinite; }
                .animate-neural-wave-reverse { animation: neural-wave-reverse 10s linear infinite; }
                .animate-neural-pulse { animation: neural-pulse 4s ease-in-out infinite; }
                
                .animate-ring-expand-1 { animation: ring-expand 3s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
                .animate-ring-expand-2 { animation: ring-expand 3s cubic-bezier(0.16, 1, 0.3, 1) infinite 1.5s; }
                .animate-spectrum-sweep { animation: spectrum-sweep 2s linear infinite; }
                
                .paused { animation-play-state: paused; }
                
                @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes rotate-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .animate-rotate-slow { animation: rotate-slow 8s linear infinite; }
                .animate-rotate-reverse { animation: rotate-reverse 5s linear infinite; }
                .animate-float { animation: float 4s ease-in-out infinite; }
            ` }} />
        </>
    );
};
