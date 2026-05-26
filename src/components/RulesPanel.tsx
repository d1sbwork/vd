import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  BookOpen, 
  Mail, 
  Copy, 
  Check, 
  MessageSquare, 
  Sparkles,
  AlertTriangle,
  UserCheck,
  Zap,
  ChevronRight,
  Handshake,
  CheckCircle2,
  Send,
  HelpCircle
} from 'lucide-react';

interface RulesPanelProps {
  contactEmail?: string;
  tgLink?: string;
}

export default function RulesPanel({ 
  contactEmail = 'Evgenit2838@gmail.com',
  tgLink = 'https://t.me/BlackoutMg'
}: RulesPanelProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedTg, setCopiedTg] = useState(false);
  const [botActive, setBotActive] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.telegramBotActive === 'boolean') {
          setBotActive(data.telegramBotActive);
        }
      })
      .catch((err) => {
        console.error('Error fetching bot health:', err);
        setBotActive(false);
      });
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyTg = () => {
    navigator.clipboard.writeText(tgLink);
    setCopiedTg(true);
    setTimeout(() => setCopiedTg(false), 2000);
  };

  const rulesList = [
    {
      title: "Уважение и Дисциплина",
      description: "Уважительно относитесь ко всем участникам тренировочного лагеря. Любые формы оскорблений, агрессии, расизма или токсичного поведения в голосовом/текстовом чатах лобби караются немедленным исключением и баном аккаунта.",
      icon: UserCheck,
      color: "text-blue-400 border-blue-500/20 bg-blue-500/5"
    },
    {
      title: "Строгий Fair Play (Честная игра)",
      description: "Использование любых сторонних программ, читов, макросов, скриптов автокликеров, эмуляторов (без явного разрешения в описании лобби) или получение нечестного преимущества через баги игры Standoff 2 категорически запрещено.",
      icon: ShieldCheck,
      color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
    },
    {
      title: "Ответственность Организаторов (Хостов)",
      description: "Хост созданного лобби обязан координировать команду, проверять готовность игроков и вовремя запускать тренировочные сессии. Неактивные, пустые или заброшенные лобби удаляются автоматически или вручную модерацией платформы.",
      icon: Zap,
      color: "text-amber-400 border-amber-500/20 bg-amber-500/5"
    },
    {
      title: "Занятие Игровых Слотов",
      description: "Занимайте свободные слоты в лобби только в том случае, если вы действительно готовы незамедлительно зайти в игру Standoff 2 и начать тренировку. Бесцельное удержание свободных мест мешает другим игрокам.",
      icon: AlertTriangle,
      color: "text-rose-400 border-rose-500/20 bg-rose-500/5"
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/60 p-6 md:p-8 shadow-xl shadow-indigo-950/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.12),transparent)]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">
              <BookOpen className="h-3 w-3" />
              Официальный кодекс
            </span>
            <h1 className="font-sans text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
              Правила <span className="text-blue-500">Платформы</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              Standoff 2 Match Hub создан для соревновательного роста, оттачивания аима и проведения качественных тренировок. Ознакомьтесь с регламентом проведения матчей.
            </p>
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {rulesList.map((rule, idx) => {
          const Icon = rule.icon;
          return (
            <div 
              key={idx} 
              className="flex gap-4 rounded-xl border border-slate-900 bg-slate-950/40 p-5 hover:border-slate-800 transition-all duration-300 group"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border shadow-sm ${rule.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-white group-hover:text-blue-400 transition-colors">
                  {rule.title}
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {rule.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cooperation and Contacts Section */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-900 bg-slate-950/40 p-6 md:p-8">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.05),transparent_45%)]" />
        </div>

        <div className="relative z-10 grid gap-6 md:grid-cols-12 items-center">
          
          {/* Cooperation Message */}
          <div className="md:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-400">
              <Handshake className="h-3 w-3" />
              Сотрудничество
            </div>
            
            <h2 className="text-xl font-black uppercase tracking-tight text-white md:text-2xl">
              Хотите развивать проект <span className="text-purple-400">вместе</span>?
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
              Мы всегда открыты для предложений по рекламе, спонсированию турниров, партнерству с кланами, интеграции с YouTube/Telegram авторами или добавлению нового полезного функционала.
            </p>
            
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Свяжитесь со мной напрямую в Telegram или отправьте ваше коммерческое предложение. Отвечаю на все адекватные инициативы!
            </p>
          </div>

          {/* Contact Actions panel */}
          <div className="md:col-span-5 bg-slate-950 border border-slate-900 p-5 rounded-xl space-y-4 shadow-2xl">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">МОЙ ТЕЛЕГРАМ ДЛЯ СВЯЗИ</span>
              <div className="inline-flex items-center gap-2 text-white font-mono text-sm font-semibold bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800/85 w-full justify-between">
                <span className="truncate text-sky-400 font-bold">@BlackoutMg</span>
                <button
                  onClick={handleCopyTg}
                  className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white cursor-pointer shrink-0"
                  title="Скопировать ник Telegram"
                >
                  {copiedTg ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <a
                href={tgLink}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 border border-sky-500/20 bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-950/20 hover:shadow-sky-500/10 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>НАПИСАТЬ В TELEGRAM</span>
              </a>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-900"></div>
                <span className="flex-shrink mx-3 text-[9px] text-slate-600 uppercase font-black tracking-widest">ИЛИ ПОЧТА</span>
                <div className="flex-grow border-t border-slate-900"></div>
              </div>

              <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] bg-slate-900/40 px-3 py-1.5 rounded border border-slate-900 w-full justify-between">
                <span className="truncate">{contactEmail}</span>
                <button
                  onClick={handleCopyEmail}
                  className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white cursor-pointer shrink-0"
                  title="Скопировать email"
                >
                  {copiedEmail ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3" />}
                </button>
              </div>

              <div className="text-center">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-semibold block mt-1.55">
                  ⚡ Быстрый ответ гарантирован
                </span>
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
