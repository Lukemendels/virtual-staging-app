"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Box,
  Menu,
  PlayCircle,
  Clock,
  CreditCard,
  Lock,
  Wand2,
  LayoutTemplate,
  X,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { toast } from "sonner";

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();

  // Scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAuth = async () => {
    if (user) {
      router.push("/dashboard");
    } else {
      try {
        await signInWithGoogle();
        router.push("/dashboard");
      } catch (error: any) {
        console.error("Login failed:", error);
        toast.error("Login failed", {
          description: "Please check your popup blocker settings."
        });
      }
    }
  };

  const handleBuySingle = async () => {
    try {
      let currentUser = user;

      // 1. Auth Gate
      if (!currentUser) {
        toast.info("Please sign in to secure your purchase.");
        const result = await signInWithGoogle();
        currentUser = result?.user || null;
      }

      // 2. Checkout Flow
      if (currentUser) {
        toast.loading("Preparing checkout...");
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "single", userId: currentUser.uid }),
        });

        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        } else {
          throw new Error("Checkout session failed");
        }
      }
    } catch (error: any) {
      console.error("Purchase flow failed:", error);
      toast.error("Could not initiate purchase.", {
        description: "Please try logging in first via the top right button."
      });
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white min-h-screen font-sans">

      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-md border-b border-slate-800 py-2' : 'bg-transparent py-4'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">

            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Box className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white font-serif tracking-tight">ListingFlow</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#how-it-works" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">How it Works</Link>
              <Link href="#examples" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Before & After</Link>
              <Link href="/credits" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Pricing</Link>
              <button
                onClick={handleAuth}
                className="text-white px-5 py-2 rounded-full border border-slate-700 bg-slate-800/50 hover:bg-indigo-600 hover:border-indigo-500 transition-all text-sm font-medium"
              >
                {user ? "Go to Dashboard" : "Sign In"}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                className="text-slate-400 hover:text-white p-2"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 w-full bg-slate-950 border-b border-slate-800 shadow-2xl md:hidden flex flex-col p-4 space-y-4 animate-in slide-in-from-top-5">
            <Link href="#how-it-works" onClick={closeMobileMenu} className="block px-4 py-3 rounded-lg text-base font-medium text-slate-400 hover:text-white hover:bg-slate-900">How it Works</Link>
            <Link href="#examples" onClick={closeMobileMenu} className="block px-4 py-3 rounded-lg text-base font-medium text-slate-400 hover:text-white hover:bg-slate-900">Before & After</Link>
            <Link href="/credits" onClick={closeMobileMenu} className="block px-4 py-3 rounded-lg text-base font-medium text-slate-400 hover:text-white hover:bg-slate-900">Pricing</Link>
            <button
              onClick={() => { closeMobileMenu(); handleAuth(); }}
              className="w-full text-center px-4 py-3 rounded-lg text-base font-bold bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {user ? "Go to Dashboard" : "Sign In"}
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">

          {/* Location Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 text-indigo-400 text-xs font-semibold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Serving Caroline, Orange, King George & Bealeton
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight max-w-5xl mx-auto font-serif tracking-tight">
            Sell the Dream, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 animate-gradient-x">
              Not the Drywall.
            </span>
          </h1>

          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Premium virtual staging on a <strong>local budget</strong>. <br className="hidden md:block" />
            No subscriptions. No monthly fees. Just upload and sell.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => router.push("/credits")}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] transform hover:-translate-y-0.5 border border-indigo-500 flex items-center justify-center gap-2"
            >
              Stage a Room ($7) <ArrowRight className="w-5 h-5" />
            </button>
            <Link
              href="#examples"
              className="w-full sm:w-auto px-8 py-4 bg-transparent text-slate-300 border border-slate-700 text-lg font-medium rounded-xl hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center gap-2 group"
            >
              <PlayCircle className="w-5 h-5 group-hover:text-indigo-400 transition-colors" /> See Examples
            </Link>
          </div>

          <p className="mt-8 text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-500" /> Trusted by agents in the Greater Fredericksburg Region
          </p>
        </div>

        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950"></div>
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse"></div>
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
        </div>
      </section>

      {/* Features Section - "The Villain" */}
      <section className="py-24 bg-slate-950 border-y border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-serif">Empty Rooms Cost You Showings</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              You know staged homes sell faster. But the traditional options are broken for the modern agent.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 relative overflow-hidden group hover:border-indigo-500/30 transition-all hover:bg-slate-900 hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 group-hover:bg-indigo-500 transition-colors"></div>
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-6 text-indigo-400 group-hover:text-indigo-300">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-serif">The Waiting Game</h3>
              <p className="text-slate-400 leading-relaxed">
                Manual editors take 24-48 hours. You need to list on Friday morning, not wait until Monday afternoon for photos.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 relative overflow-hidden group hover:border-indigo-500/30 transition-all hover:bg-slate-900 hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 group-hover:bg-indigo-500 transition-colors"></div>
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-6 text-indigo-400 group-hover:text-indigo-300">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-serif">The Subscription Trap</h3>
              <p className="text-slate-400 leading-relaxed">
                Why pay $50/month for software you don't use in January? We believe your bill should be $0 when your volume is low.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 relative overflow-hidden group hover:border-indigo-500/30 transition-all hover:bg-slate-900 hover:-translate-y-1">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 group-hover:bg-indigo-500 transition-colors"></div>
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-6 text-indigo-400 group-hover:text-indigo-300">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 font-serif">The "Platform Lock"</h3>
              <p className="text-slate-400 leading-relaxed">
                Zillow's AI traps your photos on their site. You can't put them on Instagram. With us, you own the file forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="py-24 bg-slate-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <span className="text-indigo-400 font-semibold tracking-wider uppercase text-xs">Real Results</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4 font-serif">See the Transformation</h2>
            <p className="text-lg text-slate-400">Drag the slider. Turn "cold" into "sold" in 30 seconds.</p>
          </div>

          <div className="space-y-24">
            {/* Example 1 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="w-full">
                <BeforeAfterSlider
                  beforeImage="/images/basement-before.jpg"
                  afterImage="/images/basement-after.jpg"
                />
              </div>

              <div className="lg:pl-8">
                <div className="bg-indigo-900/30 inline-block p-3 rounded-lg text-indigo-400 mb-4 border border-indigo-500/20">
                  <Wand2 className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 font-serif">The "Problem" Basement</h3>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  Basements feel like dungeons. We added warm lighting, a plush sectional, and cozy textures to turn a cold storage room into a family den.
                </p>
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-inner">
                  <p className="text-xs font-mono text-indigo-400 mb-2 uppercase tracking-wide">Director Mode Command</p>
                  <p className="text-slate-300 font-mono text-sm">"Add warm lighting, a plush sectional, and make it feel like a Friday movie night."</p>
                </div>
              </div>
            </div>

            {/* Example 2 */}
            <div className="grid lg:grid-cols-2 gap-12 items-center lg:flex-row-reverse">
              <div className="lg:order-2 w-full">
                <BeforeAfterSlider
                  beforeImage="/images/living-before.jpg"
                  afterImage="/images/living-after.jpg"
                />
              </div>

              <div className="lg:order-1 lg:pr-8">
                <div className="bg-indigo-900/30 inline-block p-3 rounded-lg text-indigo-400 mb-4 border border-indigo-500/20">
                  <LayoutTemplate className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4 font-serif">Solve the Scale Problem</h3>
                <p className="text-slate-400 mb-6 leading-relaxed">
                  "Will my couch fit?" is the #1 buyer objection. We anchor the room with a properly scaled sectional to prove the space works.
                </p>
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-inner">
                  <p className="text-xs font-mono text-indigo-400 mb-2 uppercase tracking-wide">Director Mode Command</p>
                  <p className="text-slate-300 font-mono text-sm">"Modern sectional, neutral rug, defined living zone."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section - The Guide */}
      <section className="py-24 bg-gradient-to-br from-slate-900 to-slate-950 text-white relative overflow-hidden border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl font-bold mb-6 font-serif">Stop Paying Rent on Your Software.</h2>
          <div className="text-lg text-slate-300 mb-10 leading-relaxed font-light space-y-4">
            <p>
              I’m Luke. I’m not a big tech corporation; I’m a local economist here in Fredericksburg.
            </p>
            <p>
              I built ListingFlow because I saw agents getting squeezed by subscription models that don’t make economic sense.
            </p>
            <p>
              I believe your tools should work like you do: <strong className="text-white font-semibold">On Demand.</strong><br />
              If you don't have a listing, you shouldn't have a bill.
            </p>
          </div>

          <div className="inline-flex items-center gap-4 bg-slate-800/80 pl-2 pr-6 py-2 rounded-full border border-slate-700 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-inner">L</div>
            <div className="text-left">
              <p className="font-bold text-white">Luke Mendelsohn</p>
              <p className="text-indigo-400 text-xs uppercase tracking-wide font-semibold">Founder, ListingFlow</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - The "Excalibur" */}
      <section className="py-24 bg-slate-950" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-serif">The "Just Right" Way to Stage</h2>
            <p className="text-lg text-slate-400">Faster than manual. Safer than Zillow. Cheaper than a subscription.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-6 text-xs font-bold tracking-widest text-slate-500 uppercase border-b border-r border-slate-800 bg-slate-900 w-1/2">The Old Way</th>
                  <th className="p-6 text-xs font-bold tracking-widest text-indigo-400 uppercase border-b border-indigo-500/30 bg-indigo-900/10 w-1/2">The ListingFlow Way</th>
                </tr>
              </thead>
              <tbody className="align-top text-sm md:text-base">
                <tr className="border-b border-slate-800">
                  <td className="p-6 border-r border-slate-800 bg-slate-900/50">
                    <strong className="block text-slate-300 text-lg mb-1">Too Slow</strong>
                    <span className="text-slate-500">Waiting 48 hours for an editor.</span>
                  </td>
                  <td className="p-6 bg-indigo-900/5">
                    <strong className="block text-indigo-300 text-lg mb-1">Instant</strong>
                    <span className="text-slate-400">Get results in 30 seconds.</span>
                  </td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-6 border-r border-slate-800 bg-slate-900/50">
                    <strong className="block text-slate-300 text-lg mb-1">Too Hard</strong>
                    <span className="text-slate-500">Dragging & dropping 3D sofas (DIY Apps).</span>
                  </td>
                  <td className="p-6 bg-indigo-900/5">
                    <strong className="block text-indigo-300 text-lg mb-1">Director Mode</strong>
                    <span className="text-slate-400">Just type "Make it a cozy den".</span>
                  </td>
                </tr>
                <tr className="border-b border-slate-800">
                  <td className="p-6 border-r border-slate-800 bg-slate-900/50">
                    <strong className="block text-slate-300 text-lg mb-1">Too Risky</strong>
                    <span className="text-slate-500">Zillow owns the photo. You can't use it elsewhere.</span>
                  </td>
                  <td className="p-6 bg-indigo-900/5">
                    <strong className="block text-indigo-300 text-lg mb-1">You Own It</strong>
                    <span className="text-slate-400">Download the 4K file. Post to Instagram. Print it.</span>
                  </td>
                </tr>
                <tr>
                  <td className="p-6 border-r border-slate-800 bg-slate-900/50">
                    <strong className="block text-slate-300 text-lg mb-1">Expensive Subscriptions</strong>
                    <span className="text-slate-500">$50/month even if you sell nothing.</span>
                  </td>
                  <td className="p-6 bg-indigo-900/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] px-2 py-0.5 font-bold uppercase tracking-wide rounded-bl">Best Value</div>
                    <strong className="block text-indigo-300 text-lg mb-1">Pay-As-You-Go</strong>
                    <span className="text-slate-400 block mb-2">$7 per single credit.</span>
                    <span className="inline-block bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs px-2 py-1 rounded font-bold">5 Credits for $20</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it Works Section - The Plan */}
      <section id="how-it-works" className="py-24 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-16 font-serif">From "Empty" to "Offer" in 3 Steps</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center px-4 group">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 text-indigo-400 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:border-indigo-500 group-hover:bg-slate-800 transition-all shadow-[0_0_20px_rgba(0,0,0,0.2)]">1</div>
              <h3 className="text-xl font-bold text-white mb-3 font-serif">Upload</h3>
              <p className="text-slate-400">Snap a pic of that dark basement or empty living room with your phone or DSLR.</p>
            </div>
            <div className="text-center px-4 group">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 text-indigo-400 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:border-indigo-500 group-hover:bg-slate-800 transition-all shadow-[0_0_20px_rgba(0,0,0,0.2)]">2</div>
              <h3 className="text-xl font-bold text-white mb-3 font-serif">Direct</h3>
              <p className="text-slate-400">Don't design. Just tell the AI: <em>"Add a modern sectional."</em> You get 3 edits included.</p>
            </div>
            <div className="text-center px-4 group">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 text-indigo-400 rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6 group-hover:border-indigo-500 group-hover:bg-slate-800 transition-all shadow-[0_0_20px_rgba(0,0,0,0.2)]">3</div>
              <h3 className="text-xl font-bold text-white mb-3 font-serif">List</h3>
              <p className="text-slate-400">Download the 4K, MLS-ready image. No watermarks. 100% yours.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-multiply"></div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-black/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 font-serif">Ready to wake up your stale listings?</h2>
          <p className="text-xl text-indigo-100 mb-10 font-light">
            Start with the "Listing Pack" ($20) or just try one room for $7.
          </p>
          <button
            onClick={handleAuth}
            className="inline-block px-10 py-5 bg-white text-indigo-600 text-lg font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-xl transform hover:-translate-y-1"
          >
            Get Started Now
          </button>
          <p className="mt-8 text-indigo-200 text-xs opacity-80 uppercase tracking-widest">
            * Built locally in Fredericksburg, VA
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                  <Box className="text-white w-4 h-4" />
                </div>
                <span className="text-xl font-bold text-white font-serif tracking-tight">ListingFlow</span>
              </div>
              <p className="text-slate-500 mt-4 max-w-xs leading-relaxed">
                Built by a local for locals. Helping agents in Caroline, Orange, King George, and Bealeton save money and sell faster.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><Link href="/credits" className="hover:text-indigo-400 transition-colors">Pricing</Link></li>
                <li><Link href="#examples" className="hover:text-indigo-400 transition-colors">Examples</Link></li>
                <li><button onClick={handleAuth} className="hover:text-indigo-400 transition-colors text-left">Login</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Contact</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><a href="mailto:luke@getlistingflow.com" className="hover:text-indigo-400 transition-colors">luke@getlistingflow.com</a></li>
                <li>Fredericksburg, VA</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-900 pt-8 text-center md:text-left text-slate-600 text-sm">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p>&copy; 2025 Focus Flow Systems LLC. All rights reserved.</p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
