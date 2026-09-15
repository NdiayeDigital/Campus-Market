/**
 * Module utilitaire de calcul de distance d'édition (Levenshtein)
 * Permet la recherche tolérante aux fautes de frappe dans le catalogue Campus Market.
 */

/**
 * Calcule la distance de Levenshtein entre deux chaînes de caractères.
 * @param {string} s - Première chaîne (ex: terme de recherche saisi par l'étudiant)
 * @param {string} t - Deuxième chaîne (ex: titre d'un produit ou mot-clé)
 * @returns {number} Nombre minimal d'opérations (insertion, suppression, substitution)
 */
export function levenshteinDistance(s, t) {
    if (!s) return t ? t.length : 0;
    if (!t) return s ? s.length : 0;

    const sStr = String(s).toLowerCase();
    const tStr = String(t).toLowerCase();

    if (sStr === tStr) return 0;

    const arr = [];
    for (let i = 0; i <= tStr.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= sStr.length; j++) {
            arr[i][j] =
                i === 0
                    ? j
                    : Math.min(
                          arr[i - 1][j] + 1,
                          arr[i][j - 1] + 1,
                          arr[i - 1][j - 1] + (sStr[j - 1] === tStr[i - 1] ? 0 : 1)
                      );
        }
    }
    return arr[tStr.length][sStr.length];
}

/**
 * Détermine si un mot correspond de manière floue à un terme cible selon un seuil d'édition.
 * @param {string} word - Mot du produit
 * @param {string} query - Terme recherché
 * @param {number} [maxDistance=2] - Tolérance maximale de fautes (défaut: 2)
 * @returns {boolean}
 */
export function isFuzzyMatch(word, query, maxDistance = 2) {
    if (!word || !query) return false;
    const cleanWord = String(word).toLowerCase().trim();
    const cleanQuery = String(query).toLowerCase().trim();

    if (cleanWord.includes(cleanQuery)) return true;
    return levenshteinDistance(cleanWord, cleanQuery) <= maxDistance;
}

export default levenshteinDistance;
