export const ABUSE_PATTERNS = [
  /ta gueule/i, /ferme ta gueule/i, /tg/i, /ftg/i,
  /connard/i, /connnard/i, /conard/i, /connasse/i, /conasse/i,
  /salope/i, /salop/i, /sale pute/i, /pute/i,
  /pd/i, /pédé/i, /pedale/i, /pédale/i, /tapette/i,
  /enculé/i, /encule/i, /enculée/i,
  /fils de pute/i, /fdp/i,
  /nique/i, /niquer/i, /nique ta mère/i, /ntm/i,
  /bâtard/i, /batard/i,
  /bouffon/i, /gogol/i, /trisomique/i, /mongol/i,
  /clochard/i, /clodo/i,
  /merde/i, /casse toi/i, /casse-toi/i, /dégage/i,
  /suce/i, /suceur/i, /bite/i, /couille/i,
  // Spanish
  /puta/i, /hijo de puta/i, /cabron/i, /cabrón/i, /maricon/i, /maricón/i, /gilipollas/i, /pendejo/i, /mierda/i,
  // German
  /hurensohn/i, /schlampe/i, /fick dich/i, /arschloch/i, /scheiße/i,
  // English
  /fuck/i, /fucker/i, /fucking/i, /motherfucker/i, /bitch/i, /asshole/i, /cunt/i, /dick/i, /pussy/i, /slut/i, /whore/i, /retard/i, /faggot/i, /nigger/i, /nigga/i,
  // Portuguese
  /filho da puta/i, /cabrão/i, /caralho/i, /merda/i, /foda-se/i, /vai tomar no cu/i, /vtnc/i, /arrombado/i
];

export function isAbusive(content: string): boolean {
  return ABUSE_PATTERNS.some((pattern) => pattern.test(content));
}

export function isTooShortOrUseless(content: string): boolean {
  // If it's a known greeting, let it pass so the bot can say "how can I help"
  const greetings = ["yo", "slt", "salut", "bonjour", "hey", "hi", "hello", "hola", "coucou", "cc"];
  if (greetings.includes(content.toLowerCase().trim())) return false;

  // If very short and no question
  if (content.length < 5 && !content.includes("?")) {
    return true;
  }
  return false;
}
