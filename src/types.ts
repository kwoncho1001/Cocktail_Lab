export interface Ingredient {
  id: string;
  name: string;
  category: string;
  alcoholContent?: number;
  substitutes?: string[];
}

export interface RecipeIngredient {
  ingredientId: string;
  amount: number;
  unit: string;
  originalName?: string;
}

export interface TastingNote {
  id?: string;
  rating: number;
  sweet?: number;
  sour?: number;
  alcohol?: number;
  bitter?: number;
  body?: number;
  tags?: string[];
  note: string;
  createdAt: any;
  userId: string;
  userName: string;
}

export interface Recipe {
  id?: string;
  title: string;
  baseIngredientId?: string;
  instructions: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  imageURL?: string;
  garnish?: string;
  technique: 'Build' | 'Stir' | 'Shake' | 'Blend' | 'Layer';
  createdAt: any;
  authorId?: string;
  ingredients?: RecipeIngredient[];
  flavorProfile?: string[];
  history?: string;
}

export interface UserProfile {
  myBar: string[];
  bookmarks: string[];
}
