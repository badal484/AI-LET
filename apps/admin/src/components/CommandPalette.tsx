'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bot,
  BookOpen,
  Sparkles,
  Mic,
  Compass,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  CreditCard,
  Bell,
  Code2,
  Settings,
  Plus,
  ArrowRight,
  Command,
} from 'lucide-react';

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  action: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateModal?: () => void;
}> = ({ isOpen, onClose, onOpenCreateModal }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = [
    {
      id: 'create_character',
      category: 'Smart Actions',
      title: 'Create New AI Companion',
      subtitle: 'Build avatar, backstory, personality & domain skills',
      icon: Plus,
      action: () => {
        onClose();
        if (onOpenCreateModal) {
          onOpenCreateModal();
        } else {
          router.push('/characters');
        }
      },
      keywords: ['new', 'add', 'character', 'avatar', 'companion', 'bot'],
    },
    {
      id: 'train_rag',
      category: 'Smart Actions',
      title: 'Train Knowledge & Domain RAG',
      subtitle: 'Upload documents, PDFs or custom domain lore for characters',
      icon: BookOpen,
      action: () => {
        onClose();
        router.push('/ai/knowledge');
      },
      keywords: ['train', 'knowledge', 'rag', 'pdf', 'document', 'domain', 'astrology', 'fitness'],
    },
    {
      id: 'characters',
      category: 'AI Companion Studio',
      title: 'Characters & Avatars Studio',
      subtitle: 'Manage prompts, avatars, sliders and publish status',
      icon: Bot,
      action: () => {
        onClose();
        router.push('/characters');
      },
      keywords: ['characters', 'avatars', 'bots', 'prompt', 'personality', 'companions'],
    },
    {
      id: 'voice',
      category: 'AI Companion Studio',
      title: 'Voice & Speech Studio',
      subtitle: 'Configure ElevenLabs, Cartesia voice models and preview TTS',
      icon: Mic,
      action: () => {
        onClose();
        router.push('/voice');
      },
      keywords: ['voice', 'speech', 'audio', 'tts', 'elevenlabs', 'cartesia'],
    },
    {
      id: 'simulation',
      category: 'AI Companion Studio',
      title: 'Simulation Sandbox & Goals',
      subtitle: 'Simulate multi-turn bot chats and evaluate emotional consistency',
      icon: Sparkles,
      action: () => {
        onClose();
        router.push('/character-simulation');
      },
      keywords: ['test', 'simulate', 'sandbox', 'evaluate', 'benchmark'],
    },
    {
      id: 'dashboard',
      category: 'Analytics & Growth',
      title: 'Command Center Overview',
      subtitle: 'Live DAU, active chats, daily revenue & system alerts',
      icon: TrendingUp,
      action: () => {
        onClose();
        router.push('/');
      },
      keywords: ['dashboard', 'home', 'overview', 'dau', 'messages', 'active users'],
    },
    {
      id: 'ai_economics',
      category: 'Analytics & Growth',
      title: 'AI Economics & Token Costs',
      subtitle: 'Token consumption, provider pricing and gross margins',
      icon: DollarSign,
      action: () => {
        onClose();
        router.push('/analytics/ai-economics');
      },
      keywords: ['cost', 'token', 'pricing', 'margins', 'economics', 'openai', 'anthropic'],
    },
    {
      id: 'discovery',
      category: 'Mobile Experience',
      title: 'Discovery & Home Screen Curation',
      subtitle: 'Manage mobile hero banners, category rank & featured companions',
      icon: Compass,
      action: () => {
        onClose();
        router.push('/discovery');
      },
      keywords: ['discovery', 'home', 'banners', 'featured', 'mobile', 'curation'],
    },
    {
      id: 'notifications',
      category: 'Mobile Experience',
      title: 'Proactive Notifications & Campaigns',
      subtitle: 'Set up autonomous daily check-ins and push notifications',
      icon: Bell,
      action: () => {
        onClose();
        router.push('/notifications');
      },
      keywords: ['notifications', 'push', 'proactive', 'campaigns', 'alerts'],
    },
    {
      id: 'users',
      category: 'Trust & Community',
      title: 'User Management & Accounts',
      subtitle: 'Search user profiles, memories, chat logs and access control',
      icon: Users,
      action: () => {
        onClose();
        router.push('/users');
      },
      keywords: ['users', 'members', 'accounts', 'banned', 'profiles'],
    },
    {
      id: 'monetization',
      category: 'Trust & Community',
      title: 'Monetization & VIP Plans',
      subtitle: 'Subscriptions, credit packages, gifts and Stripe/App store payments',
      icon: CreditCard,
      action: () => {
        onClose();
        router.push('/monetization');
      },
      keywords: ['monetization', 'subscription', 'billing', 'vip', 'credits', 'stripe'],
    },
    {
      id: 'moderation',
      category: 'Trust & Community',
      title: 'Moderation & Safety Queue',
      subtitle: 'Toxicity filters, jailbreak attempts and reported content',
      icon: ShieldCheck,
      action: () => {
        onClose();
        router.push('/moderation');
      },
      keywords: ['moderation', 'safety', 'nsfw', 'jailbreak', 'reports'],
    },
    {
      id: 'developer',
      category: 'Advanced Tools',
      title: 'Developer Platform & API Keys',
      subtitle: 'Manage public API tokens, webhooks and integrations',
      icon: Code2,
      action: () => {
        onClose();
        router.push('/developer-platform');
      },
      keywords: ['developer', 'api', 'keys', 'webhooks', 'sdk'],
    },
    {
      id: 'infrastructure',
      category: 'Advanced Tools',
      title: 'System Infrastructure & Health',
      subtitle: 'Database status, Redis cache, vector DB and emergency switches',
      icon: Settings,
      action: () => {
        onClose();
        router.push('/infrastructure');
      },
      keywords: ['infra', 'redis', 'postgres', 'cluster', 'system', 'killswitch'],
    },
  ];

  const filteredItems = items.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.keywords?.some(k => k.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#0F131D',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(168, 85, 247, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid #1E293B',
          }}
        >
          <Search size={20} color="#A855F7" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, character name, or task... (e.g. 'train knowledge')"
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: '16px',
              fontFamily: 'inherit',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              padding: '3px 7px',
              backgroundColor: '#1E293B',
              color: '#94A3B8',
              borderRadius: '6px',
              fontWeight: '600',
            }}
          >
            ESC
          </span>
        </div>

        {/* Results List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px',
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748B' }}>
              <p style={{ fontSize: '14px', margin: 0 }}>No matching commands or pages found.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#A855F7' : '#1A202C',
                        color: isSelected ? '#FFFFFF' : '#A855F7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: isSelected ? '#FFFFFF' : '#E2E8F0' }}>
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '600',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            color: '#94A3B8',
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  {isSelected && <ArrowRight size={16} color="#C084FC" />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            backgroundColor: '#090D15',
            borderTop: '1px solid #1E293B',
            fontSize: '12px',
            color: '#64748B',
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <span><strong style={{ color: '#CBD5E1' }}>↑↓</strong> navigate</span>
            <span><strong style={{ color: '#CBD5E1' }}>↵</strong> select</span>
            <span><strong style={{ color: '#CBD5E1' }}>esc</strong> dismiss</span>
          </div>
          <span style={{ color: '#A855F7', fontWeight: '500' }}>✦ AI Smart Omnibar</span>
        </div>
      </div>
    </div>
  );
};
