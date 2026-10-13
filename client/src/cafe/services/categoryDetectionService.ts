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
      'aligro', 'valigro', 'transgourmet', 'prodega', 'demaurex', 'metro', 'cash', 'makro', 'sysco',
      'filet', 'brochette', 'saumon', 'salmon', 'boeuf', 'beef', 'poulet', 'chicken',
      'boucherie', 'charcuterie', 'poissonnerie', 'boulangerie', 'pâtisserie', 'patisserie',
      'marchandise alimentaire', 'denrées', 'ingrédient', 'ingredient'
    ],
    priority: 9
  },
  {
    category: 'BEVERAGES',
    keywords: [
      'beverage', 'boisson', 'drink', 'wine', 'vin', 'beer', 'bière', 'bier',
      'coffee', 'café', 'tea', 'thé', 'juice', 'jus', 'soda', 'soft drink',
      'alcohol', 'alcool', 'liquor', 'spirits', 'spiritueux', 'liqueur',
      'pale ale', 'lager', 'ipa', 'stout', 'champagne', 'prosecco', 'cidre', 'cider',
      'feldschlösschen', 'feldschloesschen', 'heineken', 'coca-cola', 'coca cola', 'valaisanne',
      'castel', 'carlsberg', 'schweppes', 'red bull', 'sanpellegrino', 'san pellegrino',
      'négociant', 'negociant', 'cave ', 'brasserie', 'brewery', 'fût', 'fut ', 'crate'
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

export type LineItemFlowType = 'INCOME' | 'EXPENSE';

export type LineItemTypeInput = {
  expenseCategory?: string;
  documentType?: string;
  description?: string;
  category?: string;
  issuer?: string;
  parentExpenseCategory?: string;
  /** Trust model when it already classified a row as income */
  existingType?: string;
};

const INCOME_CATEGORY_MARKERS = ['REVENUE', 'SALES', 'RESERVATION'] as const;

const INCOME_DOC_MARKERS = [
  'TICKET',
  'RECEIPT',
  'Z2',
  'Z-READ',
  'Z READING',
  'BANK DEPOSIT',
  'POS',
] as const;

const INCOME_DESC_KEYWORDS = [
  'deposit',
  'dépôt',
  'depot',
  'sales',
  'sale',
  'revenue',
  'revenu',
  'chiffre',
  'encaissement',
  'recette',
  'customer payment',
  'paiement client',
  'z-reading',
  'z report',
  'caisse',
  'incoming',
  'versement',
  'credit',
  'crédit',
] as const;

/**
 * Infer INCOME vs EXPENSE for a ledger line (matches document-level revenue/expense signals).
 */
export function inferLineItemType(input: LineItemTypeInput): LineItemFlowType {
  if (input.existingType === 'INCOME') return 'INCOME';

  const cats = [input.expenseCategory, input.category, input.parentExpenseCategory].map((c) =>
    String(c || '').toUpperCase()
  );

  if (cats.some((c) => INCOME_CATEGORY_MARKERS.some((m) => c.includes(m)))) {
    return 'INCOME';
  }

  const docType = String(input.documentType || '').toUpperCase();
  if (INCOME_DOC_MARKERS.some((m) => docType.includes(m))) {
    return 'INCOME';
  }

  const text = `${input.description || ''} ${input.issuer || ''}`.toLowerCase();
  if (INCOME_DESC_KEYWORDS.some((kw) => text.includes(kw))) {
    return 'INCOME';
  }

  if (cats.some((c) => c.includes('PAYROLL') || c.includes('SALARY'))) {
    return 'EXPENSE';
  }

  return 'EXPENSE';
}

/** Reuse AI lineItems type when amount + issuer align with a sub-invoice row */
export function matchLineItemTypeFromAi(
  sub: { issuer?: string; totalAmount?: number },
  aiLineItems: Array<{ amount?: number; description?: string; type?: string }>
): LineItemFlowType | undefined {
  const amount = Number(sub.totalAmount || 0);
  const issuer = String(sub.issuer || '').trim().toLowerCase();
  if (!aiLineItems.length || amount <= 0) return undefined;

  const match = aiLineItems.find((item) => {
    const itemAmt = Number(item.amount || 0);
    if (Math.abs(itemAmt - amount) > 0.06) return false;
    const desc = String(item.description || '').toLowerCase();
    if (!issuer) return true;
    return (
      desc.includes(issuer) ||
      issuer.split(/\s+/).some((w) => w.length > 3 && desc.includes(w))
    );
  });
  if (match?.type === 'INCOME' || match?.type === 'EXPENSE') return match.type;
  return undefined;
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

/**
 * Same IDs as Verification Center / dashboard (`RESTAURANT_CATEGORY_IDS`).
 * Used for Excel, reports, and AI line items so categories never diverge.
 */
export const CANONICAL_LINE_CATEGORIES = new Set([
  'FOOD_SUPPLIES',
  'BEVERAGES',
  'RESTAURANT_SUPPLIES',
  'PACKAGING',
  'CLEANING',
  'MAINTENANCE',
  'RENT',
  'UTILITIES',
  'INSURANCE',
  'TELECOM',
  'BANK_FEES',
  'ACCOUNTING',
  'MARKETING',
  'DELIVERY',
  'OFFICE_SUPPLIES',
  'LICENSES',
  'TAXES',
  'PAYROLL',
  'PAYROLL_TAXES',
  'SALARY',
  'SUPPLIERS',
  'BILLS',
  'OTHER',
]);

const BEVERAGE_DESC_RE =
  /\b(sangria|bière|biere|beer|vin|wine|prosecco|champagne|soft\s*drink|soda|coca|cola|jus|juice|café|cafe|coffee|thé|tea|eau|water|boisson|beverage|drink|alcool|alcohol|spirit|liqueur|aperol|mojito|cocktail|cidre|cider|fût|fut|lager|ipa|stout)\b/i;

const FOOD_DESC_RE =
  /\b(tapas|patatas|brava|nachos|planche|charcuterie|fromage|cheese|formule|midi|menu|burger|pizza|salade|salad|viande|meat|poisson|fish|poulet|chicken|saumon|pain|bread|dessert|glace|ice\s*cream|taco|empanada|croquette|paella|riz|rice|plat|dish|food|nourriture|aliment)\b/i;

/** Map messy AI / UI strings onto the single dashboard category vocabulary. */
const ALIAS_TO_CANONICAL: Record<string, string> = {
  FOOD: 'FOOD_SUPPLIES',
  FOODS: 'FOOD_SUPPLIES',
  FOOD_SUPPLY: 'FOOD_SUPPLIES',
  FOOD_SUPPLIES: 'FOOD_SUPPLIES',
  GROCERY: 'FOOD_SUPPLIES',
  GROCERIES: 'FOOD_SUPPLIES',
  ALIMENTATION: 'FOOD_SUPPLIES',
  NOURRITURE: 'FOOD_SUPPLIES',
  SALES_FOOD: 'FOOD_SUPPLIES',
  FOOD_SALES: 'FOOD_SUPPLIES',
  BEVERAGE: 'BEVERAGES',
  BEVERAGES: 'BEVERAGES',
  BOISSON: 'BEVERAGES',
  BOISSONS: 'BEVERAGES',
  DRINK: 'BEVERAGES',
  DRINKS: 'BEVERAGES',
  WINE: 'BEVERAGES',
  BEER: 'BEVERAGES',
  SALES_BEVERAGES: 'BEVERAGES',
  SALES_BEVERAGE: 'BEVERAGES',
  BEVERAGE_SALES: 'BEVERAGES',
  BEVERAGES_SALES: 'BEVERAGES',
  SALES_OTHER: 'OTHER',
  SALARY: 'PAYROLL',
  PAYROLL: 'PAYROLL',
  PAYROLL_TAXES: 'PAYROLL_TAXES',
  SUPPLIERS: 'SUPPLIERS',
  SUPPLIER: 'SUPPLIERS',
  BILLS: 'BILLS',
  BILL: 'BILLS',
};

function classifyProductFromDescription(description: string): CategoryId {
  const text = description || '';
  const bev = BEVERAGE_DESC_RE.test(text);
  const food = FOOD_DESC_RE.test(text);
  if (bev && !food) return 'BEVERAGES';
  if (food && !bev) return 'FOOD_SUPPLIES';
  if (bev && food) {
    if (/\b(sangria|bière|biere|beer|vin|wine|soft|boisson|cocktail)\b/i.test(text)) {
      return 'BEVERAGES';
    }
    return 'FOOD_SUPPLIES';
  }
  const detected = detectCategory(text);
  return detected === 'SALARY' ? 'PAYROLL' : detected;
}

/**
 * Normalize messy AI line categories to the SAME IDs as the dashboard
 * Verification Center (FOOD_SUPPLIES, BEVERAGES, RENT, …).
 * Income vs expense only affects Type — category vocabulary stays identical.
 */
export function normalizeLineItemCategory(opts: {
  category?: string | null;
  description?: string | null;
  type?: string | null;
  parentCategory?: string | null;
  documentType?: string | null;
}): string {
  const raw = String(opts.category || '')
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');
  const desc = String(opts.description || '');
  const parent = String(opts.parentCategory || '')
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');

  let aliased = ALIAS_TO_CANONICAL[raw] || raw;
  // Document-level SALES / REVENUE is not a line product class — classify the item.
  if (aliased === 'SALES' || aliased === 'REVENUE' || aliased === 'RESERVATION') {
    aliased = '';
  }
  const parentAliased = ALIAS_TO_CANONICAL[parent] || parent;

  if (aliased && CANONICAL_LINE_CATEGORIES.has(aliased) && aliased !== 'OTHER') {
    return aliased === 'SALARY' ? 'PAYROLL' : aliased;
  }

  const fromDesc = classifyProductFromDescription(desc);
  if (fromDesc !== 'OTHER') return fromDesc === 'SALARY' ? 'PAYROLL' : fromDesc;

  if (
    parentAliased &&
    CANONICAL_LINE_CATEGORIES.has(parentAliased) &&
    parentAliased !== 'OTHER' &&
    parentAliased !== 'SALES' &&
    parentAliased !== 'REVENUE'
  ) {
    return parentAliased === 'SALARY' ? 'PAYROLL' : parentAliased;
  }

  return 'OTHER';
}
