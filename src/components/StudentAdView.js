/**
 * Composant StudentAdView
 * Page dédiée permettant à tout étudiant de l'UIDT de faire passer une annonce
 * sur le grand carrousel 16:9 de la boutique pour 250 FCFA (5 jours).
 *
 * Champs :
 * - Nom
 * - Prénom
 * - Mail étudiant
 * - Image en 16:9 (zone drag-and-drop avec preview 16:9 instantané et compression WebP)
 * - Bouton "Lancer l'annonce" -> Redirection vers SasPay https://link.saspay.me/1aio4avhabm
 */

import { supabase } from '../services/supabase.js';
import { STUDENT_AD_CONFIG } from '../config/announcements.js';
import { compressImageToBlob } from '../utils/image-compressor.js';
import { uploadMediaFile } from '../services/storage-service.js';
import { escapeHTML } from '../utils/security.js';

/**
 * Crée la vue de publication d'annonce étudiante.
 * @param {Object} props
 * @param {Function} [props.onBackToCatalog] - Callback retour vers la boutique
 * @param {Function} [props.onShowToast] - Notification toast
 * @returns {HTMLElement}
 */
export function createStudentAdView({ onBackToCatalog, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.id = 'student-ad-view';
    containerEl.className = 'w-full max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in pb-16';

    let formData = {
        nom: '',
        prenom: '',
        studentEmail: '',
        title: '',
        imageFile: null,
        imagePreviewUrl: null,
    };

    let isSubmitting = false;
    let errorMessage = '';

    function render() {
        containerEl.innerHTML = `
            <!-- 1. BARRE DE NAVIGATION & RETOUR -->
            <div class="flex items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <button 
                    type="button" 
                    id="btn-ad-back-catalog" 
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer active:scale-95"
                    title="Retour aux offres"
                >
                    <i class="fa-solid fa-arrow-left text-xs"></i>
                    <span>Retour aux offres</span>
                </button>

                <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                        250 FCFA • 5 Jours
                    </span>
                </div>
            </div>

            <!-- 2. CARTE PRINCIPALE DU FORMULAIRE -->
            <div class="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs flex flex-col gap-6">
                <!-- En-tête informatif -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div class="flex items-start gap-3.5">
                        <div class="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl shrink-0 shadow-xs font-black">
                            <i class="fa-solid fa-bullhorn"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h1 class="font-heading font-black text-lg sm:text-xl text-slate-900 leading-tight">
                                    Faire passer une annonce
                                </h1>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                                    Campus UIDT
                                </span>
                            </div>
                            <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                                Diffusez votre offre, événement d'amicale, service ou projet sur le grand carrousel de la boutique pendant <strong>5 jours</strong>.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Récapitulatif des avantages -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2.5">
                        <i class="fa-solid fa-tv text-primary text-base"></i>
                        <div class="text-[11px] text-slate-700">
                            <strong class="block text-slate-900 font-bold">Carrousel 16:9</strong>
                            Accueil de la boutique
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2.5">
                        <i class="fa-solid fa-calendar-check text-amber-600 text-base"></i>
                        <div class="text-[11px] text-slate-700">
                            <strong class="block text-slate-900 font-bold">5 Jours complets</strong>
                            Visibilité garantie
                        </div>
                    </div>
                    <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-2.5">
                        <i class="fa-solid fa-coins text-emerald-600 text-base"></i>
                        <div class="text-[11px] text-slate-700">
                            <strong class="block text-slate-900 font-bold">250 FCFA</strong>
                            Via Wave / Orange Money
                        </div>
                    </div>
                </div>

                <!-- Message d'erreur s'il y a lieu -->
                ${errorMessage ? `
                    <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
                        <i class="fa-solid fa-circle-exclamation text-rose-600 shrink-0"></i>
                        <span>${escapeHTML(errorMessage)}</span>
                    </div>
                ` : ''}

                <!-- FORMULAIRE -->
                <form id="student-ad-form" class="flex flex-col gap-4.5" onsubmit="return false;">
                    <!-- Ligne 1 : Prénom & Nom -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label for="ad-student-prenom" class="block text-xs font-bold text-slate-800 mb-1">
                                Prénom *
                            </label>
                            <input 
                                type="text" 
                                id="ad-student-prenom" 
                                name="prenom"
                                required
                                placeholder="Ex: Modou, Aminata" 
                                value="${escapeHTML(formData.prenom)}"
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                            >
                        </div>
                        <div>
                            <label for="ad-student-nom" class="block text-xs font-bold text-slate-800 mb-1">
                                Nom *
                            </label>
                            <input 
                                type="text" 
                                id="ad-student-nom" 
                                name="nom"
                                required
                                placeholder="Ex: Ndiaye, Diallo" 
                                value="${escapeHTML(formData.nom)}"
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                            >
                        </div>
                    </div>

                    <!-- Ligne 2 : Email Étudiant -->
                    <div>
                        <label for="ad-student-email" class="block text-xs font-bold text-slate-800 mb-1">
                            Mail étudiant *
                        </label>
                        <input 
                            type="email" 
                            id="ad-student-email" 
                            name="student_email"
                            required
                            placeholder="Ex: etudiant@univ-thies.sn ou votre email de contact" 
                            value="${escapeHTML(formData.studentEmail)}"
                            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                        >
                        <span class="text-[11px] text-slate-400 mt-1 block">Sera utilisé pour confirmer votre annonce et son suivi.</span>
                    </div>

                    <!-- Ligne 3 : Titre ou objet de l'annonce (Optionnel / Pratique) -->
                    <div>
                        <label for="ad-student-title" class="block text-xs font-bold text-slate-800 mb-1">
                            Titre de l'annonce <span class="text-slate-400 font-normal">(Optionnel)</span>
                        </label>
                        <input 
                            type="text" 
                            id="ad-student-title" 
                            name="title"
                            maxlength="60"
                            placeholder="Ex: Soirée d'intégration, Vente matériel, Tournoi..." 
                            value="${escapeHTML(formData.title)}"
                            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                        >
                    </div>

                    <!-- Ligne 4 : Zone d'Image en 16:9 avec Aperçu instantané -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="block text-xs font-bold text-slate-800">
                                Image en 16:9 *
                            </label>
                            <span class="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Format paysage 16:9 recommandé
                            </span>
                        </div>

                        <div 
                            id="ad-image-dropzone" 
                            class="w-full aspect-[16/9] rounded-2xl border-2 border-dashed ${formData.imagePreviewUrl ? 'border-primary/50 bg-slate-950' : 'border-slate-300 bg-slate-50/70 hover:bg-slate-100 hover:border-primary'} relative overflow-hidden flex flex-col items-center justify-center p-4 transition-all cursor-pointer group"
                        >
                            <input 
                                type="file" 
                                id="ad-image-input" 
                                accept="image/png,image/jpeg,image/webp" 
                                class="sr-only"
                            >

                            ${formData.imagePreviewUrl ? `
                                <!-- Image prévisualisée au format exact 16:9 -->
                                <img 
                                    src="${formData.imagePreviewUrl}" 
                                    alt="Aperçu de l'affiche 16:9" 
                                    class="w-full h-full object-cover object-center rounded-xl"
                                >
                                <div class="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button 
                                        type="button" 
                                        id="btn-change-image" 
                                        class="px-3 py-1.5 rounded-xl bg-white text-slate-900 font-bold text-xs shadow-md hover:bg-slate-100 cursor-pointer"
                                    >
                                        <i class="fa-solid fa-camera mr-1"></i>Changer
                                    </button>
                                    <button 
                                        type="button" 
                                        id="btn-remove-image" 
                                        class="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md hover:bg-rose-700 cursor-pointer"
                                    >
                                        <i class="fa-solid fa-trash mr-1"></i>Supprimer
                                    </button>
                                </div>
                            ` : `
                                <!-- Zone de dépôt vide -->
                                <div class="flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                                    <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl mb-2.5 shadow-2xs group-hover:scale-105 transition-transform">
                                        <i class="fa-solid fa-cloud-arrow-up"></i>
                                    </div>
                                    <span class="text-xs sm:text-sm font-bold text-slate-800">
                                        Cliquez ou glissez votre affiche 16:9 ici
                                    </span>
                                    <span class="text-[11px] text-slate-500 mt-1 max-w-sm">
                                        Formats acceptés : PNG, JPG, WebP. Résolution conseillée : 1280 × 720 px.
                                    </span>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Ligne 5 : Bouton Lancer l'annonce -->
                    <div class="pt-3 border-t border-slate-100 flex flex-col gap-2">
                        <button 
                            type="button" 
                            id="btn-submit-student-ad" 
                            ${isSubmitting ? 'disabled' : ''}
                            class="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-heading font-black text-sm sm:text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            ${isSubmitting ? `
                                <i class="fa-solid fa-circle-notch fa-spin text-slate-950 text-base"></i>
                                <span>Préparation et redirection vers SasPay...</span>
                            ` : `
                                <i class="fa-solid fa-rocket text-slate-950"></i>
                                <span>Lancer l'annonce (250 FCFA)</span>
                            `}
                        </button>
                        <p class="text-[11px] text-slate-500 text-center">
                            En cliquant, vous serez redirigé vers SasPay pour régler <strong>250 FCFA</strong> en toute sécurité via Wave ou Orange Money.
                        </p>
                    </div>
                </form>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        // Bouton retour
        containerEl.querySelector('#btn-ad-back-catalog')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            } else {
                window.location.hash = '#catalog';
            }
        });

        // Gestion de la dropzone d'image 16:9
        const dropzone = containerEl.querySelector('#ad-image-dropzone');
        const fileInput = containerEl.querySelector('#ad-image-input');

        dropzone?.addEventListener('click', (e) => {
            if (e.target.closest('#btn-remove-image')) return;
            fileInput?.click();
        });

        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('border-primary', 'bg-primary/5');
        });

        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('border-primary', 'bg-primary/5');
        });

        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-primary', 'bg-primary/5');
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                handleFileSelected(files[0]);
            }
        });

        fileInput?.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                handleFileSelected(files[0]);
            }
        });

        containerEl.querySelector('#btn-remove-image')?.addEventListener('click', (e) => {
            e.stopPropagation();
            formData.imageFile = null;
            if (formData.imagePreviewUrl) {
                URL.revokeObjectURL(formData.imagePreviewUrl);
                formData.imagePreviewUrl = null;
            }
            render();
        });

        containerEl.querySelector('#btn-change-image')?.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput?.click();
        });

        // Mise à jour synchrone des champs texte
        const prenomInput = containerEl.querySelector('#ad-student-prenom');
        const nomInput = containerEl.querySelector('#ad-student-nom');
        const emailInput = containerEl.querySelector('#ad-student-email');
        const titleInput = containerEl.querySelector('#ad-student-title');

        prenomInput?.addEventListener('input', (e) => { formData.prenom = e.target.value; });
        nomInput?.addEventListener('input', (e) => { formData.nom = e.target.value; });
        emailInput?.addEventListener('input', (e) => { formData.studentEmail = e.target.value; });
        titleInput?.addEventListener('input', (e) => { formData.title = e.target.value; });

        // Soumission du formulaire
        containerEl.querySelector('#btn-submit-student-ad')?.addEventListener('click', handleSubmit);
    }

    function handleFileSelected(file) {
        if (!file || !file.type.startsWith('image/')) {
            errorMessage = 'Veuillez sélectionner un fichier image valide (PNG, JPG, WebP).';
            render();
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            errorMessage = "L'image ne doit pas dépasser 8 Mo.";
            render();
            return;
        }

        errorMessage = '';
        formData.imageFile = file;
        if (formData.imagePreviewUrl) {
            URL.revokeObjectURL(formData.imagePreviewUrl);
        }
        formData.imagePreviewUrl = URL.createObjectURL(file);
        render();
    }

    async function handleSubmit() {
        const cleanNom = (formData.nom || '').trim();
        const cleanPrenom = (formData.prenom || '').trim();
        const cleanEmail = (formData.studentEmail || '').trim();
        const cleanTitle = (formData.title || '').trim() || `Annonce ${cleanPrenom} ${cleanNom}`;

        if (!cleanPrenom || cleanPrenom.length < 2) {
            errorMessage = 'Veuillez renseigner votre prénom.';
            render();
            containerEl.querySelector('#ad-student-prenom')?.focus();
            return;
        }

        if (!cleanNom || cleanNom.length < 2) {
            errorMessage = 'Veuillez renseigner votre nom.';
            render();
            containerEl.querySelector('#ad-student-nom')?.focus();
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!cleanEmail || !emailRegex.test(cleanEmail)) {
            errorMessage = 'Veuillez renseigner une adresse email valide.';
            render();
            containerEl.querySelector('#ad-student-email')?.focus();
            return;
        }

        if (!formData.imageFile && !formData.imagePreviewUrl) {
            errorMessage = "L'image en 16:9 est obligatoire pour diffuser l'annonce sur le carrousel.";
            render();
            return;
        }

        isSubmitting = true;
        errorMessage = '';
        render();

        try {
            // 1. Compression optimisée de l'image en WebP au ratio 16:9
            let compressedBlob = null;
            try {
                const compResult = await compressImageToBlob(formData.imageFile, {
                    maxWidth: 1280,
                    maxHeight: 720,
                    quality: 0.80,
                    format: 'webp',
                });
                compressedBlob = compResult.blob;
            } catch (cErr) {
                console.warn('[StudentAdView] Échec compression WebP, repli sur le fichier d origine:', cErr);
                compressedBlob = formData.imageFile;
            }

            // 2. Téléversement de l'image (Cloudflare R2 ou Supabase Storage bucket product-images)
            let uploadedImageUrl = null;
            try {
                uploadedImageUrl = await uploadMediaFile(compressedBlob, {
                    folder: 'student_announcements',
                    filename: `ad_${cleanNom.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now()}`,
                    maxWidth: 1280,
                    maxHeight: 720,
                    quality: 0.80,
                    context: 'carousel',
                });
            } catch (upErr) {
                console.warn('[StudentAdView] Téléversement storage échoué, essai direct Supabase:', upErr);
                // Repli direct sur storage product-images
                const s3Path = `student_announcements/${Date.now()}_ad.webp`;
                const { error: directErr } = await supabase.storage
                    .from('product-images')
                    .upload(s3Path, compressedBlob, { contentType: 'image/webp', upsert: true });

                if (!directErr) {
                    const { data: pubData } = supabase.storage.from('product-images').getPublicUrl(s3Path);
                    uploadedImageUrl = pubData?.publicUrl || null;
                }
            }

            // 3. Enregistrement en base de données de la demande d'annonce (250 FCFA / 5 jours)
            const adPayload = {
                nom: cleanNom,
                prenom: cleanPrenom,
                student_email: cleanEmail,
                title: cleanTitle,
                image_url: uploadedImageUrl || '',
                duration_days: STUDENT_AD_CONFIG.durationDays,
                amount: STUDENT_AD_CONFIG.price,
                payment_link: STUDENT_AD_CONFIG.paymentLink,
                status: 'paiement_en_attente',
            };

            // Essai d'insertion dans student_announcements
            let dbSuccess = false;
            try {
                const { error: insErr } = await supabase
                    .from('student_announcements')
                    .insert([adPayload]);

                if (!insErr) {
                    dbSuccess = true;
                }
            } catch (_) {}

            // Insertion également dans advertisements (compatibilité SuperAdmin modération existante)
            try {
                await supabase
                    .from('advertisements')
                    .insert([{
                        title: cleanTitle,
                        content: `Annonce déposée par ${cleanPrenom} ${cleanNom} (${cleanEmail})`,
                        image_url: uploadedImageUrl || '',
                        amount: STUDENT_AD_CONFIG.price,
                        status: 'paiement_en_attente',
                        student_nom: cleanNom,
                        student_prenom: cleanPrenom,
                        student_email: cleanEmail,
                        duration_days: STUDENT_AD_CONFIG.durationDays,
                        payment_link: STUDENT_AD_CONFIG.paymentLink,
                    }]);
            } catch (_) {}

            if (typeof onShowToast === 'function') {
                onShowToast('🎉 Annonce enregistrée ! Redirection vers le paiement SasPay 250 FCFA...', 'success');
            }

            // 4. Redirection vers le lien SasPay officiel
            const targetUrl = STUDENT_AD_CONFIG.paymentLink;
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 600);

        } catch (err) {
            console.error('[StudentAdView] Erreur soumission annonce:', err);
            isSubmitting = false;
            errorMessage = `Une erreur est survenue : ${err.message || 'Impossible d enregistrer votre annonce pour le moment.'}`;
            render();
            if (typeof onShowToast === 'function') {
                onShowToast(errorMessage, 'error');
            }
        }
    }

    render();

    return containerEl;
}

/**
 * Crée le bandeau d'appel à l'action sous le carrousel d'annonces de la boutique.
 * @param {Object} props
 * @param {Function} [props.onPostAd] - Callback navigation vers la page de publication
 * @returns {HTMLElement}
 */
export function createStudentAdCtaBanner({ onPostAd } = {}) {
    const el = document.createElement('div');
    el.id = 'student-ad-cta-banner';
    el.className = 'w-full max-w-3xl mx-auto px-1 sm:px-0 my-1';
    el.innerHTML = `
        <div class="w-full bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/90 border border-amber-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 transition-all">
            <div class="flex items-center gap-3 w-full sm:w-auto text-left">
                <div class="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-base shrink-0 shadow-2xs">
                    <i class="fa-solid fa-bullhorn"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs sm:text-sm font-heading font-black text-slate-900 leading-tight">
                            Étudiant UIDT ? Faites passer une annonce !
                        </span>
                        <span class="px-2 py-0.2 rounded-full text-[10px] font-black uppercase bg-amber-200 text-amber-950 shrink-0">
                            250 FCFA • 5 jours
                        </span>
                    </div>
                    <p class="text-[11px] text-slate-600 mt-0.5 line-clamp-1 sm:line-clamp-none">
                        Amicales, promos, services & événements : diffusez votre affiche 16:9 sur l'accueil.
                    </p>
                </div>
            </div>

            <a 
                href="#passer-annonce" 
                id="btn-catalog-passer-annonce" 
                class="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-heading font-black text-xs transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
                <i class="fa-solid fa-plus-circle text-xs"></i>
                <span>Faire passer une annonce</span>
            </a>
        </div>
    `;

    el.querySelector('#btn-catalog-passer-annonce')?.addEventListener('click', (e) => {
        if (typeof onPostAd === 'function') {
            e.preventDefault();
            onPostAd();
        }
    });

    return el;
}

export default createStudentAdView;
