/**
 * DanmakuOverlay - Floating Tips Component for Advice 3C Scene
 * Shows suggestion prompts floating across the screen to guide users on what to ask
 */

import React, { useEffect, useState, useRef } from 'react';

interface DanmakuItem {
  id: number;
  text: string;
  top: number;      // Vertical position percentage
  duration: number; // Animation duration (seconds)
  color: string;    // Text color
  startTime: number;
}

interface DanmakuOverlayProps {
  /** Whether to enable danmaku */
  enabled?: boolean;
  /** Danmaku emission interval (ms) */
  interval?: number;
  /** Whether to pause when AI is speaking or user is talking */
  isPaused?: boolean;
}

// IT & Electronics shopping suggestion prompts based on actual database
const ADVICE_3C_SUGGESTIONS = [
  // Apple Products (600 items - largest category)
  "Show me iPad with A16 chip",
  "I want to see MacBook Air",
  "Any deals on AirPods?",
  "Show me iPhone 16 Pro",
  "What Apple Watch models do you have?",

  // Notebooks (366 items) - Top brands: ASUS, HP, MSI, LENOVO, ACER
  "Show me ASUS gaming laptops",
  "I need an HP laptop for work",
  "What MSI notebooks do you have?",
  "Lenovo ThinkPad recommendations?",
  "Acer laptop under 20,000 baht",

  // Computer Hardware (1354 items) - VGA, CPU, RAM
  "Show me RTX 5080 graphics cards",
  "I want to see RTX 5060 Ti",
  "What GIGABYTE motherboards are available?",
  "I need DDR5 RAM for gaming",

  // Monitors (276 items)
  "Show me Samsung monitors",
  "Gaming monitor 144Hz or higher?",
  "ASUS ROG monitor for esports",
  "27 inch monitor recommendations",

  // Mouse & Keyboard
  "Show me Logitech G Pro mouse",
  "NUBWO gaming mouse options?",
  "Mechanical keyboard with RGB",
  "Wireless keyboard and mouse combo",
  "SIGNO mouse under 500 baht",

  // Storage (361 items)
  "I need a 2TB SSD",
  "WD Black SN850 available?",
  "SanDisk flash drive options",
  "Kingston SSD for laptop",

  // Network (238 wireless + 154 wired)
  "TP-Link WiFi router recommendations",
  "Show me WiFi access points",
  "I need a network switch",

  // Smart Devices
  "Xiaomi Smart Band available?",
  "Show me smart watches",
  "Smart home devices available?",

  // Audio (headset + speaker)
  "JBL speakers in stock?",
  "Wireless headphones for gaming",
  "Show me microphones for streaming",

  // Promotions & Deals
  "What products are on sale?",
  "Show me the best discounts",
  "Any promotions on laptops?",

  // CCTV & Security (366 items)
  "EZVIZ smart camera options?",
  "Dahua CCTV systems available?",
  "Wireless security camera",

  // Printers (257 items)
  "Brother printer for home use",
  "Epson inkjet printers",
  "HP LaserJet available?",
];

const COLORS = [
  '#FFFFFF',     // White
  '#A7F3D0',     // Green-200
  '#BFDBFE',     // Blue-200
  '#FDE047',     // Yellow-300
  '#F9A8D4',     // Pink-300
  '#C4B5FD',     // Purple-300
  '#FCA5A5',     // Red-300
  '#67E8F9',     // Cyan-300
];

export const DanmakuOverlay: React.FC<DanmakuOverlayProps> = ({
  enabled = true,
  interval = 3500,
  isPaused = false,
}) => {
  const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
  const idCounterRef = useRef(0);
  const currentIndexRef = useRef(0);

  // Shuffle suggestions on mount for variety
  const suggestionsRef = useRef<string[]>([]);
  useEffect(() => {
    suggestionsRef.current = [...ADVICE_3C_SUGGESTIONS].sort(() => Math.random() - 0.5);
  }, []);

  // Emit danmaku periodically
  useEffect(() => {
    if (!enabled || isPaused) {
      return;
    }

    const addDanmaku = () => {
      const list = suggestionsRef.current;
      if (!list.length) return;

      const text = list[currentIndexRef.current % list.length];
      currentIndexRef.current++;

      const newDanmaku: DanmakuItem = {
        id: idCounterRef.current++,
        text,
        top: 10 + Math.random() * 55, // 10% to 65% from top
        duration: 12 + Math.random() * 6, // 12-18 seconds
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        startTime: Date.now(),
      };

      setDanmakus(prev => [...prev, newDanmaku]);

      // Remove after animation ends
      setTimeout(() => {
        setDanmakus(prev => prev.filter(d => d.id !== newDanmaku.id));
      }, newDanmaku.duration * 1000 + 1000);
    };

    // Emit first one immediately
    addDanmaku();

    // Periodic emission
    const timer = setInterval(addDanmaku, interval);
    return () => clearInterval(timer);
  }, [enabled, isPaused, interval]);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        @keyframes advice3c-danmaku-move {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(calc(-100vw - 100%));
          }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9998,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
        {danmakus.map(danmaku => (
          <div
            key={danmaku.id}
            style={{
              position: 'absolute',
              top: `${danmaku.top}%`,
              left: '100%',
              whiteSpace: 'nowrap',
              color: danmaku.color,
              fontSize: '20px',
              fontWeight: 600,
              textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
              animation: `advice3c-danmaku-move ${danmaku.duration}s linear forwards`,
              padding: '6px 16px',
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            🛒 {danmaku.text}
          </div>
        ))}
      </div>
    </>
  );
};

export default DanmakuOverlay;
