/**
 * Module synthétiseur audio basé sur la Web Audio API.
 * Génère des bips de notification légers et instantanés pour les nouvelles commandes,
 * sans nécessiter de fichier audio externe lourd (MP3/WAV).
 */

class AudioAlertManager {
    constructor() {
        this.audioCtx = null;
        // Activé par défaut (sauf si explicitement désactivé par l'utilisateur)
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('campus_audio_alert_enabled') : null;
        this.isEnabled = stored !== null ? stored === 'true' : true;
        this._bindUserInteraction();
    }

    /**
     * Attache un écouteur sur la première interaction de l'utilisateur
     * pour déverrouiller l'AudioContext selon les politiques d'autoplay des navigateurs.
     */
    _bindUserInteraction() {
        if (typeof window === 'undefined') return;
        const unlock = () => {
            if (this.isEnabled && (!this.audioCtx || this.audioCtx.state === 'suspended')) {
                this.enable().catch(() => {});
            }
        };
        window.addEventListener('click', unlock, { once: true, passive: true });
        window.addEventListener('touchstart', unlock, { once: true, passive: true });
        window.addEventListener('keydown', unlock, { once: true, passive: true });
    }

    /**
     * Initialise ou réactive l'AudioContext suite à une interaction utilisateur.
     * Les navigateurs exigent une action explicite (clic/touch) avant d'autoriser la lecture audio.
     * @returns {Promise<boolean>} True si l'audio est activé avec succès
     */
    async enable() {
        try {
            if (!this.audioCtx) {
                const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
                if (!AudioContextClass) {
                    console.warn("Web Audio API non supportée sur ce navigateur.");
                    return false;
                }
                this.audioCtx = new AudioContextClass();
            }

            if (this.audioCtx.state === 'suspended') {
                await this.audioCtx.resume();
            }

            this.isEnabled = true;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('campus_audio_alert_enabled', 'true');
            }
            return true;
        } catch (error) {
            console.error("Échec d'activation de l'AudioContext:", error);
            return false;
        }
    }

    /**
     * Désactive les alertes sonores.
     */
    disable() {
        this.isEnabled = false;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('campus_audio_alert_enabled', 'false');
        }
    }

    /**
     * Bascule l'état d'activation des alertes sonores.
     * @returns {Promise<boolean>} Nouvel état (true = actif, false = inactif)
     */
    async toggle() {
        if (this.isEnabled) {
            this.disable();
            return false;
        }
        return await this.enable();
    }

    /**
     * Joue le carillon bitonal de notification (A5 880Hz suivi de C6 1046.5Hz).
     */
    playSound() {
        if (!this.isEnabled) {
            return;
        }

        try {
            if (!this.audioCtx) {
                const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
                if (AudioContextClass) {
                    this.audioCtx = new AudioContextClass();
                }
            }

            if (!this.audioCtx) return;

            const ctx = this.audioCtx;
            if (ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }

            const now = ctx.currentTime;

            // Premier bip harmonique (La5 / A5 - 880 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.3);

            // Deuxième bip ascendant plus clair (Do6 / C6 - 1046.50 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1046.5, now + 0.15);
            gain2.gain.setValueAtTime(0, now + 0.15);
            gain2.gain.linearRampToValueAtTime(0.3, now + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.45);
        } catch (error) {
            console.warn("Impossible de jouer la notification sonore:", error);
        }
    }
}

// Instance singleton
export const audioAlert = new AudioAlertManager();

export function playNotificationSound() {
    audioAlert.playSound();
}

export function enableAudioAlerts() {
    return audioAlert.enable();
}

export default audioAlert;
