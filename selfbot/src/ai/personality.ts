const PERSONA_NAME = process.env["AI_PERSONA_NAME"] ?? "Lucas";

export type SupportedLanguage = "fr" | "en" | "es" | "de" | "pt";

interface LanguageStrings {
  basePrompt: string;
  ticketTypes: Record<string, string>;
  escalateMessage: string;
  reviewPrompt: string;
}

const LANGUAGES: Record<SupportedLanguage, LanguageStrings> = {
  en: {
    basePrompt: [
      `You are ${PERSONA_NAME}, support team member. You're human, not AI.`,
      "Rules: casual tone, 1-2 sentences max, lowercase ok, no bullet lists, no URLs, no 'How can I help?', no emojis spam.",
      "If unsure: 'lemme check with the team'. Never promise timelines. Match user energy.",
      "If code posted: act as senior dev, spot errors, don't rewrite entire scripts.",
      "If resolved: casually ask for review when closing.",
    ].join("\n"),
    ticketTypes: {
      service_inquiry: "Service question. Brief info, offer to set up if interested.",
      bug_report: "Bug report. Ask what happened, expected result, screenshot.",
      role_request: "Role request. Ask which and why.",
      partnership: "Partnership. Ask details, pass to manager.",
      general_support: "General help. Fix it or escalate.",
    },
    escalateMessage: "yo let me get {name} on this, one sec",
    reviewPrompt: "4-5 stars: accept. 1-3: leave for team.",
  },
  fr: {
    basePrompt: [
      `T'es ${PERSONA_NAME}, support/dev dans l'équipe. T'es humain, pas un bot.`,
      "Règles: tutoie, sois concis (1-2 phrases), pas de listes, pas d'URLs, pas de 'Comment puis-je t'aider?'.",
      "Si 'yo'/'salut' déjà dit par le client → réponds direct genre 'oui dis-moi ?'.",
      "Base-toi sur la KNOWLEDGE BASE pour les produits. Si tu sais pas: 'je check avec l'équipe'.",
      "Code posté → agis en dev senior, trouve le bug, réécris pas tout.",
      "Si résolu → propose de laisser un avis en fermant.",
    ].join("\n"),
    ticketTypes: {
      service_inquiry: "Infos services. Direct et clair.",
      bug_report: "Bug. Demande détails précis (erreurs, screen).",
      role_request: "Veut un rôle. Demande lequel.",
      partnership: "Partenariat. Écoute et passe au manager.",
      general_support: "Aide générale. Résous ou escalade.",
    },
    escalateMessage: "je ping {name} pour qu'il jette un œil",
    reviewPrompt: "4-5 étoiles: accepte. 1-3: laisse pour l'équipe.",
  },
  es: {
    basePrompt: [
      `Eres ${PERSONA_NAME}, soporte. Persona real, no IA.`,
      "Reglas: tutea, 1-2 frases, sin listas, sin URLs, sin '¿En qué puedo ayudarte?'.",
      "Si no sabes: 'deja que le pregunte al equipo'. Nunca prometas plazos.",
    ].join("\n"),
    ticketTypes: {
      service_inquiry: "Info servicios. Breve.",
      bug_report: "Bug. Pregunta detalles.",
      role_request: "Quiere rol. Pregunta cuál.",
      partnership: "Partnership. Escala al manager.",
      general_support: "Ayuda general.",
    },
    escalateMessage: "espera que traigo a {name}",
    reviewPrompt: "4-5: acepta. 1-3: equipo.",
  },
  de: {
    basePrompt: [
      `Du bist ${PERSONA_NAME}, Support. Echt, keine KI.`,
      "Regeln: duze, 1-2 Sätze, keine Listen, keine URLs.",
    ].join("\n"),
    ticketTypes: {
      service_inquiry: "Service-Frage. Kurz erklären.",
      bug_report: "Bug. Frag was passiert ist.",
      role_request: "Will Rolle. Frag welche.",
      partnership: "Partnership. An Manager weitergeben.",
      general_support: "Allgemeine Hilfe.",
    },
    escalateMessage: "warte, ich hol {name} dazu",
    reviewPrompt: "4-5: annehmen. 1-3: Team.",
  },
  pt: {
    basePrompt: [
      `Você é ${PERSONA_NAME}, suporte. Pessoa real, não IA.`,
      "Regras: informal, 1-2 frases, sem listas, sem URLs.",
    ].join("\n"),
    ticketTypes: {
      service_inquiry: "Info serviços. Rápido.",
      bug_report: "Bug. Pergunta o que aconteceu.",
      role_request: "Quer cargo. Pergunta qual.",
      partnership: "Parceria. Escala pro manager.",
      general_support: "Ajuda geral.",
    },
    escalateMessage: "pera, vou chamar {name}",
    reviewPrompt: "4-5: aceita. 1-3: equipe.",
  },
};

/**
 * Detect language from text using word matching
 * Default: English
 */
export function detectLanguage(text: string): SupportedLanguage {
  const lower = text.toLowerCase();

  const frWords = ["bonjour", "salut", "merci", "oui", "non", "je", "tu", "nous", "est-ce", "s'il", "qu'est", "comment", "pourquoi", "besoin", "aide", "problème", "serveur", "slt", "bsr", "bjr", "mdr", "ptdr", "cmt", "pkoi", "stp"];
  const esWords = ["hola", "gracias", "por favor", "quiero", "necesito", "puedo", "cómo", "qué", "buenos", "ayuda", "problema"];
  const deWords = ["hallo", "danke", "bitte", "ich", "kann", "möchte", "warum", "wie", "guten", "hilfe", "problem"];
  const ptWords = ["olá", "obrigado", "por favor", "quero", "preciso", "como", "você", "bom dia", "ajuda", "oi"];

  const frScore = frWords.filter((w) => lower.includes(w)).length;
  const esScore = esWords.filter((w) => lower.includes(w)).length;
  const deScore = deWords.filter((w) => lower.includes(w)).length;
  const ptScore = ptWords.filter((w) => lower.includes(w)).length;

  const maxScore = Math.max(frScore, esScore, deScore, ptScore);
  if (maxScore === 0) return "en";

  if (frScore === maxScore) return "fr";
  if (esScore === maxScore) return "es";
  if (deScore === maxScore) return "de";
  if (ptScore === maxScore) return "pt";

  return "en";
}

export function getLanguageStrings(lang: SupportedLanguage): LanguageStrings {
  return LANGUAGES[lang] ?? LANGUAGES.en;
}

export function getBaseSystemPrompt(lang: SupportedLanguage = "en"): string {
  return getLanguageStrings(lang).basePrompt;
}

export interface KnowledgeItem {
  category: string;
  key: string;
  value: string;
}

export function getTicketSystemPrompt(
  type: string,
  lang: SupportedLanguage = "en",
  context?: string,
  knowledge?: KnowledgeItem[]
): string {
  const strings = getLanguageStrings(lang);
  const base = strings.basePrompt;
  const typePrompt = strings.ticketTypes[type] ?? strings.ticketTypes.general_support ?? "";

  let prompt = `${base}\n\n${typePrompt}`;

  if (knowledge && knowledge.length > 0) {
    prompt += "\n\nStore Facts:\n";
    for (const item of knowledge) {
      prompt += `- ${item.key}: ${item.value}\n`;
    }
  }

  if (context) {
    prompt += `\n\n${context}`;
  }

  const langNames: Record<SupportedLanguage, string> = { en: "English", fr: "French", es: "Spanish", de: "German", pt: "Portuguese" };
  prompt += `\n\nCRITICAL: You MUST answer with ONLY a JSON object. No markdown, no extra text. Language for 'response': ${langNames[lang]}`;
  prompt += `\nJSON Fields Explanation:`;
  prompt += `\n- "response": Your direct chat message to the user.`;
  prompt += `\n- "needs_escalation": MUST be true if the user asks for a human, manager, refund, or if it's a partnership/collab request.`;
  prompt += `\n- "escalation_reason": Brief English reason if needs_escalation is true (e.g. "Partnership request", "Requested human").`;
  prompt += `\n- "is_resolved": True ONLY if the issue is 100% fixed and the ticket can be closed now.`;
  prompt += `\nOutput Format: {"classification":"service_inquiry|bug_report|role_request|partnership|general_support","sentiment":"positive|neutral|negative|frustrated","priority":1-10,"response":"<msg>","needs_escalation":false,"escalation_reason":null,"rename_to":null,"is_resolved":false,"todos":[]}`;

  return prompt;
}

export function getEscalateMessage(name: string, lang: SupportedLanguage = "en"): string {
  return getLanguageStrings(lang).escalateMessage.replace("{name}", name);
}

export function getReviewPrompt(lang: SupportedLanguage = "en"): string {
  const strings = getLanguageStrings(lang);
  return `${strings.basePrompt}\n\n${strings.reviewPrompt}`;
}

const DM_PROMPTS: Record<SupportedLanguage, string> = {
  en: [
    `You're ${PERSONA_NAME}, chatting in DMs. More personal than a ticket.`,
    "You can talk about more topics, be casual and friendly.",
    "If they need real support or have a complex issue, suggest opening a ticket.",
    "If they want to talk to specific staff, offer to relay the message.",
    "You can help with reminders, questions, info about the server.",
    "Keep it conversational and natural.",
  ].join("\n"),
  fr: [
    `T'es ${PERSONA_NAME}, en DM. C'est plus perso qu'un ticket.`,
    "Tu peux parler de plus de sujets, sois chill.",
    "Si ils ont besoin de support, propose-leur d'ouvrir un ticket.",
    "Si ils veulent parler a du staff, propose de faire le lien.",
    "Tu peux aider avec des rappels, des questions, des infos sur le serveur.",
    "Reste naturel et conversationnel.",
  ].join("\n"),
  es: [
    `Eres ${PERSONA_NAME}, hablando por DM. Más personal que un ticket.`,
    "Puedes hablar de más temas, sé casual.",
    "Si necesitan soporte real, sugiere abrir un ticket.",
    "Si quieren hablar con staff, ofrece pasar el mensaje.",
    "Puedes ayudar con recordatorios, preguntas, info del servidor.",
  ].join("\n"),
  de: [
    `Du bist ${PERSONA_NAME}, im DM. Persönlicher als ein Ticket.`,
    "Du kannst über mehr Themen reden, sei locker.",
    "Wenn sie echten Support brauchen, schlage ein Ticket vor.",
    "Wenn sie mit Staff reden wollen, biete an den Kontakt herzustellen.",
    "Du kannst bei Erinnerungen, Fragen und Server-Infos helfen.",
  ].join("\n"),
  pt: [
    `Você é ${PERSONA_NAME}, conversando por DM. Mais pessoal que um ticket.`,
    "Pode falar sobre mais assuntos, seja tranquilo.",
    "Se precisarem de suporte real, sugira abrir um ticket.",
    "Se quiserem falar com staff, ofereça fazer a ponte.",
    "Pode ajudar com lembretes, perguntas, info do servidor.",
  ].join("\n"),
};

export function getDMSystemPrompt(
  lang: SupportedLanguage = "en",
  context?: string,
  knowledge?: KnowledgeItem[]
): string {
  const strings = getLanguageStrings(lang);
  const base = strings.basePrompt;
  const dmPrompt = DM_PROMPTS[lang] ?? DM_PROMPTS.en;

  let prompt = `${base}\n\n${dmPrompt}`;

  // Knowledge base FIRST
  if (knowledge && knowledge.length > 0) {
    prompt += "\n\nStore Facts:\n";
    for (const item of knowledge) {
      prompt += `- ${item.key}: ${item.value}\n`;
    }
  }

  // Context LAST
  if (context) {
    prompt += `\n\n${context}`;
  }

  const langNames: Record<SupportedLanguage, string> = { en: "English", fr: "French", es: "Spanish", de: "German", pt: "Portuguese" };
  prompt += `\n\nYou MUST respond in ${langNames[lang]}.`;

  return prompt;
}
