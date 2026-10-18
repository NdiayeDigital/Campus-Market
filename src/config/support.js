/**
 * Configuration officielle du Support & Assistance Campus Market (UIDT)
 */
export const SUPPORT_CONFIG = {
    phone: '+221 77 606 45 96',
    phoneDisplay: '+221 77 606 45 96',
    phoneRaw: '221776064596',
    email: 'assistance@campusmarket-uidt.com',
    phoneCallUrl: 'tel:+221776064596',
    whatsappUrl: 'https://wa.me/221776064596?text=' + encodeURIComponent("Bonjour ! Je contacte l'assistance et le support Campus Market UIDT."),
    whatsappResetUrl: 'https://wa.me/221776064596?text=' + encodeURIComponent("Bonjour ! J'ai oublié mon mot de passe pour mon compte vendeur Campus Market UIDT.\nMon adresse email est : "),
    mailResetUrl: 'mailto:assistance@campusmarket-uidt.com?subject=' + encodeURIComponent("Demande de réinitialisation de mot de passe vendeur - UIDT") + '&body=' + encodeURIComponent("Bonjour l'équipe support Campus Market,\n\nJe souhaite réinitialiser le mot de passe de mon compte vendeur.\n\nNom et Prénom :\nNom de ma boutique :\nAdresse email institutionnelle (@univ-thies.sn) :\nNuméro de téléphone :\n\nMerci d'avance pour votre aide."),
};

export default SUPPORT_CONFIG;
