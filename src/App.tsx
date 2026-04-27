/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  Send, 
  Image as ImageIcon, 
  Cpu, 
  Twitter, 
  Instagram, 
  Dribbble, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Menu,
  X,
  Layout,
  MessageSquare,
  Smartphone,
  Layers,
  Star,
  Quote,
  Lightbulb,
  CreditCard,
  Monitor,
  Box,
  Dice5,
  Focus
} from 'lucide-react';
import { db, auth } from './lib/firebase';
import { collection, addDoc, serverTimestamp, getDocFromServer, doc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { generateDesignDescription, generateBriefSuggestions } from './services/geminiService';
import Markdown from 'react-markdown';

// --- Types ---

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  accent: string;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  content: string;
  rating: number;
  projectId?: string;
  avatar: string;
}

enum RequestStatus {
  IDLE = 'IDLE',
  SUBMITTING = 'SUBMITTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// --- Data ---

const PORTFOLIO_ITEMS: PortfolioItem[] = [
  {
    id: '1',
    title: 'Pulse 2026',
    description: 'Dynamic visual identity for a neon-weighted music festival.',
    category: 'Branding',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800',
    accent: 'blue'
  },
  {
    id: '2',
    title: 'Ethereal Cinema',
    description: 'Minimalist typography poster for an independent film studio.',
    category: 'Poster',
    imageUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800',
    accent: 'purple'
  },
  {
    id: '3',
    title: 'Onyx Coffee Co.',
    description: 'Premium black-on-black packaging design with gold foil accents.',
    category: 'Packaging',
    imageUrl: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=800',
    accent: 'emerald'
  },
  {
    id: '4',
    title: 'Cyberpunk UI',
    description: 'Futuristic health-tracking dashboard for athletes.',
    category: 'UI/UX',
    imageUrl: 'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&q=80&w=800',
    accent: 'orange'
  }
];

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Sarah Jenkins',
    role: 'Marketing Director',
    company: 'Peak Systems',
    content: "Creatify transformed our brand into something that feels truly premium. The attention to detail is unmatched in the industry.",
    rating: 5,
    projectId: '3',
    avatar: 'https://i.pravatar.cc/150?u=sarah'
  },
  {
    id: 't2',
    name: 'Marcus Thorne',
    role: 'Founder',
    company: 'NeoDynamics',
    content: "The AI briefing tool helped me articulate my vision far better than I could have on my own. The results were spot on.",
    rating: 5,
    avatar: 'https://i.pravatar.cc/150?u=marcus'
  }
];

const MOCKUP_TEMPLATES = [
  { id: 'poster', name: 'Wall Poster', icon: Layout },
  { id: 'phone', name: 'Mobile App', icon: Smartphone },
  { id: '3d_logo', name: '3D Extruded Logo', icon: Focus },
  { id: '3d_box', name: '3D Product Box', icon: Box },
  { id: '3d_scene', name: '3D Digital Scene', icon: Dice5 },
  { id: 'card_front_back', name: 'Business Card (F&B)', icon: CreditCard },
  { id: 'card_luxury', name: 'Luxury Business Card', icon: CreditCard },
  { id: 'banner_custom', name: 'Custom Social Banner', icon: Monitor },
];

export default function App() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>(RequestStatus.IDLE);
  const [mockupView, setMockupView] = useState('poster');
  const [mockupSettings, setMockupSettings] = useState({
    cardFront: PORTFOLIO_ITEMS[2].imageUrl,
    cardBack: PORTFOLIO_ITEMS[0].imageUrl,
    bannerBg: PORTFOLIO_ITEMS[1].imageUrl,
    bannerText: 'ONYX DESIGN',
    bannerSubtext: 'COLLECTIVE STUDIO'
  });
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    designType: 'Poster',
    details: '',
    budget: '$500 - $1k'
  });
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        console.warn("Connection test failed (expected):", error);
      }
    };
    checkConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const categories = ['All', ...Array.from(new Set(PORTFOLIO_ITEMS.map(i => i.category)))];
  
  const toggleCategory = (cat: string) => {
    if (cat === 'All') {
      setSelectedCategories(['All']);
    } else {
      setSelectedCategories(prev => {
        const withoutAll = prev.filter(p => p !== 'All');
        if (withoutAll.includes(cat)) {
          const next = withoutAll.filter(p => p !== cat);
          return next.length === 0 ? ['All'] : next;
        } else {
          return [...withoutAll, cat];
        }
      });
    }
  };

  const filteredItems = PORTFOLIO_ITEMS.filter(item => {
    const matchesCategory = selectedCategories.includes('All') || selectedCategories.includes(item.category);
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAiRefine = async () => {
    if (!ideaPrompt.trim()) return;
    setIsGenerating(true);
    const suggestions = await generateBriefSuggestions(ideaPrompt);
    setAiSuggestions(suggestions);
    setIsGenerating(false);
  };

  const handleAiAutoFill = async () => {
    if (!ideaPrompt.trim()) return;
    setIsGenerating(true);
    const expanded = await generateDesignDescription(ideaPrompt);
    setFormData(prev => ({ ...prev, details: expanded || prev.details }));
    setIsGenerating(false);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestStatus(RequestStatus.SUBMITTING);
    try {
      await addDoc(collection(db, 'requests'), {
        ...formData,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setRequestStatus(RequestStatus.SUCCESS);
      setTimeout(() => setRequestStatus(RequestStatus.IDLE), 5000);
      setFormData({ name: '', email: '', designType: 'Poster', details: '', budget: '$500 - $1k' });
      setIdeaPrompt('');
      setAiSuggestions(null);
    } catch (error) {
      console.error("Submission Error:", error);
      setRequestStatus(RequestStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep selection:bg-brand-blue/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="mesh-gradient top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-blue/20 rounded-full blur-[120px]"></div>
      <div className="mesh-gradient bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-purple/20 rounded-full blur-[120px]"></div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass px-10 py-6 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-brand-blue to-brand-purple rounded-lg rotate-12 group-hover:rotate-0 transition-transform"></div>
          <span className="text-xl font-bold tracking-tight italic text-white font-display">CREATIFY</span>
        </div>

        <div className="hidden md:flex items-center gap-10 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
          {['Portfolio', 'Mockups', 'Brief', 'Reviews', 'Contact'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} className="hover:text-white transition-colors">{link}</a>
          ))}
          <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
          {user ? (
            <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white/20" />
          ) : (
            <button onClick={login} className="text-white hover:text-brand-blue transition-colors">LOGIN</button>
          )}
        </div>

        <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-0 z-40 bg-bg-deep/95 backdrop-blur-3xl pt-32 px-10 flex flex-col gap-8 text-4xl font-display"
          >
            {['Portfolio', 'Mockups', 'Brief', 'Reviews', 'Contact'].map(link => (
              <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setIsMenuOpen(false)}>{link}</a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="h-screen flex items-center px-10 max-w-7xl mx-auto">
          <div className="w-full">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <div className="flex items-center gap-4 mb-6 opacity-60">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-[10px] uppercase tracking-[0.3em] font-medium">Available for new requests</span>
              </div>
              <h1 className="text-7xl md:text-[10rem] font-bold tracking-tighter leading-[0.8] mb-12">
                DESIGN <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-brand-purple to-white">ELATED</span>
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
                <p className="text-white/40 text-lg md:text-xl max-w-md leading-relaxed">
                  High-end branding, posters, and digital art tailored for visionary brands that dare to disrupt.
                </p>
                <div className="flex gap-4">
                  <a href="#brief" className="px-10 py-5 bg-brand-blue hover:bg-brand-blue/80 text-white font-bold rounded-2xl transition-all shadow-xl shadow-brand-blue/20">
                    START PROJECT
                  </a>
                  <a href="#portfolio" className="px-10 py-5 border border-white/10 hover:bg-white/5 text-white font-bold rounded-2xl transition-all">
                    EXPLORE WORKS
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Portfolio Section */}
        <section id="portfolio" className="py-32 px-10 max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8"
          >
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.4em] text-brand-blue font-bold mb-4">GALLERY</p>
              <h3 className="text-5xl md:text-6xl font-bold font-display mb-8">Featured Works</h3>
              <div className="relative max-w-md">
                <input 
                  type="text" 
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end max-w-md">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${selectedCategories.includes(cat) ? 'bg-white text-black' : 'border border-white/10 text-white/40 hover:border-white/30'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </motion.div>

          <div className="grid grid-cols-12 gap-8">
            {filteredItems.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`group relative overflow-hidden rounded-[32px] border border-white/5 ${idx % 3 === 0 ? 'col-span-12 md:col-span-8 h-[500px]' : 'col-span-12 md:col-span-4 h-[500px]'}`}
              >
                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-transparent to-transparent opacity-90 transition-opacity"></div>
                <div className="absolute bottom-10 left-10">
                  <span className={`text-[10px] font-bold uppercase tracking-widest mb-3 block text-brand-${item.accent || 'blue'}`}>{item.category}</span>
                  <h4 className="text-3xl font-bold tracking-tight">{item.title}</h4>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mockup System */}
        <motion.section 
          id="mockups" 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="py-32 bg-white/5 border-y border-white/5 px-10"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
             <motion.div 
               initial={{ opacity: 0, x: -30 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               className="relative aspect-square glass rounded-[48px] flex items-center justify-center p-12"
             >
               <AnimatePresence mode="wait">
                 <motion.div 
                   key={mockupView}
                   initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
                   animate={{ opacity: 1, scale: 1, rotate: 0 }}
                   exit={{ opacity: 0, scale: 1.1, rotate: 5 }}
                   className="w-full h-full relative"
                 >
                   {mockupView === 'poster' && (
                     <div className="w-full h-full bg-zinc-900 border-[16px] border-zinc-800 shadow-3xl rounded-sm overflow-hidden">
                        <img src={PORTFOLIO_ITEMS[1].imageUrl} className="w-full h-full object-cover grayscale-[0.2]" alt="mockup" />
                     </div>
                   )}
                   {mockupView === 'phone' && (
                     <div className="w-[300px] h-[600px] mx-auto bg-zinc-900 border-[12px] border-zinc-800 rounded-[56px] shadow-3xl relative overflow-hidden">
                        <img src={PORTFOLIO_ITEMS[3].imageUrl} className="w-full h-full object-cover" alt="mockup" />
                     </div>
                   )}
                   {mockupView === '3d_logo' && (
                     <div className="flex items-center justify-center h-full perspective-1000">
                        <motion.div 
                          initial={{ rotateX: 0, rotateY: -30 }}
                          animate={{ rotateY: 30 }}
                          transition={{ duration: 4, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
                          className="relative w-64 h-64 flex items-center justify-center"
                        >
                          {/* Simulated 3D Extraction */}
                          {[...Array(20)].map((_, i) => (
                            <div 
                              key={i}
                              className="absolute w-full h-full border-4 border-brand-blue rounded-3xl"
                              style={{ 
                                transform: `translateZ(${-i * 2}px)`,
                                opacity: 1 - (i * 0.04),
                                boxShadow: i === 0 ? '0 0 50px rgba(59,130,246,0.5)' : 'none'
                              }}
                            >
                              <div className="w-full h-full flex items-center justify-center">
                                <Palette className="w-24 h-24 text-brand-blue/50" />
                              </div>
                            </div>
                          ))}
                        </motion.div>
                     </div>
                   )}
                   {mockupView === '3d_box' && (
                     <div className="flex items-center justify-center h-full perspective-2000">
                        <motion.div 
                          className="relative w-64 h-80 bg-zinc-900 shadow-2xl preserve-3d"
                          animate={{ rotateY: [0, 360] }}
                          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                        >
                          {/* Front */}
                          <div className="absolute inset-0 bg-brand-purple border border-white/20 translate-z-[50px] overflow-hidden">
                             <img src={PORTFOLIO_ITEMS[2].imageUrl} className="w-full h-full object-cover opacity-60" alt="front" />
                             <div className="absolute bottom-4 left-4 font-bold text-xs uppercase tracking-widest">Premium Blend</div>
                          </div>
                          {/* Back */}
                          <div className="absolute inset-0 bg-zinc-800 border border-white/20 -translate-z-[50px] rotate-y-180"></div>
                          {/* Right */}
                          <div className="absolute top-0 bottom-0 w-[100px] bg-zinc-800 border border-white/20 left-full -translate-x-1/2 rotate-y-90"></div>
                          {/* Left */}
                          <div className="absolute top-0 bottom-0 w-[100px] bg-zinc-800 border border-white/20 right-full translate-x-1/2 -rotate-y-90"></div>
                        </motion.div>
                     </div>
                   )}
                   {mockupView === '3d_scene' && (
                     <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/10 to-brand-purple/10"></div>
                        <motion.div 
                          animate={{ y: [0, -20, 0] }}
                          transition={{ duration: 6, repeat: Infinity }}
                          className="relative z-10 w-4/5 h-4/5 rounded-[40px] overflow-hidden border border-white/20 shadow-4xl rotate-y-12 shadow-brand-blue/20"
                        >
                           <img src={PORTFOLIO_ITEMS[0].imageUrl} className="w-full h-full object-cover" alt="art" />
                           <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                           <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-12">
                              <h4 className="text-4xl font-black italic tracking-tighter mb-4">DIGITAL HORIZON</h4>
                              <div className="w-24 h-1 bg-brand-blue rounded-full"></div>
                           </div>
                        </motion.div>
                        {/* Decorative Floaties */}
                        <div className="absolute top-10 left-10 w-12 h-12 bg-brand-blue/20 blur-xl rounded-full animate-pulse"></div>
                        <div className="absolute bottom-10 right-10 w-32 h-32 bg-brand-purple/10 blur-3xl rounded-full"></div>
                     </div>
                   )}
                   {mockupView === 'card_front_back' && (
                     <div className="w-full h-full flex flex-col justify-center gap-8 px-8">
                        <div className="w-full h-[180px] bg-zinc-900 border border-white/20 shadow-2xl rounded-xl relative overflow-hidden group cursor-pointer">
                           <img src={mockupSettings.cardFront} className="w-full h-full object-cover" alt="card front" />
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] uppercase tracking-widest font-bold">Front Face</div>
                        </div>
                        <div className="w-full h-[180px] bg-zinc-900 border border-white/20 shadow-2xl rounded-xl relative overflow-hidden group cursor-pointer self-end">
                           <img src={mockupSettings.cardBack} className="w-full h-full object-cover" alt="card back" />
                           <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] uppercase tracking-widest font-bold">Back Face</div>
                        </div>
                     </div>
                   )}
                   {mockupView === 'banner_custom' && (
                     <div className="w-full aspect-[21/9] my-auto bg-zinc-900 border border-white/10 shadow-3xl rounded-[32px] relative overflow-hidden group">
                        <img src={mockupSettings.bannerBg} className="w-full h-full object-cover opacity-60" alt="banner bg" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                        <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-12">
                           <motion.h4 
                            key={mockupSettings.bannerText}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-5xl md:text-6xl font-black tracking-tighter mb-4 uppercase italic"
                           >
                            {mockupSettings.bannerText}
                           </motion.h4>
                           <p className="text-xs text-white/40 uppercase tracking-[0.6em] font-medium">{mockupSettings.bannerSubtext}</p>
                        </div>
                        <div className="absolute bottom-6 right-8 text-[8px] font-mono opacity-20 tracking-widest uppercase">MUSTI GRAPHICS INSPIRED</div>
                     </div>
                   )}
                   {mockupView === 'card_luxury' && (
                     <div className="w-[400px] h-[230px] mx-auto bg-zinc-900 border border-white/20 shadow-3xl rounded-xl p-8 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-purple/10 blur-3xl -rotate-45"></div>
                        <div className="flex justify-between items-start relative z-10">
                          <div className="w-12 h-12 bg-gradient-to-br from-brand-purple to-white/10 rounded-lg"></div>
                          <div className="text-[10px] font-mono text-white/40 tracking-widest">LUXURY COLLECTION</div>
                        </div>
                        <div className="relative z-10">
                          <div className="text-2xl font-bold tracking-tight mb-1 font-display">ONYX DESIGN</div>
                          <div className="text-[10px] text-brand-purple font-bold uppercase tracking-[0.3em]">Premium Grade Packaging</div>
                        </div>
                     </div>
                   )}
                   {mockupView === 'banner_wide' && (
                     <div className="w-full h-3/4 my-auto bg-zinc-900 border border-white/10 shadow-3xl rounded-3xl relative overflow-hidden group">
                        <img src={PORTFOLIO_ITEMS[2].imageUrl} className="w-full h-full object-cover opacity-50 scale-110 group-hover:scale-100 transition-transform duration-1000" alt="mockup" />
                        <div className="absolute inset-0 bg-gradient-to-r from-bg-deep via-transparent to-transparent"></div>
                        <div className="absolute inset-0 flex flex-col justify-center px-16">
                           <div className="text-brand-blue font-bold text-[10px] mb-4 tracking-[0.5em] uppercase">Outdoor Media</div>
                           <h4 className="text-4xl font-bold tracking-tighter mb-4 max-w-sm">COMMAND ATTENTION.</h4>
                           <div className="flex gap-4">
                             <div className="w-12 h-1 bg-brand-blue rounded-full"></div>
                             <div className="w-4 h-1 bg-white/20 rounded-full"></div>
                           </div>
                        </div>
                     </div>
                   )}
                   {mockupView === 'banner_social' && (
                     <div className="w-[320px] h-full mx-auto bg-zinc-900 border border-white/10 shadow-3xl rounded-[40px] relative overflow-hidden">
                        <img src={PORTFOLIO_ITEMS[0].imageUrl} className="w-full h-full object-cover grayscale-[0.5]" alt="mockup" />
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                        <div className="absolute bottom-16 left-10 right-10 text-center">
                           <div className="bg-brand-blue px-4 py-2 rounded-full text-[10px] font-bold inline-block mb-4 tracking-widest">UPCOMING EVENT</div>
                           <h4 className="text-3xl font-bold tracking-tight mb-4">PULSE MUSIC FEST</h4>
                           <div className="w-full h-12 bg-white text-black rounded-xl flex items-center justify-center font-bold text-xs">SWIPE UP</div>
                        </div>
                     </div>
                   )}
                   {mockupView === 'layers' && (
                     <div className="w-full h-full relative flex items-center justify-center">
                        {[1, 2, 3].map(i => (
                          <div 
                            key={i}
                            className="absolute bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl w-2/3 h-2/3"
                            style={{ 
                              transform: `translate(${i * 30}px, ${i * -30}px) rotate(${i * 2}deg)`,
                              zIndex: 10 - i,
                              opacity: 1 - (i * 0.25)
                            }}
                          >
                            <img src={PORTFOLIO_ITEMS[0].imageUrl} className="w-full h-full object-cover opacity-60" alt="mockup" />
                          </div>
                        ))}
                     </div>
                   )}
                 </motion.div>
               </AnimatePresence>
             </motion.div>

             <motion.div
               initial={{ opacity: 0, x: 30 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
             >
               <p className="text-[10px] uppercase tracking-[0.4em] text-brand-purple font-bold mb-4">VISUALIZATION</p>
               <h3 className="text-5xl md:text-6xl font-bold font-display mb-8">Real-world Preview</h3>
               <p className="text-white/40 text-lg mb-12 max-w-md">Our integrated mockup system allows you to visualize potential designs in production environments before the first pixel is finalized.</p>
               
               <div className="flex flex-col gap-4">
                 {MOCKUP_TEMPLATES.map((t) => (
                   <motion.button 
                     key={t.id}
                     onClick={() => setMockupView(t.id)}
                     whileHover={{ scale: 1.02, borderColor: 'rgba(255,255,255,0.2)', boxShadow: '0 0 30px rgba(59,130,246,0.1)' }}
                     className={`flex items-center gap-5 p-6 rounded-3xl transition-all ${mockupView === t.id ? 'bg-white/10 border border-white/20' : 'bg-transparent border border-white/5'}`}
                   >
                     <div className={`p-4 rounded-2xl ${mockupView === t.id ? 'bg-brand-purple' : 'bg-white/5'}`}>
                       <t.icon className="w-6 h-6" />
                     </div>
                     <div className="text-left">
                       <div className="font-bold text-sm tracking-wide">{t.name}</div>
                     </div>
                   </motion.button>
                 ))}
               </div>

               {/* Mockup Configuration Controls */}
               <AnimatePresence>
                 {(mockupView === 'card_front_back' || mockupView === 'banner_custom') && (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="mt-12 p-8 glass rounded-[40px] border border-white/10 space-y-6"
                   >
                     <div className="flex items-center gap-3 mb-2">
                        <Palette className="w-4 h-4 text-brand-purple" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Customization</span>
                     </div>
                     
                     {mockupView === 'card_front_back' && (
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Front Image URL</label>
                           <input 
                             type="text" 
                             value={mockupSettings.cardFront}
                             onChange={(e) => setMockupSettings({...mockupSettings, cardFront: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-brand-purple text-xs"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Back Image URL</label>
                           <input 
                             type="text" 
                             value={mockupSettings.cardBack}
                             onChange={(e) => setMockupSettings({...mockupSettings, cardBack: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-brand-purple text-xs"
                           />
                         </div>
                       </div>
                     )}

                     {mockupView === 'banner_custom' && (
                       <div className="space-y-4">
                         <div className="space-y-2">
                           <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Banner Title</label>
                           <input 
                             type="text" 
                             value={mockupSettings.bannerText}
                             onChange={(e) => setMockupSettings({...mockupSettings, bannerText: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-brand-purple text-xs"
                           />
                         </div>
                         <div className="space-y-2">
                           <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold ml-1">Background URL</label>
                           <input 
                             type="text" 
                             value={mockupSettings.bannerBg}
                             onChange={(e) => setMockupSettings({...mockupSettings, bannerBg: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-brand-purple text-xs"
                           />
                         </div>
                       </div>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
             </motion.div>
          </div>
        </motion.section>

        {/* AI Briefing Tool */}
        <motion.section 
          id="brief" 
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="py-32 px-10 max-w-7xl mx-auto"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-5">
              <p className="text-[10px] uppercase tracking-[0.4em] text-brand-blue font-bold mb-4">START PROJECT</p>
                <h3 className="text-5xl font-bold font-display mb-6">Brief Refiner</h3>
                <p className="text-white/40 mb-10 leading-relaxed">Describe your idea, and our AI design consultant will help you uncover details like mood, palette, and audience for a perfect outcome.</p>

                <div className="glass p-8 rounded-[40px]">
                  <div className="flex items-center gap-3 mb-6 text-brand-blue">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">AI Consultant</span>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <input 
                        type="text" 
                        placeholder="Rough idea (e.g. Minimal gym branding)"
                        value={ideaPrompt}
                        onChange={(e) => setIdeaPrompt(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none placeholder:text-white/20 text-sm"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleAiRefine}
                        disabled={isGenerating || !ideaPrompt}
                        className="flex-1 bg-white text-black py-4 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isGenerating ? <Cpu className="w-4 h-4 animate-spin" /> : <><Lightbulb className="w-4 h-4" /> Get Suggestions</>}
                      </button>
                      <button 
                        onClick={handleAiAutoFill}
                        disabled={isGenerating || !ideaPrompt}
                        className="flex-1 border border-white/10 hover:bg-white/5 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {aiSuggestions && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-8 pt-8 border-t border-white/10"
                      >
                        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-4">Recommendations:</p>
                        <div className="text-xs text-white/70 leading-relaxed space-y-2 pros-invert">
                          <Markdown>{aiSuggestions}</Markdown>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
            </div>

            <div className="lg:col-span-7">
              <div className="glass p-12 rounded-[48px] h-full">
                {requestStatus === RequestStatus.SUCCESS ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20">
                    <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-8 border border-green-500/20">
                      <CheckCircle2 className="text-green-500 w-12 h-12" />
                    </div>
                    <h4 className="text-4xl font-bold mb-4 font-display text-white">We're on it!</h4>
                    <p className="text-white/40 max-w-xs">Your brief has been secured. We'll be in touch very soon.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitRequest} className="space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-2">Name</label>
                        <input 
                          type="text" required
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-2">Email</label>
                        <input 
                          type="email" required
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-2">Category</label>
                        <select 
                          value={formData.designType}
                          onChange={(e) => setFormData({...formData, designType: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none appearance-none"
                        >
                          <option>Poster</option><option>Logo</option><option>Banner</option><option>Social Media</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-2">Budget</label>
                        <select 
                          value={formData.budget}
                          onChange={(e) => setFormData({...formData, budget: e.target.value})}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none appearance-none"
                        >
                          <option>$500 - $1k</option><option>$1k - $3k</option><option>$3k+</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-2">Full Project Brief</label>
                      <textarea 
                        required rows={6}
                        value={formData.details}
                        onChange={(e) => setFormData({...formData, details: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-brand-blue outline-none resize-none"
                      ></textarea>
                    </div>

                    <button 
                      type="submit" 
                      disabled={requestStatus === RequestStatus.SUBMITTING}
                      className="w-full py-6 bg-brand-blue hover:bg-brand-blue/80 text-white font-bold rounded-2xl transition-all shadow-xl shadow-brand-blue/20 flex items-center justify-center gap-3 disabled:opacity-50 group"
                    >
                      {requestStatus === RequestStatus.SUBMITTING ? <Cpu className="animate-spin" /> : <>SUBMIT DESIGN REQUEST <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" /></>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Testimonials */}
        <motion.section 
          id="reviews" 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          className="py-32 px-10 max-w-7xl mx-auto border-t border-white/5"
        >
          <div className="text-center mb-24">
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[10px] uppercase tracking-[0.4em] text-brand-blue font-bold mb-4"
            >
              REVIEWS
            </motion.p>
            <motion.h3 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-bold font-display"
            >
              Client Voices
            </motion.h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TESTIMONIALS.map((testi, idx) => (
              <motion.div 
                key={testi.id} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="glass p-12 rounded-[48px] relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Quote className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex gap-1 mb-8">
                    {[...Array(testi.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-brand-blue text-brand-blue" />
                    ))}
                  </div>
                  <p className="text-2xl font-medium leading-relaxed mb-10 text-white/90 italic">"{testi.content}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img src={testi.avatar} alt={testi.name} className="w-12 h-12 rounded-full border border-white/10" />
                      <div>
                        <p className="font-bold text-sm">{testi.name}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">{testi.role}, {testi.company}</p>
                      </div>
                    </div>
                    {testi.projectId && (
                      <a href="#portfolio" className="text-[10px] font-bold text-brand-blue hover:underline uppercase tracking-widest">View Project</a>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Footer */}
        <footer id="contact" className="bg-bg-deep pt-32 pb-16 px-10 border-t border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col items-center">
             <div className="flex items-center gap-3 mb-12">
               <div className="w-8 h-8 bg-gradient-to-tr from-brand-blue to-brand-purple rounded-lg"></div>
               <span className="text-2xl font-bold tracking-tight italic text-white font-display">CREATIFY</span>
             </div>

            <div className="flex gap-8 mb-16">
              {[Twitter, Instagram, Dribbble, MessageSquare].map((Icon, i) => (
                <a key={i} href="#" className="p-4 rounded-full border border-white/10 hover:bg-white/5 transition-all text-white/40 hover:text-white">
                  <Icon className="w-6 h-6" />
                </a>
              ))}
            </div>

            <div className="w-full pt-16 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-mono text-white/20 uppercase tracking-[0.3em] font-medium">
              <p>© 2026 CREATIFY STUDIO — PIXEL PERFECT ALWAYS.</p>
              <div className="flex gap-12">
                <a href="#" className="hover:text-white">Privacy</a>
                <a href="#" className="hover:text-white">Terms</a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

