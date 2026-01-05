/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a value between 0 and 1 (1 = identical)
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return shorter / longer;
  }
  
  // Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLength;
}

/**
 * Normalize company name for comparison
 * Removes common suffixes like LTD, SRL, SPA, etc.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|ltd\.?|llc\.?|inc\.?|gmbh|ag|co\.?|company|limited)\.?$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find similar matches in a list of subjects
 */
export interface SubjectMatch {
  id: string;
  name: string;
  code?: string;
  tax_id?: string | null;
  similarity: number;
}

export function findSimilarSubjects<T extends { id: string; name: string; code?: string; tax_id?: string | null }>(
  searchName: string,
  subjects: T[],
  threshold: number = 0.6
): SubjectMatch[] {
  const normalizedSearch = normalizeCompanyName(searchName);
  
  const matches = subjects
    .map(subject => {
      const normalizedSubject = normalizeCompanyName(subject.name);
      const similarity = stringSimilarity(normalizedSearch, normalizedSubject);
      
      // Also check if tax_id matches (exact match = 100%)
      // This would be handled separately
      
      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        tax_id: subject.tax_id,
        similarity,
      };
    })
    .filter(match => match.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
  
  return matches;
}
