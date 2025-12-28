
import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
// Fix: Added User as UserIcon to imports
import { Sparkles, Mic, MicOff, Loader2, MessageSquare, Info, ShieldCheck, ArrowLeft, TrendingUp, MapPin, Target, User as UserIcon } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { getUserProfile, getWorkPlans, getReminders, getTodayDateId } from '../services/dbService';
import { UserProfile, WorkPlan, Reminder } from '../types';

interface AIAssistantProps {
    user: User;
    userProfile: UserProfile | null;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ user, userProfile }) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
    const [transcription, setTranscription] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [audioActive, setAudioActive] = useState(false);
    
    // Audio Context & Refs
    const sessionRef = useRef<any>(null);
    const inputAudioCtxRef = useRef<AudioContext | null>(null);
    const outputAudioCtxRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    // Context Data
    const [contextLoaded, setContextLoaded] = useState(false);
    const contextRef = useRef<string>("");

    useEffect(() => {
        const loadContext = async () => {
            const today = getTodayDateId();
            const [profile, plans, reminders] = await Promise.all([
                getUserProfile(user.uid),
                getWorkPlans(user.uid),
                getReminders(user.uid)
            ]);

            const todayPlan = plans.find(p => p.date === today);
            const activePipeline = profile?.activePipeline || [];
            const pendingTasks = reminders.filter(r => !r.isCompleted);

            let contextText = `คุณคือที่ปรึกษาอัจฉริยะชื่อ "Happy Joby" สำหรับพนักงานคนนี้:
            - ชื่อ: ${profile?.name || user.email}
            - เขตพื้นที่: ${profile?.area || 'ไม่ระบุ'}
            - แผนงานวันนี้: ${todayPlan ? todayPlan.title + " (" + todayPlan.itinerary.map(i => i.location).join(', ') + ")" : 'ไม่มีแผนงาน'}
            - โอกาสขายใน Pipeline: ${activePipeline.map(p => `${p.product} มูลค่า ${p.value} สถานะ ${p.stage}`).join(' | ')}
            - งานที่ต้องทำ: ${pendingTasks.map(t => t.title).join(', ')}
            
            หน้าที่ของคุณคือให้คำแนะนำเชิงกลยุทธ์ เช่น:
            1. วิเคราะห์ว่าควรไปที่ไหนก่อนจากแผนงาน
            2. แนะนำว่าควรขายสินค้าอะไรให้ใคร โดยดูจากมูลค่าและความน่าจะเป็นใน Pipeline
            3. สรุปภาพรวมและให้กำลังใจ
            พูดจาเป็นกันเอง สุภาพ และเน้นช่วยให้พนักงานปิดการขายได้มากขึ้น`;

            contextRef.current = contextText;
            setContextLoaded(true);
        };
        loadContext();

        return () => {
            stopSession();
        };
    }, [user]);

    // Audio Helpers
    function decode(base64: string) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes;
    }

    async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

    function encode(bytes: Uint8Array) {
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    function createBlob(data: Float32Array) {
        const int16 = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
        return {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
        };
    }

    const startSession = async () => {
        if (!contextLoaded) return;
        setStatus('connecting');
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                    systemInstruction: contextRef.current,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {}
                },
                callbacks: {
                    onopen: () => {
                        setStatus('listening');
                        setAudioActive(true);
                        const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioCtxRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioCtxRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                            setStatus('speaking');
                            const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtxRef.current!.currentTime);
                            const buffer = await decodeAudioData(decode(base64), outputAudioCtxRef.current!, 24000, 1);
                            const source = outputAudioCtxRef.current!.createBufferSource();
                            source.buffer = buffer;
                            source.connect(outputAudioCtxRef.current!.destination);
                            source.onended = () => {
                                sourcesRef.current.delete(source);
                                if (sourcesRef.current.size === 0) setStatus('listening');
                            };
                            // Fix: Changed currentRef to current
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                            sourcesRef.current.add(source);
                        }

                        if (message.serverContent?.inputTranscription) {
                            setTranscription(prev => prev + " " + message.serverContent?.inputTranscription?.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setAiResponse(prev => prev + " " + message.serverContent?.outputTranscription?.text);
                        }
                        if (message.serverContent?.turnComplete) {
                            setTranscription('');
                            setAiResponse('');
                        }
                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(s => s.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                            setStatus('listening');
                        }
                    },
                    onerror: (e) => { setStatus('error'); console.error(e); },
                    onclose: () => { setStatus('idle'); setAudioActive(false); }
                }
            });

            sessionRef.current = await sessionPromise;
        } catch (err) {
            setStatus('error');
            console.error(err);
        }
    };

    const stopSession = () => {
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioCtxRef.current) inputAudioCtxRef.current.close();
        if (outputAudioCtxRef.current) outputAudioCtxRef.current.close();
        setAudioActive(false);
        setStatus('idle');
    };

    return (
        <div className="flex flex-col min-h-full px-5 py-6 space-y-8 animate-enter relative overflow-hidden">
            {/* Visual Atmosphere */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-30 pointer-events-none -z-10">
                <div className={`absolute top-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] transition-all duration-1000 ${status === 'listening' ? 'bg-cyan-500 animate-pulse' : status === 'speaking' ? 'bg-indigo-500 scale-125' : 'bg-slate-400 opacity-10'}`}></div>
                <div className={`absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-[100px] transition-all duration-1000 ${status === 'listening' ? 'bg-blue-500 delay-500' : status === 'speaking' ? 'bg-purple-500 scale-110' : 'bg-slate-400 opacity-10'}`}></div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter flex items-center gap-3">
                        AI Consultant
                        <Sparkles className="text-cyan-500 animate-spin duration-[5s]" size={28} />
                    </h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Personal Growth Partner</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 relative">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${audioActive ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${audioActive ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{status}</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-12 py-10">
                {/* Voice Visualizer Core */}
                <div className="relative group cursor-pointer" onClick={audioActive ? stopSession : startSession}>
                    <div className={`absolute -inset-10 rounded-full blur-[60px] transition-all duration-500 ${audioActive ? 'bg-cyan-500/30' : 'bg-slate-500/10'}`}></div>
                    <div className={`w-52 h-52 rounded-full border-4 flex items-center justify-center relative z-10 transition-all duration-500 ${audioActive ? 'bg-white dark:bg-slate-900 border-cyan-500 shadow-2xl scale-110' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 shadow-lg'}`}>
                        {status === 'connecting' ? (
                            <Loader2 className="animate-spin text-cyan-500" size={64} />
                        ) : audioActive ? (
                            <div className="flex items-center gap-1.5 h-16">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`w-2.5 bg-cyan-500 rounded-full transition-all duration-300 ${status === 'speaking' ? 'animate-[bounce_0.6s_infinite]' : 'animate-pulse'}`} style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }}></div>
                                ))}
                            </div>
                        ) : (
                            <Mic className="text-slate-400 group-hover:text-cyan-500 transition-colors" size={64} />
                        )}
                        
                        {/* Status Label */}
                        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
                            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.3em]">
                                {audioActive ? 'คุยกับ AI เลย...' : 'แตะเพื่อเริ่มคุย'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-6 max-w-md mx-auto">
                    {/* Live Transcription Cards */}
                    {transcription && (
                        <div className="animate-enter bg-white/40 dark:bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <UserIcon size={12} className="text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">You</span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">"{transcription}"</p>
                        </div>
                    )}

                    {aiResponse && (
                        <div className="animate-enter bg-cyan-500/5 dark:bg-cyan-500/10 backdrop-blur-xl p-5 rounded-[32px] border border-cyan-500/20 shadow-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={14} className="text-cyan-500" />
                                <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Joby Advisor</span>
                            </div>
                            <p className="text-base text-slate-900 dark:text-white font-bold italic">"{aiResponse}"</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Hint Section */}
            {!audioActive && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6">
                    <GlassCard className="p-4 border-slate-200/50 dark:border-white/5 opacity-80">
                        <TrendingUp size={18} className="text-emerald-500 mb-2" />
                        <h4 className="text-[10px] font-black uppercase mb-1">ยอดขาย</h4>
                        <p className="text-[10px] text-slate-500">"ฉันควรไปขายโปรเจกต์ไหนต่อดี?"</p>
                    </GlassCard>
                    <GlassCard className="p-4 border-slate-200/50 dark:border-white/5 opacity-80">
                        <MapPin size={18} className="text-cyan-500 mb-2" />
                        <h4 className="text-[10px] font-black uppercase mb-1">แผนงาน</h4>
                        <p className="text-[10px] text-slate-500">"วันนี้ฉันต้องไปที่ไหนบ้าง?"</p>
                    </GlassCard>
                    <GlassCard className="p-4 border-slate-200/50 dark:border-white/5 opacity-80">
                        <Target size={18} className="text-indigo-500 mb-2" />
                        <h4 className="text-[10px] font-black uppercase mb-1">คำแนะนำ</h4>
                        <p className="text-[10px] text-slate-500">"ให้กำลังใจฉันหน่อย วันนี้เหนื่อยจัง"</p>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default AIAssistant;
