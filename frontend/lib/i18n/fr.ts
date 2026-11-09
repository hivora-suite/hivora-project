/** Reference dictionary: every other language must define the same keys. */
export const fr = {
  "home.title": "Votre espace de gestion de projet",
  "home.text": "L'installation fonctionne. Les projets arrivent bientôt.",
  "home.loading": "Vérification du service…",
  "home.ok": "Service opérationnel",
  "home.error": "Service injoignable",
  "notFound.title": "Cette page n'existe pas",
  "notFound.text": "L'adresse est peut-être mal tapée, ou la page a été déplacée.",
  "notFound.back": "Retour à l'accueil",
  "error.generic": "Une erreur est survenue : {message}",
};

export type MessageKey = keyof typeof fr;
