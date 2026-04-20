/**
 * Smart Category Detection Service
 * Automatically detects expense/income categories based on description and issuer
 */

export type CategoryId = 
  | 'SALARY' | 'PAYROLL_TAXES' | 'RENT' | 'UTILITIES' | 'INSURANCE'
  | 'FOOD_SUPPLIES' | 'BEVERAGES' | 'RESTAURANT_SUPPLIES' | 'PACKAGING'
  | 'CLEANING' | 'MAINTENANCE' | 'BANK_FEES' | 'ACCOUNTING'
  | 'MARKETING' | 'DELIVERY' | 'TELECOM' | 'OFFICE_SUPPLIES'
  | 'LICENSES' | 'TAXES' | 'OTHER';

interface CategoryKeywords {
  category: CategoryId;
  keywords: string[];
  priority: number; // Higher priority = checked first
}

// Category detection rules with keywords
const CATEGORY_RULES: CategoryKeywords[] = [
  // Personnel (High Priority)
  {
    category: 'SALARY',
    keywords: ['salary', 'salaire', 'wage', 'payroll', 'paie', 'employee', 'employé', 'staff', 'personnel'],
    priority: 10
  },
  {
    category: 'PAYROLL_TAXES',
    keywords: ['avs', 'lpp', 'social', 'cotisation', 'charges sociales', 'social security', 'pension'],
    priority: 10
  },
  
  // Food & Beverages (High Priority)
  {
    category: 'FOOD_SUPPLIES',
    keywords: [
      'food', 'nourriture', 'aliment', 'viande', 'meat', 'poisson', 'fish', 'légume', 'vegetable',
      'fruit', 'pain', 'bread', 'fromage', 'cheese', 'épice', 'spice', 'huile', 'oil',
      'farine', 'flour', 'sucre', 'sugar', 'sel', 'salt', 'grocery', 'groceries',
      'valigro', 'transgourmet', 'metro', 'cash', 'makro', 'sysco',
      'filet', 'brochette', 'saumon', 'salmon', 'boeuf', 'beef', 'poulet', 'chicken'
    ],
    priority: 9
  },
  {
    category: 'BEVERAGES',
    keywords: [
      'beverage', 'boisson', 'drink', 'wine', 'vin', 'beer', 'bière', 'bier',
      'coffee', 'café', 'tea', 'thé', 'juice', 'jus', 'water', 'eau',
      'soda', 'soft drink', 'alcohol', 'alcool', 'liquor', 'spirits',
      'pale ale', 'lager', 'ipa', 'stout', 'champagne', 'prosecco'
    ],
    priority: 9
  },
  
  // Fixed Costs (Medium Priority)
  {
    category: 'RENT',
    keywords: ['rent', 'loyer', 'lease', 'bail', 'location', 'rental'],
    priority: 8
  },
  {
    category: 'UTILITIES',
    keywords: [
      'utility', 'utilities', 'electric', 'électricité', 'gas', 'gaz',
      'water', 'eau', 'heating', 'chauffage', 'energy', 'énergie',
      'power', 'electricity', 'sewage', 'eaux usées'
    ],
    priority: 8
  },
  {
    category: 'INSURANCE',
    keywords: ['insurance', 'assurance', 'policy', 'police', 'coverage', 'couverture'],
    priority: 8
  },
  {
    category: 'TELECOM',
    keywords: [
      'internet', 'phone', 'téléphone', 'mobile', 'telecom', 'télécommunication',
      'wifi', 'broadband', 'swisscom', 'sunrise', 'salt', 'upc'
    ],
    priority: 7
  },
  
  // Restaurant Supplies (Medium Priority)
  {
    category: 'RESTAURANT_SUPPLIES',
    keywords: [
      'equipment', 'équipement', 'kitchen', 'cuisine', 'utensil', 'ustensile',
      'plate', 'assiette', 'glass', 'verre', 'cutlery', 'couverts',
      'pot', 'pan', 'casserole', 'knife', 'couteau', 'fork', 'fourchette',
      'table', 'chair', 'chaise', 'napkin', 'serviette'
    ],
    priority: 7
  },
  {
    category: 'PACKAGING',
    keywords: [
      'packaging', 'emballage', 'box', 'boîte', 'container', 'conteneur',
      'bag', 'sac', 'wrap', 'film', 'foil', 'aluminium', 'plastic',
      'takeaway', 'take-away', 'à emporter', 'disposable', 'jetable'
    ],
    priority: 7
  },
  
  // Operations (Medium Priority)
  {
    category: 'CLEANING',
    keywords: [
      'cleaning', 'nettoyage', 'detergent', 'détergent', 'soap', 'savon',
      'disinfect', 'désinfectant', 'sanitizer', 'bleach', 'javel',
      'mop', 'balai', 'broom', 'sponge', 'éponge', 'hygiene', 'hygiène'
    ],
    priority: 6
  },
  {
    category: 'MAINTENANCE',
    keywords: [
      'maintenance', 'repair', 'réparation', 'fix', 'fixing', 'plumber', 'plombier',
      'electrician', 'électricien', 'technician', 'technicien', 'service',
      'broken', 'cassé', 'damage', 'dommage'
    ],
    priority: 6
  },
  {
    category: 'DELIVERY',
    keywords: [
      'delivery', 'livraison', 'transport', 'shipping', 'expédition',
      'courier', 'coursier', 'uber', 'deliveroo', 'just eat', 'eat.ch',
      'freight', 'fret', 'logistics', 'logistique'
    ],
    priority: 6
  },
  
  // Financial (Medium Priority)
  {
    category: 'BANK_FEES',
    keywords: [
      'bank', 'banque', 'fee', 'frais', 'charge', 'commission',
      'transaction', 'transfer', 'virement', 'card', 'carte',
      'ubs', 'credit suisse', 'raiffeisen', 'postfinance'
    ],
    priority: 6
  },
  {
    category: 'ACCOUNTING',
    keywords: [
      'accounting', 'comptabilité', 'accountant', 'comptable', 'audit',
      'bookkeeping', 'tenue de livres', 'tax advisor', 'conseiller fiscal',
      'fiduciary', 'fiduciaire', 'cpa', 'expert-comptable'
    ],
    priority: 6
  },
  {
    category: 'TAXES',
    keywords: [
      'tax', 'taxe', 'impôt', 'vat', 'tva', 'fiscal', 'revenue',
      'customs', 'douane', 'duty', 'droit'
    ],
    priority: 6
  },
  
  // Marketing & Other (Low Priority)
  {
    category: 'MARKETING',
    keywords: [
      'marketing', 'advertising', 'publicité', 'ad', 'promo', 'promotion',
      'social media', 'réseaux sociaux', 'facebook', 'instagram', 'google ads',
      'flyer', 'poster', 'affiche', 'branding', 'design'
    ],
    priority: 5
  },
  {
    category: 'OFFICE_SUPPLIES',
    keywords: [
      'office', 'bureau', 'paper', 'papier', 'pen', 'stylo', 'pencil', 'crayon',
      'printer', 'imprimante', 'ink', 'encre', 'toner', 'stapler', 'agrafeuse',
      'folder', 'classeur', 'stationery', 'papeterie'
    ],
    priority: 5
  },
  {
    category: 'LICENSES',
    keywords: [
      'license', 'licence', 'permit', 'permis', 'authorization', 'autorisation',
      'registration', 'enregistrement', 'certification', 'certificate'
    ],
    priority: 5
  }
];

/**
 * Detect category from description and issuer
 */
export function detectCategory(description: string, issuer?: string): CategoryId {
  const text = `${description} ${issuer || ''}`.toLowerCase();
  
  // Sort rules by priority (highest first)
  const sortedRules = [...CATEGORY_RULES].sort((a, b) => b.priority - a.priority);
  
  // Check each rule
  for (const rule of sortedRules) {
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        console.log(`🎯 Category detected: ${rule.category} (matched keyword: "${keyword}")`);
        return rule.category;
      }
    }
  }
  
  // Default to OTHER if no match
  console.log('❓ No category match found, defaulting to OTHER');
  return 'OTHER';
}

/**
 * Detect category with confidence score
 */
export function detectCategoryWithConfidence(description: string, issuer?: string): {
  category: CategoryId;
  confidence: number;
  matchedKeywords: string[];
} {
  const text = `${description} ${issuer || ''}`.toLowerCase();
  const sortedRules = [...CATEGORY_RULES].sort((a, b) => b.priority - a.priority);
  
  let bestMatch: {
    category: CategoryId;
    confidence: number;
    matchedKeywords: string[];
  } = {
    category: 'OTHER',
    confidence: 0,
    matchedKeywords: []
  };
  
  for (const rule of sortedRules) {
    const matchedKeywords: string[] = [];
    
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    
    if (matchedKeywords.length > 0) {
      // Calculate confidence based on number of matches and priority
      const confidence = Math.min(
        95,
        (matchedKeywords.length * 20) + (rule.priority * 5)
      );
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          category: rule.category,
          confidence,
          matchedKeywords
        };
      }
    }
  }
  
  console.log(`🎯 Category detection result:`, bestMatch);
  return bestMatch;
}

/**
 * Get category suggestions (top 3 matches)
 */
export function getCategorySuggestions(description: string, issuer?: string): Array<{
  category: CategoryId;
  confidence: number;
  reason: string;
}> {
  const text = `${description} ${issuer || ''}`.toLowerCase();
  const sortedRules = [...CATEGORY_RULES].sort((a, b) => b.priority - a.priority);
  
  const suggestions: Array<{
    category: CategoryId;
    confidence: number;
    reason: string;
  }> = [];
  
  for (const rule of sortedRules) {
    const matchedKeywords: string[] = [];
    
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    
    if (matchedKeywords.length > 0) {
      const confidence = Math.min(
        95,
        (matchedKeywords.length * 20) + (rule.priority * 5)
      );
      
      suggestions.push({
        category: rule.category,
        confidence,
        reason: `Matched: ${matchedKeywords.slice(0, 3).join(', ')}`
      });
    }
  }
  
  // Return top 3 suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
