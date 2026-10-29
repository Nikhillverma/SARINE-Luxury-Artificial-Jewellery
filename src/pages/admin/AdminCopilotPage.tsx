/**
 * AdminCopilotPage for SARINE.
 * Dedicated AI Business Copilot Workspace for executive intelligence, profit analysis,
 * inventory replenishment forecasts, and festival campaign drafting.
 */

import React, { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  Sparkles,
  Send,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Package,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  timestamp: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'copilot',
    text: 'Good morning, Priya! I am your SARINE AI Business Copilot. I have synchronized with your Firestore product catalogue, order velocity, and supplier costs. How can I assist with your store operations today?',
    timestamp: 'Just now'
  }
];

export const AdminCopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (text: string) => {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: 'Just now'
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    setTimeout(() => {
      let responseText = '';
      if (text.includes('Diwali') || text.includes('festival')) {
        responseText =
          '**Diwali Festive Forecast & Strategy:**\n\n' +
          '• **Top Demand Categories:** Polki Chokers (estimated 35% of revenue), Chandbali Earrings (28%), Bangles (22%).\n' +
          '• **Recommended Bundle:** "Meera Royal Polki Set + Crystal Studs" priced at ₹3,299 (20% margin improvement).\n' +
          '• **Stock Safeguard:** Crystal Earrings (SE-001) has only 3 units on hand. Reorder 60 units from Jaipur Atelier by Oct 30.';
      } else if (text.includes('profit') || text.includes('margin')) {
        responseText =
          '**Profitability Breakdown:**\n\n' +
          '• **Highest Margin Piece:** Designer Bangles (Selling ₹2,450, Cost ₹540, Gross Margin 78%).\n' +
          '• **Lowest Margin Piece:** Solid Silver Anklet (Selling ₹999, Cost ₹620, Gross Margin 38%).\n' +
          '• **Action:** Shift 20% of your Instagram ad budget from low-margin single rings to bridal choker sets to maximize net EBITDA.';
      } else if (text.includes('restock') || text.includes('stock')) {
        responseText =
          '**Atelier Replenishment Priority List:**\n\n' +
          '1. **Crystal Earrings (SE-001):** 3 units left (Urgent - 2 days coverage)\n' +
          '2. **Pearl Necklace (PN-002):** 5 units left (4 days coverage)\n' +
          '3. **Gold Bangles (GB-003):** 7 units left (5 days coverage)\n' +
          'Total estimated reorder investment: ₹38,400 with expected revenue of ₹1,42,000.';
      } else {
        responseText =
          `I have analyzed your request regarding "${text}". Across your SARINE catalogue of artificial jewellery, average order value is currently ₹2,499 with 88% prepaid vs 12% COD. Would you like me to draft an email campaign or simulate discount tiers for this line?`;
      }

      const botMsg: ChatMessage = {
        id: `c-${Date.now()}`,
        sender: 'copilot',
        text: responseText,
        timestamp: 'Just now'
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F2E8FA] text-[#78469C] flex items-center justify-center">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif text-2xl font-semibold text-[#2C1838]">
                  AI Business Copilot
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#8660B0] text-white">
                  Live
                </span>
              </div>
              <p className="text-xs text-[#705E7B]">
                Grounded store intelligence powered by SARINE catalogue & sales velocity.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Suggestion Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleSend('Which products are likely to sell well this Diwali?')}
            className="p-3.5 bg-white border border-[#EADFF0] hover:border-[#78469C] rounded-xl text-left text-xs transition-colors cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 font-semibold text-[#563568] mb-1">
              <Sparkles size={14} />
              <span>Festive Forecasting</span>
            </div>
            <p className="text-[11px] text-[#705E7B]">"Which products are likely to sell well this Diwali?"</p>
          </button>

          <button
            onClick={() => handleSend('Show me the most profitable products.')}
            className="p-3.5 bg-white border border-[#EADFF0] hover:border-[#78469C] rounded-xl text-left text-xs transition-colors cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 font-semibold text-[#563568] mb-1">
              <TrendingUp size={14} />
              <span>Margin Optimization</span>
            </div>
            <p className="text-[11px] text-[#705E7B]">"Show me the most profitable products."</p>
          </button>

          <button
            onClick={() => handleSend('Which items need restocking urgently?')}
            className="p-3.5 bg-white border border-[#EADFF0] hover:border-[#78469C] rounded-xl text-left text-xs transition-colors cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 font-semibold text-[#563568] mb-1">
              <AlertTriangle size={14} />
              <span>Inventory Advisor</span>
            </div>
            <p className="text-[11px] text-[#705E7B]">"Which items need restocking urgently?"</p>
          </button>
        </div>

        {/* Chat Conversation Card */}
        <div className="bg-white rounded-2xl border border-[#EADFF0] shadow-2xs overflow-hidden flex flex-col h-[520px]">
          {/* Chat Messages */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'copilot' && (
                  <div className="w-8 h-8 rounded-full bg-[#FAF5FC] border border-[#E7DCEB] flex items-center justify-center text-[#78469C] shrink-0 mt-1">
                    <Sparkles size={16} />
                  </div>
                )}
                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-[#563568] text-white rounded-tr-xs'
                      : 'bg-[#FAF5FC] border border-[#EADFF0] text-[#2C1838] rounded-tl-xs'
                  }`}
                >
                  {m.text}
                  <span
                    className={`block text-[10px] mt-1.5 ${
                      m.sender === 'user' ? 'text-[#D8C4E5] text-right' : 'text-[#8E769E]'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-[#78469C] animate-pulse pl-11">
                <Sparkles size={14} />
                <span>Copilot is formulating store analysis...</span>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="p-4 bg-[#FAF5FC] border-t border-[#EADFF0]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputQuery.trim()) {
                  handleSend(inputQuery.trim());
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask your SARINE copilot about inventory, marketing, campaigns, or margins..."
                className="flex-1 px-4 py-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xl text-xs text-[#2C1838] focus:outline-none shadow-2xs"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="px-5 py-2.5 bg-[#563568] hover:bg-[#78469C] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>Ask</span>
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
