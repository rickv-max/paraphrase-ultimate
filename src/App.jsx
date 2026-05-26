import React, { useState, useEffect, useRef } from 'react';
import { 
    Sparkles, ShieldCheck, ChevronDown, ArrowRightLeft, 
    Trash2, Copy, CheckCircle2, FileText, Loader2, UserCircle, 
    LogOut, Crown, Lock, Unlock, X, CreditCard, Check, AlertCircle, Info 
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
    signInWithCustomToken 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    onSnapshot, 
    setDoc 
} from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
// Membaca dari Environment Variables (Vercel / .env lokal)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'paraphrase-pro-app';

// Menggunakan API Key bawaan environment atau kosong
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; 

export default function App() {
    // --- AUTH & USER STATE ---
    const [user, setUser] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);

    // --- APP STATE ---
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [tone, setTone] = useState({ value: 'Standar', label: 'Standar (Natural)', premium: false });
    const [intensity, setIntensity] = useState('Sedang');
    
    // --- UI STATE ---
    const [isToneDropdownOpen, setIsToneDropdownOpen] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    
    const dropdownRef = useRef(null);

    // --- EFFECT: AUTHENTICATION (RULE 3) ---
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Auth init error:", error);
                showToast("Gagal menginisialisasi sesi", "error");
            } finally {
                setAuthLoading(false);
            }
        };

        initAuth();

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => unsubscribe();
    }, []);

    // --- EFFECT: FIRESTORE SUBSCRIPTION LISTENER (RULE 1 & 3) ---
    useEffect(() => {
        if (!user) {
            setIsPremium(false);
            return;
        }

        // Listener for private user data
        const subRef = doc(db, 'artifacts', appId, 'users', user.uid, 'subscription', 'status');
        
        const unsubscribe = onSnapshot(subRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const now = new Date().getTime();
                setIsPremium(data.isPremium && data.expiresAt && data.expiresAt > now);
            } else {
                setIsPremium(false);
            }
        }, (error) => {
            console.error("Subscription listener error:", error);
            setIsPremium(false);
        });

        return () => unsubscribe();
    }, [user]);

    // --- EFFECT: CLICK OUTSIDE DROPDOWN ---
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsToneDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // --- TOAST UTILS ---
    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // --- HANDLERS ---
    const handleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            showToast("Login berhasil!");
        } catch (error) {
            console.error("Login error:", error);
            showToast("Login ditutup atau pop-up diblokir.", "error");
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            if (tone.premium) {
                setTone({ value: 'Standar', label: 'Standar (Natural)', premium: false });
            }
            showToast("Berhasil keluar.");
        } catch (error) {
            showToast("Gagal keluar.", "error");
        }
    };

    const handleSelectTone = (option) => {
        if (option.premium && !isPremium) {
            setIsToneDropdownOpen(false);
            setShowUpgradeModal(true);
            return;
        }
        setTone(option);
        setIsToneDropdownOpen(false);
    };

    const handlePayment = async () => {
        if (!user) return;
        setIsProcessingPayment(true);
        
        try {
            // Simulasi proses Bayar.GG
            await new Promise(res => setTimeout(res, 1500));
            
            const expiryDate = new Date().getTime() + (14 * 24 * 60 * 60 * 1000);
            const subRef = doc(db, 'artifacts', appId, 'users', user.uid, 'subscription', 'status');
            
            await setDoc(subRef, {
                isPremium: true,
                expiresAt: expiryDate,
                plan: 'Pro 14 Hari',
                updatedAt: new Date().toISOString()
            }, { merge: true });

            setShowUpgradeModal(false);
            showToast("Pembayaran berhasil! Akses Pro dibuka.", "success");
            
            // Re-select tone if they were trying to pick one
            if (tone.premium && isPremium) {
               // Logic is handled by the subscription listener updating state
            }
            
        } catch (error) {
            console.error("Payment error:", error);
            showToast("Kesalahan sistem pembayaran.", "error");
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleClear = () => {
        setInputText('');
        setOutputText('');
    };

    const handleCopy = () => {
        if (!outputText) return;
        
        // Use modern clipboard API if available, fallback to execCommand
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(outputText).then(() => {
                showToast("Teks disalin!");
            });
        } else {
             const textArea = document.createElement("textarea");
             textArea.value = outputText;
             document.body.appendChild(textArea);
             textArea.select();
             try {
                 document.execCommand('copy');
                 showToast("Teks disalin!");
             } catch (err) {
                 showToast("Gagal menyalin.", "error");
             }
             document.body.removeChild(textArea);
        }
    };

    const countWords = (text) => text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

    // --- GEMINI AI PROCESS ---
    const handleParaphrase = async () => {
        if (!inputText.trim()) {
            showToast("Mohon masukkan teks.", "error");
            return;
        }
        if (countWords(inputText) < 3) {
            showToast("Teks terlalu pendek. Minimal 3 kata.", "error");
            return;
        }

        setIsProcessing(true);
        setOutputText('');

        let intensityInstruction = "";
        if (intensity === "Tinggi") {
            intensityInstruction = "Lakukan RESTRUKTURISASI TOTAL. Ubah urutan klausa, gabungkan kalimat pendek, pecah kalimat panjang, dan ganti hampir semua kata dengan sinonim tingkat lanjut. Jangan menyalin lebih dari 2 kata berurutan.";
        } else if (intensity === "Sedang") {
            intensityInstruction = "Ubah struktur kalimat secara moderat dan gunakan variasi sinonim yang kaya.";
        } else {
            intensityInstruction = "Pertahankan struktur kalimat asli, tetapi ganti kata-kata kunci dengan sinonim yang akurat.";
        }

        const systemPrompt = `Anda adalah ahli linguistik dan penulis ulang profesional bahasa Indonesia. 
Tugas utama Anda: Parafrasekan teks untuk MENGHINDARI DETEKSI PLAGIASI (100% Unique).

ATURAN KETAT:
1. INTENSITAS: ${intensityInstruction}
2. GAYA BAHASA: Tulis dalam gaya ${tone.value}.
3. AKURASI: Makna inti TIDAK BOLEH hilang.
4. KUALITAS: Tata bahasa baku dan natural.
5. TANPA SINGKATAN (SANGAT PENTING): DILARANG KERAS mempertahankan singkatan (misal: UU, JPH, DPR, dll). Jabarkan semua singkatan menjadi kepanjangan lengkapnya (misal: "Undang-Undang"). Jangan ada huruf kapital berderet yang mengindikasikan singkatan.
6. FORMAT: Hanya kembalikan teks hasil akhir tanpa kutipan. DILARANG menambahkan teks basa-basi.`;

        const delays = [1000, 2000, 4000, 8000, 16000];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        
        let success = false;
        let finalResult = "";

        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: inputText.trim() }] }],
                        systemInstruction: { parts: [{ text: systemPrompt }] }
                    })
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    finalResult = data.candidates[0].content.parts[0].text;
                    success = true;
                    break;
                } else {
                    throw new Error("Format respons tidak valid");
                }
            } catch (error) {
                if (i === 4) break; // Exhauted retries
                await new Promise(r => setTimeout(r, delays[i]));
            }
        }

        if (success) {
            setOutputText(finalResult.trim());
            showToast("Parafrase berhasil diselesaikan!");
        } else {
            showToast("Gagal memproses ke server AI.", "error");
            setOutputText("Terjadi kesalahan saat memproses permintaan Anda. Mohon coba lagi.");
        }
        
        setIsProcessing(false);
    };

    // --- RENDER HELPERS ---
    const toneOptions = [
        { group: 'Gratis', value: 'Standar', label: 'Standar (Natural)', premium: false },
        { group: 'Pro Plan', value: 'Akademik', label: 'Akademik (Ilmiah)', premium: true },
        { group: 'Pro Plan', value: 'Formal', label: 'Formal (Profesional)', premium: true },
        { group: 'Pro Plan', value: 'Kreatif', label: 'Kreatif (Dinamis)', premium: true },
    ];

    return (
        <div className="font-sans bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col relative selection:bg-indigo-100 selection:text-indigo-900">
            
            {/* --- HEADER --- */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-200 shadow-sm transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-1.5 rounded-lg shadow-sm">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <h1 className="font-bold text-xl tracking-tight text-slate-900">
                            Parafrase AI<span className="text-indigo-600">Pro</span>
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {isPremium && (
                            <div className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                <Crown className="w-3.5 h-3.5" /> PRO
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3">
                            {authLoading ? (
                                <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin"></div>
                            ) : (!user || user.isAnonymous) ? (
                                <button onClick={handleLogin} className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-indigo-50">
                                    <UserCircle className="w-5 h-5" /> Masuk Google
                                </button>
                            ) : (
                                <button onClick={handleLogout} className="text-sm font-medium text-slate-600 hover:text-red-500 transition-colors flex items-center gap-2" title="Keluar">
                                    <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=6366f1&color=fff`} alt="Avatar" className="w-8 h-8 rounded-full border-2 border-slate-200" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
                
                {/* TOOLBAR */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-20">
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        
                        {/* Tone Dropdown */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 relative">
                            <label className="text-sm font-semibold text-slate-600 shrink-0">Gaya Bahasa:</label>
                            <div className="relative w-full sm:w-56" ref={dropdownRef}>
                                <button 
                                    onClick={() => setIsToneDropdownOpen(!isToneDropdownOpen)}
                                    className="bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 w-full px-4 py-2.5 font-medium cursor-pointer transition-all hover:bg-slate-100 flex items-center justify-between text-left shadow-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        {tone.premium && <Crown className="w-4 h-4 text-amber-500" />}
                                        {tone.label}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isToneDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isToneDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 origin-top">
                                        {/* Group: Gratis */}
                                        <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                                            <span className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gratis</span>
                                        </div>
                                        {toneOptions.filter(t => !t.premium).map(opt => (
                                            <button key={opt.value} onClick={() => handleSelectTone(opt)} className={`w-full text-left px-4 py-3 text-sm transition-colors font-medium flex items-center justify-between ${tone.value === opt.value ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                                {opt.label}
                                                {tone.value === opt.value && <Check className="w-4 h-4" />}
                                            </button>
                                        ))}
                                        
                                        {/* Group: Pro */}
                                        <div className="p-2 border-b border-t border-slate-100 bg-amber-50/50 flex items-center">
                                            <span className="px-2 text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                                                <Crown className="w-3 h-3" /> Fitur Pro
                                            </span>
                                        </div>
                                        {toneOptions.filter(t => t.premium).map(opt => (
                                            <button key={opt.value} onClick={() => handleSelectTone(opt)} className={`group w-full text-left px-4 py-3 text-sm transition-colors font-medium flex items-center justify-between ${tone.value === opt.value ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                                                <span>{opt.label}</span>
                                                {tone.value === opt.value ? (
                                                    <Check className="w-4 h-4" />
                                                ) : (
                                                    isPremium ? <Unlock className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Intensity Select */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-sm font-semibold text-slate-600 shrink-0">Intensitas:</label>
                            <div className="relative w-full sm:w-48">
                                <select 
                                    value={intensity} 
                                    onChange={(e) => setIntensity(e.target.value)}
                                    className="appearance-none bg-slate-50 border border-slate-300 text-slate-700 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 block w-full px-4 py-2.5 font-medium cursor-pointer transition-all hover:bg-slate-100 shadow-sm"
                                >
                                    <option value="Tinggi">Tinggi (Ubah total)</option>
                                    <option value="Sedang">Sedang (Seimbang)</option>
                                    <option value="Rendah">Rendah (Sinonim)</option>
                                </select>
                                <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleParaphrase} 
                        disabled={isProcessing || !inputText.trim()}
                        className="w-full sm:w-auto bg-slate-900 hover:bg-indigo-600 text-white font-semibold py-2.5 px-6 rounded-xl shadow-md shadow-indigo-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                        <span>Parafrase Sekarang</span>
                    </button>
                </div>

                {/* EDITOR GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-grow min-h-[500px] z-10 relative">
                    
                    {/* Input Pane */}
                    <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 relative">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Teks Asli</h2>
                            <button onClick={handleClear} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50" title="Hapus Teks">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-grow p-5 relative">
                            <textarea 
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                className="w-full h-full resize-none text-slate-700 text-[15px] leading-relaxed placeholder-slate-400 bg-transparent focus:outline-none" 
                                placeholder="Ketik atau tempel teks dokumen yang ingin Anda parafrase di sini. AI akan menulis ulang teks tersebut untuk menghindari deteksi AI/Plagiasi..."
                            />
                        </div>
                        <div className="p-3 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-400 bg-slate-50/50">
                            <span>{countWords(inputText)} kata</span>
                        </div>
                    </div>

                    {/* Output Pane */}
                    <div className="flex flex-col relative bg-gradient-to-br from-slate-50/30 to-indigo-50/10">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-sm font-bold text-indigo-700 flex items-center gap-2 uppercase tracking-wide">
                                <Sparkles className="w-4 h-4 text-indigo-500" /> Hasil Parafrase
                            </h2>
                            <button 
                                onClick={handleCopy} 
                                disabled={!outputText || isProcessing}
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent" 
                                title="Salin ke Papan Klip"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="flex-grow p-5 relative">
                            
                            {/* Empty State */}
                            {!isProcessing && !outputText && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-6 text-center pointer-events-none animate-in fade-in duration-500">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <FileText className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="text-sm font-medium">Teks hasil parafrase yang aman & profesional<br/>akan ditampilkan di sini.</p>
                                </div>
                            )}

                            {/* Skeleton Loader */}
                            {isProcessing && (
                                <div className="absolute inset-0 p-5 w-full h-full bg-white/80 backdrop-blur-sm z-10 flex flex-col gap-3 animate-pulse">
                                    <div className="h-3 bg-slate-200 rounded-full w-3/4"></div>
                                    <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                                    <div className="h-3 bg-slate-200 rounded-full w-5/6"></div>
                                    <div className="h-3 bg-slate-200 rounded-full w-full"></div>
                                    <div className="h-3 bg-slate-200 rounded-full w-2/3"></div>
                                    <div className="h-3 bg-slate-200 rounded-full w-full mt-4"></div>
                                    <div className="h-3 bg-slate-200 rounded-full w-4/5"></div>
                                </div>
                            )}

                            {/* Textarea Output */}
                            <textarea 
                                value={outputText}
                                readOnly
                                className="w-full h-full resize-none text-slate-800 text-[15px] leading-relaxed bg-transparent focus:outline-none" 
                            />
                        </div>

                        <div className="p-3 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-400 bg-slate-50/50">
                            <span>{countWords(outputText)} kata</span>
                            {outputText && !isProcessing && (
                                <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 animate-in fade-in zoom-in duration-300">
                                    <ShieldCheck className="w-3.5 h-3.5" /> 100% Unique
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* --- UPGRADE MODAL --- */}
            {showUpgradeModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300 relative">
                        <button 
                            onClick={() => setShowUpgradeModal(false)}
                            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10 p-1 bg-black/20 rounded-full backdrop-blur-md"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        
                        <div className="bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500 via-purple-600 to-slate-900 p-8 text-white text-center">
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md mx-auto mb-5 border border-white/20 shadow-inner">
                                <Crown className="w-8 h-8 text-amber-300" />
                            </div>
                            <h3 className="text-3xl font-bold mb-2 tracking-tight">Upgrade ke Pro</h3>
                            <p className="text-indigo-100 text-sm font-medium">Buka gaya bahasa eksklusif & algoritma cerdas.</p>
                        </div>
                        
                        <div className="p-8">
                            <ul className="space-y-4 mb-8">
                                <li className="flex items-start gap-3 text-slate-600 text-sm font-semibold">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>Akses ke gaya bahasa <span className="text-slate-900">Ilmiah, Profesional, & Kreatif</span></span>
                                </li>
                                <li className="flex items-start gap-3 text-slate-600 text-sm font-semibold">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>Algoritma bypass tingkat lanjut (Sulit dideteksi AI checker)</span>
                                </li>
                                <li className="flex items-start gap-3 text-slate-600 text-sm font-semibold">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span>Penjabaran singkatan otomatis (Baku & Rapih)</span>
                                </li>
                            </ul>
                            
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 flex justify-between items-center shadow-sm">
                                <div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Paket Akses</div>
                                    <div className="text-3xl font-black text-slate-900 tracking-tight">Rp 25K<span className="text-sm font-semibold text-slate-500"> / 14 Hari</span></div>
                                </div>
                                <div className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Terlaris</div>
                            </div>

                            {!user || user.isAnonymous ? (
                                <button 
                                    onClick={handleLogin}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                                >
                                    <UserCircle className="w-5 h-5" /> Login untuk Membeli
                                </button>
                            ) : (
                                <button 
                                    onClick={handlePayment}
                                    disabled={isProcessingPayment}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transform active:scale-95 disabled:opacity-70"
                                >
                                    {isProcessingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                    Bayar via Bayar.GG
                                </button>
                            )}
                            <p className="text-center text-[11px] font-semibold text-slate-400 mt-4 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                                <Lock className="w-3.5 h-3.5" /> Pembayaran Terenkripsi Aman
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOAST NOTIFICATION --- */}
            <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl font-medium text-sm transition-all duration-300 z-50 ${
                toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            } ${
                toast.type === 'error' ? 'bg-red-900 text-white' : 'bg-slate-900 text-white'
            }`}>
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                {toast.message}
            </div>

        </div>
    );
}

