/**
 * Flat string dictionary for every hardcoded widget-chrome string — the bot
 * itself already answers in whatever language the visitor writes in (see
 * lib/rag/system-prompt.ts rule 4), but until now the chrome around it
 * (buttons, banners, placeholders) was always English regardless. `en` is
 * the fallback for any key missing from another locale, so partial
 * translations degrade gracefully rather than showing a raw key.
 */
export type LocaleKey = "en" | "es" | "hi" | "fr";
const LOCALES: LocaleKey[] = ["en", "es", "hi", "fr"];

type Dict = Record<string, string>;

const en: Dict = {
  openChat: "Open chat",
  closeChat: "Close chat",
  onlineNow: "Online now",
  repliesWithinMinutes: "Usually replies within minutes",
  talkToHuman: "Talk to a human",
  waitingForAgent: "Waiting for an agent...",
  connectedToAgent: "Connected to an agent",
  typeMessage: "Type your message...",
  attachFile: "Attach a file",
  poweredBy: "Powered by VeloBot",
  offlineNote: "No one's online right now. Leave your email and message and we'll follow up.",
  offlineOutsideHoursNote: "We're currently closed. Leave your email and message and we'll get back to you.",
  emailPlaceholder: "you@company.com",
  whatCanWeHelp: "What can we help with?",
  send: "Send",
  queuedBanner: "You're in the queue — an agent will join shortly.",
  assignedBanner: "You're now chatting with a human agent.",
  outsideBusinessHoursBanner: "We're currently offline. Send a message and we'll reply as soon as we're back.",
  fallbackHint: "Didn't get the answer you needed?",
  agentUnreachable: "Could not reach an agent right now.",
  offlineSendFailed: "Could not send your message. Please try again.",
  offlineThanks: "Thanks! We'll follow up at {email}.",
  agentLabel: "Agent",
  csatPrompt: "How was this conversation?",
  csatCommentPlaceholder: "Anything else? (optional)",
  csatSubmit: "Submit",
  csatThanks: "Thanks for your feedback!",
  consentDefaultText: "This chat may use cookies to remember your conversation. By continuing, you agree to our Privacy Policy.",
  consentDismiss: "Got it",
  uploadFailed: "Could not upload the file. Please try again.",
};

const es: Dict = {
  openChat: "Abrir chat",
  closeChat: "Cerrar chat",
  onlineNow: "En línea ahora",
  repliesWithinMinutes: "Normalmente responde en minutos",
  talkToHuman: "Hablar con una persona",
  waitingForAgent: "Esperando a un agente...",
  connectedToAgent: "Conectado con un agente",
  typeMessage: "Escribe tu mensaje...",
  attachFile: "Adjuntar un archivo",
  poweredBy: "Desarrollado por VeloBot",
  offlineNote: "Nadie está conectado ahora. Deja tu correo y mensaje y te responderemos.",
  offlineOutsideHoursNote: "Estamos cerrados ahora. Deja tu correo y mensaje y te responderemos.",
  emailPlaceholder: "tu@empresa.com",
  whatCanWeHelp: "¿En qué podemos ayudarte?",
  send: "Enviar",
  queuedBanner: "Estás en la cola — un agente se unirá pronto.",
  assignedBanner: "Ahora estás chateando con un agente humano.",
  outsideBusinessHoursBanner: "Ahora estamos fuera de línea. Envía un mensaje y responderemos en cuanto volvamos.",
  fallbackHint: "¿No obtuviste la respuesta que necesitabas?",
  agentUnreachable: "No se pudo contactar a un agente en este momento.",
  offlineSendFailed: "No se pudo enviar tu mensaje. Inténtalo de nuevo.",
  offlineThanks: "¡Gracias! Te contactaremos en {email}.",
  agentLabel: "Agente",
  csatPrompt: "¿Cómo fue esta conversación?",
  csatCommentPlaceholder: "¿Algo más? (opcional)",
  csatSubmit: "Enviar",
  csatThanks: "¡Gracias por tu opinión!",
  consentDefaultText: "Este chat puede usar cookies para recordar tu conversación. Al continuar, aceptas nuestra Política de Privacidad.",
  consentDismiss: "Entendido",
  uploadFailed: "No se pudo subir el archivo. Inténtalo de nuevo.",
};

const hi: Dict = {
  openChat: "चैट खोलें",
  closeChat: "चैट बंद करें",
  onlineNow: "अभी ऑनलाइन",
  repliesWithinMinutes: "आमतौर पर कुछ मिनटों में जवाब मिलता है",
  talkToHuman: "किसी व्यक्ति से बात करें",
  waitingForAgent: "एजेंट का इंतज़ार हो रहा है...",
  connectedToAgent: "एजेंट से जुड़ गए",
  typeMessage: "अपना संदेश लिखें...",
  attachFile: "फ़ाइल जोड़ें",
  poweredBy: "VeloBot द्वारा संचालित",
  offlineNote: "अभी कोई ऑनलाइन नहीं है। अपना ईमेल और संदेश छोड़ें, हम जवाब देंगे।",
  offlineOutsideHoursNote: "हम अभी बंद हैं। अपना ईमेल और संदेश छोड़ें, हम जल्द जवाब देंगे।",
  emailPlaceholder: "aap@company.com",
  whatCanWeHelp: "हम आपकी क्या मदद कर सकते हैं?",
  send: "भेजें",
  queuedBanner: "आप कतार में हैं — जल्द ही एक एजेंट जुड़ेगा।",
  assignedBanner: "अब आप एक व्यक्ति से बात कर रहे हैं।",
  outsideBusinessHoursBanner: "हम अभी ऑफ़लाइन हैं। संदेश भेजें, लौटते ही जवाब देंगे।",
  fallbackHint: "क्या आपको सही जवाब नहीं मिला?",
  agentUnreachable: "अभी किसी एजेंट से संपर्क नहीं हो सका।",
  offlineSendFailed: "संदेश भेजा नहीं जा सका। कृपया फिर से कोशिश करें।",
  offlineThanks: "धन्यवाद! हम {email} पर संपर्क करेंगे।",
  agentLabel: "एजेंट",
  csatPrompt: "यह बातचीत कैसी रही?",
  csatCommentPlaceholder: "कुछ और? (वैकल्पिक)",
  csatSubmit: "भेजें",
  csatThanks: "आपकी प्रतिक्रिया के लिए धन्यवाद!",
  consentDefaultText: "यह चैट आपकी बातचीत याद रखने के लिए कुकीज़ का उपयोग कर सकता है। जारी रखने पर, आप हमारी गोपनीयता नीति से सहमत होते हैं।",
  consentDismiss: "समझ गया",
  uploadFailed: "फ़ाइल अपलोड नहीं हो सकी। कृपया फिर से कोशिश करें।",
};

const fr: Dict = {
  openChat: "Ouvrir le chat",
  closeChat: "Fermer le chat",
  onlineNow: "En ligne maintenant",
  repliesWithinMinutes: "Répond généralement en quelques minutes",
  talkToHuman: "Parler à une personne",
  waitingForAgent: "En attente d'un agent...",
  connectedToAgent: "Connecté à un agent",
  typeMessage: "Écrivez votre message...",
  attachFile: "Joindre un fichier",
  poweredBy: "Propulsé par VeloBot",
  offlineNote: "Personne n'est en ligne pour le moment. Laissez votre e-mail et votre message, nous répondrons.",
  offlineOutsideHoursNote: "Nous sommes actuellement fermés. Laissez votre e-mail et votre message, nous répondrons bientôt.",
  emailPlaceholder: "vous@entreprise.com",
  whatCanWeHelp: "Comment pouvons-nous vous aider ?",
  send: "Envoyer",
  queuedBanner: "Vous êtes dans la file d'attente — un agent arrive bientôt.",
  assignedBanner: "Vous discutez maintenant avec un agent humain.",
  outsideBusinessHoursBanner: "Nous sommes actuellement hors ligne. Envoyez un message, nous répondrons dès notre retour.",
  fallbackHint: "Vous n'avez pas obtenu la réponse souhaitée ?",
  agentUnreachable: "Impossible de joindre un agent pour le moment.",
  offlineSendFailed: "Impossible d'envoyer votre message. Veuillez réessayer.",
  offlineThanks: "Merci ! Nous vous répondrons à {email}.",
  agentLabel: "Agent",
  csatPrompt: "Comment était cette conversation ?",
  csatCommentPlaceholder: "Autre chose ? (facultatif)",
  csatSubmit: "Envoyer",
  csatThanks: "Merci pour votre retour !",
  consentDefaultText: "Ce chat peut utiliser des cookies pour se souvenir de votre conversation. En continuant, vous acceptez notre politique de confidentialité.",
  consentDismiss: "Compris",
  uploadFailed: "Impossible d'importer le fichier. Veuillez réessayer.",
};

const DICTS: Record<LocaleKey, Dict> = { en, es, hi, fr };

function isLocaleKey(value: string): value is LocaleKey {
  return (LOCALES as string[]).includes(value);
}

/** `navigator.language` (the visitor's own browser) wins when we have a translation for it; otherwise falls back to the bot's configured default, then "en". */
export function resolveLocale(botDefaultLocale: string): LocaleKey {
  const browserLang = typeof navigator !== "undefined" ? navigator.language.slice(0, 2).toLowerCase() : "";
  if (isLocaleKey(browserLang)) return browserLang;
  if (isLocaleKey(botDefaultLocale)) return botDefaultLocale;
  return "en";
}

export type Translator = (key: keyof typeof en, vars?: Record<string, string>) => string;

export function createTranslator(locale: LocaleKey): Translator {
  return (key, vars) => {
    let text = DICTS[locale][key] ?? en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
    }
    return text;
  };
}
